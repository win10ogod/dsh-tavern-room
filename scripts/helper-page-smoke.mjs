import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const url=await testHostUrl()
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[]
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)})
try{
 await page.goto(url);try{await page.getByRole('button',{name:'继续',exact:true}).click({timeout:1500})}catch{}
 const call=async(method,args={})=>{const r=await context.request.post('http://127.0.0.1:3197/api/dsh-tavern/'+method,{data:args});const x=await r.json();if(!x.ok)throw new Error(x.error);return x}
 const name='helper-'+Date.now()+'.json',card={spec:'chara_card_v2',spec_version:'2.0',data:{name:'Helper 持久化驗證',description:'圖書館員',first_mes:'<button id="write">寫入變數</button><output id="saved">pending</output><script>document.getElementById("saved").textContent=String(getVariables({type:"chat"}).proof || "none");document.getElementById("write").onclick=async()=>{await insertOrAssignVariables({proof:891},{type:"chat"});document.getElementById("saved").textContent=String(getVariables({type:"chat"}).proof);};</script>',extensions:{tavern_helper:{scripts:[{id:'persistent-helper',name:'Helper fixture',type:'script',enabled:true,content:'window.fixtureRuntimeReady = true;'}]}}}}
 const imported=await call('importCard',{payload:{kind:'text',name,text:JSON.stringify(card)}})
 await page.getByRole('button',{name:'酒館',exact:true}).click();let frame=page.frameLocator('iframe[title="酒館"]')
 await frame.locator('.room-nav').getByRole('button',{name:'對話',exact:true}).click();await frame.getByRole('combobox',{name:'選擇人物卡'}).selectOption(imported.card.path);await frame.getByRole('button',{name:'建立',exact:true}).click()
 let inner=frame.frameLocator('iframe[title="人物卡消息界面"]').first();await expect(inner.locator('#saved')).toHaveText('none',{timeout:45000});await inner.locator('#write').click();await expect(inner.locator('#saved')).toHaveText('891',{timeout:30000})
 console.log('Helper variable write PASS')
 await frame.locator('.room-nav').getByRole('button',{name:'人物卡',exact:true}).click();await frame.locator('.room-nav').getByRole('button',{name:'對話',exact:true}).click();await expect(inner.locator('#saved')).toHaveText('891');console.log('tab lifetime PASS')
 await page.reload();await page.getByRole('button',{name:'酒館',exact:true}).click();frame=page.frameLocator('iframe[title="酒館"]');await frame.locator('.room-nav').getByRole('button',{name:'對話',exact:true}).click();inner=frame.frameLocator('iframe[title="人物卡消息界面"]').first();await expect(inner.locator('#saved')).toHaveText('891',{timeout:45000});console.log('persisted reload PASS')
 await writeFile('artifacts/helper-evidence.json',JSON.stringify({errors,card:imported.card.path,variable:891},null,2))
}finally{await browser.close()}
