import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const url=await testHostUrl()
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[]
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)})
try{
 await page.goto(url);try{await page.getByRole('button',{name:'继续',exact:true}).click({timeout:1500})}catch{}
 const call=async(method,args={})=>{const r=await context.request.post('http://127.0.0.1:3197/api/dsh-tavern/'+method,{data:args});const x=await r.json();if(!x.ok)throw new Error(x.error);return x}
 const name='mvu-'+Date.now()+'.json',card={spec:'chara_card_v2',spec_version:'2.0',data:{name:'MVU 實機驗證',description:'你是圖書館員，只有收到玩家受傷指令才減少健康值，否則保持不變。',first_mes:'館員在門口等你。',character_book:{name:'驗證變數',entries:[{id:0,keys:[],comment:'[initvar]初始變數',content:'hp: 10',enabled:true,insertion_order:100,constant:true}]},extensions:{}}}
 const imported=await call('importCard',{payload:{kind:'text',name,text:JSON.stringify(card)}})
 await page.getByRole('button',{name:'酒館',exact:true}).click();const frame=page.frameLocator('iframe[title="酒館"]')
 await frame.locator('.room-nav').getByRole('button',{name:'對話',exact:true}).click();await frame.getByRole('combobox',{name:'選擇人物卡'}).selectOption(imported.card.path);await frame.getByRole('button',{name:'建立',exact:true}).click()
 await expect(frame.locator('.room-transcript')).toBeVisible({timeout:60000})
 const room=page.frames().find(f=>f.url().includes('/tavern-room/')),sessionId=await room.evaluate(()=>localStorage.getItem('tavern-room-session'))
 let state
 await expect.poll(async()=>{state=(await call('getSession',{sessionId})).view;return state.tavernHelper?.messages?.[0]?.variables?.stat_data?.hp??state.tavernHelper?.messages?.[0]?.variables?.[0]?.stat_data?.hp},{timeout:90000}).toBe(10)
 console.log('official MVU initialization PASS')
 await frame.getByRole('textbox',{name:'輸入訊息'}).fill('向館員打招呼，用一句話回答即可。')
 await frame.getByRole('button',{name:'傳送',exact:true}).click();await expect(frame.locator('.room-message.assistant')).toHaveCount(2,{timeout:180000})
 await expect.poll(async()=>{state=(await call('getSession',{sessionId})).view;if(state.settleError)throw new Error(state.settleError);return state.settleStatus},{timeout:180000}).toBe('done')
 await writeFile('artifacts/mvu-evidence.json',JSON.stringify({sessionId,errors,state},null,2));console.log('MVU settlement PASS');const audited=await (await context.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method:'audit',args:{sessionId}}})).json();expect(audited.ok,audited.error).toBeTruthy();expect(errors).toEqual([]);console.log('MVU persisted format PASS')
}finally{await browser.close()}
