const {chromium}=await import(process.env.PLATFORM_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const output=(process.env.PLATFORM_TEST_ARTIFACTS || 'test-results/platform') + '/';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLATFORM_CHROMIUM_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('nexo-dashboard-v6','{broken-original'));
 await page.goto((process.env.PLATFORM_TEST_URL || 'http://127.0.0.1:3103'));await page.getByText('Dados locais precisam de recuperação',{exact:true}).waitFor();
 await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>localStorage.getItem('nexo-dashboard-v6')),'{broken-original');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar cópia desta sessão'}).click();assert.equal((await downloadPromise).suggestedFilename(),'nexo-painel-backup.json');
 await page.screenshot({path:output+'storage-recovery.png'});console.log('Corrupt local storage preserved; session backup downloads.');await page.close();
 const normal=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});normal.on('pageerror',e=>errors.push(e.message));await normal.goto((process.env.PLATFORM_TEST_URL || 'http://127.0.0.1:3103'));await normal.waitForTimeout(700);console.log('initial errors',errors);await normal.screenshot({path:output+'initial.png'});
 const audit=[];for(const width of [390,1280]){await normal.setViewportSize({width,height:900});for(const name of ['Início','Estudar','Evolução','Mentor','Perfil']){if(width<700)await normal.getByRole('button',{name:'Abrir menu',exact:true}).click();await normal.locator('.main-nav').getByRole('button',{name,exact:true}).click();await normal.waitForTimeout(350);const overflow=await normal.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);audit.push({width,name,overflow});await normal.screenshot({path:output+name+'-'+width+'.png'});}}
 writeFileSync(output+'audit.json',JSON.stringify({audit,errors},null,2));console.log(JSON.stringify({audit,errors}));
} finally {await browser.close();}

