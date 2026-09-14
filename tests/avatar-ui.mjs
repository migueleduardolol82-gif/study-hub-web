import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AVATAR_PLAYWRIGHT_MODULE||'playwright');
import {newAvatar,purchase,validateAppearance} from '../lib/avatar.ts';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=process.env.AVATAR_TEST_ARTIFACTS||'/tmp/nexo-avatar-tests';mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3100','--hostname','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser;
try{
 await new Promise(r=>setTimeout(r,1200));
 browser=await chromium.launch({executablePath:process.env.AVATAR_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const real=await page.request.get('http://127.0.0.1:3100/api/avatar');assert.equal(real.status(),503);assert.equal((await real.json()).success,false);console.log('Unconfigured API safely returns JSON 503.');
 let account=newAvatar('2026-09-14T12:00:00Z');account.appearance={...account.appearance,height:180,weight:92,muscle:55};account.balance=500;account.days=Array.from({length:60},(_,i)=>String(i));
 // UI-only fixtures: never shipped to the app or sent to the production database.
 await page.route('**/api/avatar',async route=>{try{const request=route.request();if(request.method()==='POST'){const body=request.postDataJSON();if(body.action==='appearance'){account.appearance=validateAppearance(body.appearance);account.history.push({at:new Date().toISOString(),appearance:{...account.appearance}});}if(body.action==='buy')purchase(account,body.id,new Date().toISOString());if(body.action==='equip'){const {avatarItems}=await import(root+'/lib/avatar.ts');const item=avatarItems.find(i=>i.id===body.id);account.equipped[item.slot]=item.id;}}await route.fulfill({json:{success:true,data:account}});}catch(e){await route.fulfill({status:400,json:{success:false,error:{message:e.message}}});}});
 await page.goto('http://127.0.0.1:3100');await page.getByRole('button',{name:'Evolução',exact:true}).last().click();await page.getByRole('button',{name:'Avatar',exact:true}).click();await page.locator('.avatar-canvas canvas').waitFor();await page.waitForTimeout(1000);
 for(const width of [320,375,390,430,768,1280]){await page.setViewportSize({width,height:844});await page.waitForTimeout(180);const dimensions=await page.locator('.avatar-workspace').evaluate(e=>({width:e.getBoundingClientRect().width,scroll:e.scrollWidth,body:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(dimensions.scroll<=dimensions.width+2,JSON.stringify(dimensions));assert.ok(dimensions.body<=width+2,JSON.stringify(dimensions));console.log('Fits viewport',width);if(width===390||width===1280)await page.screenshot({path:`${output}/avatar-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:390,height:844});
 // Select the internal tab explicitly, avoiding global Evolution navigation.
 await page.locator('.avatar-workspace nav').getByRole('button',{name:'Evolução',exact:true}).click();await page.getByLabel('Descreva sua aparência').fill('homem, 1,80 m, 92 kg, cabelo curto escuro, pouca barba');await page.getByRole('button',{name:'Preencher pela descrição'}).click();await page.getByRole('button',{name:'Salvar novo registro'}).click();await page.getByRole('status').filter({hasText:'Salvo.'}).waitFor();assert.equal(account.appearance.height,180);
 await page.locator('.avatar-workspace nav').getByRole('button',{name:'Loja',exact:true}).click();const jacket=page.locator('.avatar-item').filter({hasText:'Jaqueta grafite'});await jacket.getByRole('button',{name:'Experimentar'}).click();page.once('dialog',dialog=>dialog.accept());await jacket.getByRole('button',{name:'Comprar',exact:true}).click();await page.getByRole('status').filter({hasText:'Salvo.'}).waitFor();assert.equal(account.balance,460);
 await page.locator('.avatar-workspace nav').getByRole('button',{name:'Equipar',exact:true}).click();await page.locator('.avatar-item').filter({hasText:'Jaqueta grafite'}).getByRole('button',{name:'Equipar',exact:true}).click();await page.getByRole('status').filter({hasText:'Salvo.'}).waitFor();assert.equal(account.equipped.tronco,'slate');
 await page.locator('.avatar-workspace nav').getByRole('button',{name:'Histórico',exact:true}).click();await page.getByRole('button',{name:/Visualizar/}).click();console.log('UI fixture: description, save, shop preview, purchase, equip and history pass.');assert.deepEqual(errors,[]);console.log('No page errors.');
}catch(error){console.error(error);process.exitCode=1;}finally{await browser?.close();server.kill();}
