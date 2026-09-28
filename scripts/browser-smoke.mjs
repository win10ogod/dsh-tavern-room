import {chromium} from '@playwright/test'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const log=await readFile(new URL('../artifacts/test-server.log',import.meta.url),'utf8')
const url=log.match(/http:\/\/127\.0\.0\.1:3197\/\?token=[^\s]+/u)?.[0]
if(!url)throw new Error('Test host not ready')
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[]
page.on('pageerror',error=>errors.push(error.message))
try {
 await page.goto(url);try{await page.getByRole('button',{name:'继续',exact:true}).click({timeout:4000})}catch{}await page.getByRole('button',{name:'酒館',exact:true}).waitFor({timeout:30000});await page.getByRole('button',{name:'酒館',exact:true}).click()
 const frame=page.frameLocator('iframe[title="酒館"]')
 await frame.getByRole('heading',{name:'人物卡',exact:true}).waitFor()
 await frame.locator('.card').first().waitFor()
 await page.locator('iframe[title="酒館"]').screenshot({path:new URL('../artifacts/tavern-page.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/u,'$1')})
 await frame.getByRole('button',{name:'世界書',exact:true}).click();await frame.getByRole('heading',{name:'世界書',exact:true}).waitFor()
 await frame.getByRole('button',{name:'設定',exact:true}).click();await frame.getByRole('heading',{name:'功能模組'}).waitFor()
 assert.equal(await frame.locator('.row').count(),8)
 const catalog=await(await context.request.get('http://127.0.0.1:3197/api/tavern-room')).json();assert.equal(catalog.features.filter(f=>f.enabled).length,8)
 const call=async(feature,operation,args)=>{const response=await context.request.post('http://127.0.0.1:3197/api/tavern-room',{data:{feature,operation,args}});const body=await response.json();assert.equal(response.ok(),true,JSON.stringify(body));return body.value}
 const prior=JSON.parse(await readFile(new URL('../artifacts/smoke-room.json',import.meta.url),'utf8'))
 const fork=await call('story','fork',{id:prior.roomId,turn:0});assert.notEqual(fork.id,prior.roomId);assert.equal(fork.turns.length,1)
 const vars=await call('mvu','update',{id:fork.id,updates:[{op:'add',path:'/hp',value:7}]});assert.equal(vars.variables.hp,7)
 const contact=await call('phone','saveContact',{storyId:fork.id,name:'測試友人',profile:'簡短回答。',messages:[]})
 const result=await call('phone','send',{id:contact.id,text:'只回覆 OK。'});assert.equal(result.messages.length,2)
 const saved=await call('memory','save',{kind:'preference',content:'使用繁體中文',cardId:prior.cardId});const memory=await call('memory','search',{cardId:prior.cardId,query:'繁體'});assert.ok(memory.some(m=>m.id===saved.id))
 assert.deepEqual(errors,[])
 await writeFile(new URL('../artifacts/browser-report.json',import.meta.url),JSON.stringify({ok:true,checks:['native DSH Tavern navigation','8 independent feature entries','card library and worldbook UI','native session fork','MVU updates','phone Agent reply','scoped memory search'],errors},null,2))
 console.log('PASS: native DSH navigation, page, session fork, MVU, phone and memory')
}finally{await browser.close()}
