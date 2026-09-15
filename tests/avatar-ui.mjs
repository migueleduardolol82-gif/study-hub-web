import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {newAvatar, purchase, setAvatarItemColor, validateAppearance, avatarItems, resolveFacial} from '../lib/avatar.ts';
const {chromium} = await import(process.env.AVATAR_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..',import.meta.url));
const output = resolve(process.env.AVATAR_TEST_ARTIFACTS || 'test-results/avatar'); mkdirSync(output,{recursive:true});
const port = process.env.AVATAR_TEST_PORT || '3101';
const url = process.env.AVATAR_TEST_URL || `http://127.0.0.1:${port}`;
const server = process.env.AVATAR_TEST_URL ? null : spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',port,'--hostname','127.0.0.1'],{cwd:root,stdio:'ignore',windowsHide:true});
let browser;
try {
  for (let i=0;i<60;i++) {try {const response=await fetch(url);if(response.ok)break;}catch {} await new Promise(r=>setTimeout(r,300));}
  browser = await chromium.launch({executablePath:process.env.AVATAR_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const equipmentLibrary=page.waitForResponse(response=>response.url().endsWith('/avatar/equipment-library.glb')&&response.ok());
  page.on('console',m=>{if(m.type()==='error' && /THREE|WebGL|shader|hydration/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{
    window.avatarTestStats={draws:0,contexts:0,triangles:0};
    const known=new WeakSet();
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){const context=original.apply(this,args);if(context&&args[0]==='webgl2'&&!known.has(context)){
      known.add(context);window.avatarTestStats.contexts++;
      const draw=context.drawElements.bind(context);context.drawElements=(...params)=>{window.avatarTestStats.draws++;window.avatarTestStats.triangles+=params[1]/3;return draw(...params);};
    }return context;};
  });
  const real = await page.request.get(url+'/api/avatar'); assert.equal(real.status(),503); assert.equal((await real.json()).success,false);
  console.log('Unconfigured real API: JSON 503; UI persistence and photo use local fixtures.');
  let account = newAvatar('2026-09-14T12:00:00Z');account.appearance={...account.appearance,height:180,weight:92,muscle:55};account.balance=500;account.days=Array.from({length:60},(_,i)=>String(i));account.inventory.push('head','wrist');account.equipped['cabeça']='head';account.equipped['mão']='wrist';
  let photoMode='ok', photoCalls=0, savedCalls=0;
  await page.route('**/api/avatar',async route=>{try {
    if(route.request().method()==='POST') {
      const body=route.request().postDataJSON();
      if(body.action==='appearance'){account.appearance=validateAppearance(body.appearance);account.history.push({at:new Date().toISOString(),appearance:structuredClone(account.appearance)});savedCalls++;}
      if(body.action==='buy')purchase(account,body.id,new Date().toISOString());
      if(body.action==='equip'){const item=avatarItems.find(i=>i.id===body.id);account.equipped[item.slot]=item.id;}
      if(body.action==='item-color')setAvatarItemColor(account,body.id,body.color);
    }
    await route.fulfill({json:{success:true,data:account}});
  }catch(e){await route.fulfill({status:400,json:{success:false,error:{message:e.message}}});}});
  await page.route('**/api/avatar/photo',async route=>{
    photoCalls++; const body=route.request().postDataJSON();assert.ok(body.image.startsWith('data:image/jpeg;base64,'));
    if(photoMode!=='ok')return route.fulfill({status:422,json:{success:false,error:{message:photoMode}}});
    return route.fulfill({json:{success:true,data:{appearance:{...body.current,hair:'ondulado',facial:{...resolveFacial(body.current),noseWidth:0.85},hairLength:1.1},observations:['Estimativa simulada para testar o fluxo, sem análise de pessoa real.']}}});
  });
  const openAvatar=async()=>{await page.goto(url);await page.getByRole('button',{name:'Evolução',exact:true}).last().click();await page.getByRole('button',{name:'Avatar',exact:true}).click();await page.locator('.avatar-canvas canvas').waitFor();await page.locator('.avatar-canvas').scrollIntoViewIfNeeded();};
  const tab=async name=>page.locator('.avatar-workspace>nav').getByRole('button',{name,exact:true}).click();
  const range=async(label,value,scope=page.locator('.avatar-editor'))=>{const slider=scope.getByRole('slider',{name:new RegExp(label)});await slider.evaluate((element,next)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,String(next));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));},value);};
  await openAvatar();await equipmentLibrary;await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(350);
  await page.getByRole('button',{name:'Humano',exact:true}).click();await page.waitForTimeout(180);
  assert.ok((await page.locator('.avatar-canvas').getAttribute('class')).includes('avatar-mode-human'));
  await page.locator('.avatar-stage').screenshot({path:`${output}/human-mode.png`});
  await page.getByRole('button',{name:'RPG',exact:true}).click();await page.waitForTimeout(180);
  assert.ok((await page.locator('.avatar-canvas').getAttribute('class')).includes('avatar-mode-rpg'));
  await page.locator('.avatar-stage').screenshot({path:`${output}/rpg-mode.png`});
  for(const width of [320,375,390,430,768,1280]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(120);
    const d=await page.locator('.avatar-workspace').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,body:document.documentElement.scrollWidth}));
    assert.ok(d.scroll<=d.width+2,JSON.stringify(d));assert.ok(d.body<=width+2,JSON.stringify(d));
    await page.locator('.avatar-workspace').screenshot({path:`${output}/avatar-${width}.png`});console.log('Legacy avatar fits',width);
  }
  await page.getByRole('button',{name:'Ver rosto',exact:true}).click();await page.waitForTimeout(120);
  await page.locator('.avatar-stage').screenshot({path:`${output}/face-before-adjustments.png`});
  await tab('Evolução');const canvas=page.locator('.avatar-canvas canvas');const originalCanvas=await canvas.elementHandle();const contexts=await page.evaluate(()=>window.avatarTestStats.contexts);
  await range('Largura do rosto',1.1);await range('Distância dos olhos',0.9);await range('Largura do nariz',1.2);await range('Mais anime',0.7);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.avatarTestStats.contexts),contexts);
  assert.ok(await canvas.evaluate((e,original)=>e===original,originalCanvas));
  const after=await canvas.screenshot();await page.getByRole('button',{name:'Ver antes (salvo)',exact:true}).click();await page.waitForTimeout(160);
  const before=await canvas.screenshot();assert.notDeepEqual(before,after);await page.getByRole('button',{name:'Ver depois (ajustes)',exact:true}).click();
  await page.getByRole('button',{name:'Salvar aparência',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent==='Salvo.');
  assert.equal(account.appearance.facial.noseWidth,1.2);assert.equal(account.equipped['cabeça'],'head');
  await openAvatar();await tab('Evolução');assert.equal(await page.locator('.avatar-editor').getByRole('slider',{name:/Largura do nariz/}).inputValue(),'1.2');console.log('Manual adjustments, same WebGL canvas, before/after and fixture reload persist.');
  await page.getByRole('button',{name:'Ver rosto',exact:true}).click();await page.waitForTimeout(200);
  const front=await canvas.screenshot();await page.getByRole('button',{name:'Girar avatar à direita'}).click();await page.waitForTimeout(150);assert.notDeepEqual(await canvas.screenshot(),front);
  await page.getByRole('button',{name:'Aproximar avatar'}).click();await page.waitForTimeout(150);assert.notDeepEqual(await canvas.screenshot(),front);
  const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+80,bounds.y+bounds.height/2);await page.mouse.up();await page.waitForTimeout(150);
  await page.locator('.avatar-stage').screenshot({path:`${output}/face-rotation.png`});
  await page.getByRole('button',{name:'Centralizar',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);const stopped=await page.evaluate(()=>window.avatarTestStats.draws);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.avatarTestStats.draws),stopped);
  await page.locator('.avatar-stage').scrollIntoViewIfNeeded();await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(450);assert.ok(await page.evaluate(()=>window.avatarTestStats.draws)>stopped);
  await page.locator('.avatar-stage').evaluate(e=>{e.style.display='none';});await page.waitForTimeout(120);const hidden=await page.evaluate(()=>window.avatarTestStats.draws);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.avatarTestStats.draws),hidden);await page.locator('.avatar-stage').evaluate(e=>{e.style.display='';});await page.emulateMedia({reducedMotion:'reduce'});
  console.log('Rotation, zoom, pointer drag, reduced motion and invisible render pause pass.');
  await tab('Criar por Foto');
  assert.ok((await page.locator('.avatar-photo-privacy').innerText()).includes('OpenAI'));
  const photo=page.locator('.avatar-photo');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle='#c6ab91';ctx.fillRect(0,0,240,240);return c.toDataURL('image/png').split(',')[1];});
  await photo.getByLabel('Selecionar foto').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await photo.getByRole('button',{name:'Gerar prévia do avatar'}).click();await photo.getByText('Referência aproximada pronta').waitFor();assert.equal(photoCalls,1);assert.equal(await photo.getByText(/Correspondência visual/).count(),0);
  await range('Largura do nariz',1.25,photo);await range('Espessura das sobrancelhas',1.3,photo);await range('Comprimento do cabelo',1.35,photo);
  for(const width of [320,375,390,430,1280]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(100);
    const d=await page.locator('.avatar-workspace').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,body:document.documentElement.scrollWidth}));assert.ok(d.scroll<=d.width+2 && d.body<=width+2,JSON.stringify(d));
    await page.locator('.avatar-workspace').screenshot({path:`${output}/photo-adjustments-${width}.png`});console.log('Photo editor fits',width);
  }
  const oldSaves=savedCalls;await photo.getByRole('button',{name:'Confirmar avatar'}).click();
  await page.waitForTimeout(200);assert.equal(savedCalls,oldSaves+1);assert.equal(account.appearance.facial.noseWidth,1.25);assert.equal(account.appearance.hairLength,1.35);
  assert.equal(account.appearance.shape,'neutro');assert.equal(account.appearance.weight,92);assert.equal(account.appearance.muscle,55);
  await page.locator('.avatar-stage').screenshot({path:`${output}/face-after-adjustments.png`});
  await photo.getByRole('button',{name:'Escolher outra'}).click();photoMode='Não encontrei um rosto visível.';
  await photo.getByLabel('Selecionar foto').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await photo.getByRole('button',{name:'Gerar prévia do avatar'}).click();await photo.getByRole('alert').waitFor();assert.ok((await photo.getByRole('alert').innerText()).includes('rosto visível'));
  await photo.getByLabel('Selecionar foto').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});await photo.getByRole('button',{name:'Gerar prévia do avatar'}).click();assert.ok((await photo.getByRole('alert').innerText()).includes('JPG'));assert.equal(photoCalls,2);
  await openAvatar();await tab('Evolução');assert.equal(await page.locator('.avatar-editor').getByRole('slider',{name:/Largura do nariz/}).inputValue(),'1.25');
  console.log('Photo mock → preview → manual adjustments → confirmation → reload; validation errors pass.');
  await tab('Loja');const jacket=page.locator('.avatar-item').filter({hasText:'Jaqueta grafite'});await jacket.getByRole('button',{name:'Experimentar'}).click();page.once('dialog',d=>d.accept());await jacket.getByRole('button',{name:'Comprar',exact:true}).click();await page.waitForTimeout(150);assert.equal(account.balance,460);
  await tab('Equipar');await page.locator('.avatar-item').filter({hasText:'Couraça de Ardósia'}).getByRole('button',{name:'Equipar',exact:true}).click();await page.waitForTimeout(150);assert.equal(account.equipped.tronco,'slate');assert.equal(account.equipped['cabeça'],'head');
  await page.getByRole('button',{name:'Humano',exact:true}).click();await page.waitForTimeout(180);const realJacket=page.locator('.avatar-item').filter({hasText:'Jaqueta grafite'});assert.ok((await realJacket.innerText()).includes('Couraça de Ardósia'));assert.ok((await page.locator('.equipment-slots').innerText()).includes('Jaqueta grafite'));
  const baseCard=page.locator('.avatar-item').filter({hasText:'Look casual essencial'});await baseCard.getByRole('button',{name:/Usar cor #58664d/i}).click();await page.waitForTimeout(180);assert.equal(account.itemColors.base,'#58664d');
  await page.locator('.avatar-workspace').screenshot({path:`${output}/shared-inventory-human.png`});
  await tab('Histórico');await page.getByRole('button',{name:/Visualizar/}).first().click();
  console.log('Existing inventory, shop preview, purchase, equip and history pass.');
  assert.deepEqual(errors,[]);console.log('No page, shader or WebGL errors.');
} catch(error) {console.error(error);process.exitCode=1;} finally {await browser?.close();server?.kill();}
