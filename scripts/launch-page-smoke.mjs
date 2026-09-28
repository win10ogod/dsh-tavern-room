import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext(),p=await c.newPage(),errors=[]
p.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.stack)})
try{
 await p.goto(await testHostUrl());try{await p.getByRole('button',{name:'继续',exact:true}).click({timeout:1500})}catch{}
 await p.getByRole('button',{name:'酒館',exact:true}).click();const f=p.frameLocator('iframe[title="酒館"]')
 await f.locator('.room-nav').getByRole('button',{name:'開局與歷史',exact:true}).click()
 await f.getByRole('button',{name:'＋ 选择人物卡 · 新开游玩',exact:true}).click()
 await f.getByRole('dialog').getByRole('button',{name:/完整執行層測試/}).click()
 await f.getByRole('button',{name:'开始新游戏',exact:true}).click()
 await expect(f.locator('.room-transcript')).toBeVisible({timeout:60000})
 console.log('original opening picker PASS')
 await f.getByRole('textbox',{name:'輸入訊息'}).fill('請用一句話問候我。');await f.getByRole('button',{name:'傳送',exact:true}).click()
 await expect(f.locator('.room-message.assistant')).toHaveCount(2,{timeout:180000});console.log('native composer PASS');expect(errors).toEqual([])
 await writeFile('artifacts/launch-evidence.json',JSON.stringify({errors,text:await f.locator('.room-main').innerText()},null,2))
}catch(e){console.log(await p.frames().find(f=>f.url().includes('/tavern-room/'))?.locator('body').innerText());throw e}finally{await b.close()}
