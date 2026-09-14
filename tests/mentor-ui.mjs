const {chromium}=await import(process.env.PLATFORM_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const url=process.env.PLATFORM_TEST_URL || 'http://127.0.0.1:3103';
const output=process.env.PLATFORM_TEST_ARTIFACTS || 'test-results/platform';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLATFORM_CHROMIUM_PATH});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});let calls=0;const requests=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/chat',async route=>{calls++;requests.push(route.request().postDataJSON());await route.fulfill(calls===1?{status:503,json:{success:false,error:{message:'Falha de conexão simulada',code:'NETWORK_ERROR',retryable:true}}}:{json:{success:true,data:{answer:'Resposta de teste recebida.'}}});});
 await page.goto(url);await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Mentor',exact:true}).click();await page.getByRole('textbox',{name:'Mensagem para o mentor'}).fill('Como organizar minha revisão?');await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await page.getByRole('alert').filter({hasText:'Mensagem não respondida'}).waitFor();assert.equal(await page.locator('.mentor-messages .user').count(),1);await page.getByRole('textbox',{name:'Mensagem para o mentor'}).fill('Meu próximo rascunho');await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByText('Resposta de teste recebida.',{exact:true}).waitFor();assert.equal(calls,2);assert.deepEqual(requests[0],requests[1]);assert.equal(await page.locator('.mentor-messages .user').count(),1);assert.equal(await page.getByRole('textbox',{name:'Mensagem para o mentor'}).inputValue(),'Meu próximo rascunho');assert.equal(await page.locator('.mentor-error').count(),0);assert.deepEqual(errors,[]);await page.screenshot({path:output+'/mentor-retry.png'});console.log('Mentor retry preserves question, context and new draft; no duplicated message.');
}finally{await browser.close();}
