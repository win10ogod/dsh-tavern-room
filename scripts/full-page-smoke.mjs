import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const url=await testHostUrl()
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[]
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
try{
 await page.goto(url);try{await page.getByRole('button',{name:'继续',exact:true}).click({timeout:1500})}catch{}
 await page.getByRole('button',{name:'酒館',exact:true}).click();const frame=page.frameLocator('iframe[title="酒館"]')
 await frame.getByRole('button',{name:'對話',exact:true}).click()
 await frame.getByRole('combobox',{name:'選擇人物卡'}).selectOption('cards/full-runtime-fixture.json')
 await frame.getByRole('button',{name:'建立',exact:true}).click()
 await expect(frame.locator('.room-transcript')).toBeVisible({timeout:60000})
 const inner=frame.frameLocator('iframe[title="人物卡消息界面"]').first()
 await expect(inner.locator('#runtime-check')).toHaveText('JavaScript 已執行',{timeout:30000})
 console.log('iframe JavaScript PASS')
 await frame.getByRole('textbox',{name:'輸入訊息'}).fill('請用一句話問候我。')
 await frame.getByRole('button',{name:'傳送',exact:true}).click()
 await expect(frame.locator('.room-message.assistant')).toHaveCount(2,{timeout:180000})
 console.log('generation PASS')
 const room=page.frames().find(f=>f.url().includes('/tavern-room/'))
 const sessionId=await room.evaluate(()=>localStorage.getItem('tavern-room-session'))
 await expect.poll(async()=>{const r=await context.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method:'state',args:{sessionId}}});const value=await r.json();if(value.view?.settleError||value.view?.foregroundError)throw new Error(JSON.stringify({settle:value.view.settleError,foreground:value.view.foregroundError}));return value.view?.activity?.busy===false&&!value.running},{timeout:180000}).toBeTruthy()
 console.log('settlement PASS')
 await frame.getByRole('textbox',{name:'輸入訊息'}).fill('接著請推薦一本適合入門的書，只需一句話。')
 await frame.getByRole('button',{name:'傳送',exact:true}).click()
 await expect(frame.locator('.room-message.assistant')).toHaveCount(3,{timeout:180000})
 console.log('second turn PASS')
 const audited=await context.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method:'audit',args:{sessionId}}});const audit=await audited.json();expect(audit.ok,audit.error).toBeTruthy();console.log('persisted format PASS')
 await page.screenshot({path:'artifacts/full-page.png',fullPage:true})
 await writeFile('artifacts/full-page-evidence.json',JSON.stringify({sessionId,errors,text:await frame.locator('body').innerText()},null,2));console.log(JSON.stringify({errors}))
}catch(error){console.log(JSON.stringify({errors}));console.log(await page.locator('body').innerText());throw error}finally{await browser.close()}
