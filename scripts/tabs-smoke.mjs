import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const url=await testHostUrl()
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[],tabs=[]
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.stack)});
try{await page.goto(url);try{await page.getByRole('button',{name:'继续',exact:true}).click({timeout:1500})}catch{}await page.getByRole('button',{name:'酒館',exact:true}).click();const frame=page.frameLocator('iframe[title="酒館"]')
for(const label of ['人物卡','世界書','開局與歷史','劇本與素材','預設','使用者設定','改卡記憶','寫作技能','系統提示詞','設定']){
 await frame.locator('.room-nav').getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(800);tabs.push({label,text:(await frame.locator('.room-main').innerText()).slice(0,550)});if(errors.length)break
}
await writeFile('artifacts/tabs.json',JSON.stringify({errors,tabs},null,2));console.log(JSON.stringify({errors,tabs}));
}catch(error){console.log(JSON.stringify({errors}));console.log(await page.locator('body').innerText());throw error}finally{await browser.close()}
