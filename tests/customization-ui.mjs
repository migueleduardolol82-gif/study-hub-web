const {chromium}=await import(process.env.PLATFORM_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const url=process.env.PLATFORM_TEST_URL || 'http://127.0.0.1:3103';
const output=process.env.PLATFORM_TEST_ARTIFACTS || 'test-results/platform';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLATFORM_CHROMIUM_PATH});
try {
  const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.getByRole('button',{name:'Personalizar'}).click();
 await page.getByRole('button',{name:/Energia/}).click();
  await page.getByRole('button',{name:'Compacta',exact:true}).click();
  await page.getByRole('button',{name:'Suaves',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar',exact:true}).filter({has:page.locator('xpath=..').filter({hasText:'Sessão de foco'})}).click().catch(async()=>{
    await page.locator('.widget-editor article').filter({hasText:'Sessão de foco'}).getByRole('button',{name:'Adicionar'}).click();
  });
  await page.locator('.widget-editor article').filter({hasText:'Acessos rápidos'}).getByRole('button',{name:'Remover Acessos rápidos'}).click();
  const color=page.getByLabel('Cor personalizada');await color.evaluate((input)=>{const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');descriptor.set.call(input,'#2f7df6');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.getByRole('button',{name:'Fechar personalização'}).click();
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('.home-focus').count(),1);assert.equal(await page.locator('.home-shortcuts').count(),0);
 assert.equal((await page.locator('.app-shell').getAttribute('style')).includes('#2f7df6'),true);
  assert.equal(await page.locator('.app-shell').evaluate(element=>element.classList.contains('density-compact')&&element.classList.contains('radius-soft')),true);
  await page.waitForFunction(()=>{const preferences=JSON.parse(localStorage.getItem('nexo-dashboard-v6')).platformPreferences;return preferences?.widgets?.includes('focus')&&preferences.density==='compact'&&preferences.radius==='soft';});
  await page.screenshot({path:output+'/custom-home-mobile.png',fullPage:true});
  await page.reload();await page.locator('.home-focus').waitFor();assert.equal(await page.locator('.home-shortcuts').count(),0);
 assert.equal((await page.locator('.app-shell').getAttribute('style')).includes('#2f7df6'),true);
  assert.equal(await page.locator('.app-shell').evaluate(element=>element.classList.contains('density-compact')&&element.classList.contains('radius-soft')),true);
  await page.setViewportSize({width:1280,height:900});await page.locator('.main-nav').getByRole('button',{name:'Perfil',exact:true}).click();
  await page.screenshot({path:output+'/custom-profile-desktop.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);assert.deepEqual(errors,[]);
  console.log('Theme, custom accent and widget selection persist after reload at mobile and desktop widths.');
} finally {await browser.close();}
