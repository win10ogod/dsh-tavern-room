import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const log=await readFile('artifacts/test-server.log','utf8'),url=log.match(/http:\/\/127\.0\.0\.1:3197\/\?token=[^\s]+/u)[0]
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage()
try{
 await page.goto(url)
 const rpc=async(method,args={})=>{const r=await context.request.post('http://127.0.0.1:3197/api/dsh-tavern/'+method,{data:args});const x=await r.json();if(!x.ok)throw new Error(x.error);return x}
 const command=async(method,args)=>{const r=await context.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method,args}});const x=await r.json();if(!x.ok)throw new Error(x.error);return x}
 const created=await command('create',{path:'cards/full-runtime-fixture.json'}),sessionId=created.sessionId
 await command('send',{sessionId,text:'請用一句話歡迎我。'})
 let state,deadline=Date.now()+180000
 do{state=await command('state',{sessionId});if(state.view.settleError||state.view.foregroundError)throw new Error(state.view.settleError||JSON.stringify(state.view.foregroundError));if(state.messages.length>=3&&!state.running&&!state.view.activity.busy)break;await new Promise(resolve=>setTimeout(resolve,1000))}while(Date.now()<deadline)
 assert.equal(state.view.canRollback,true,state.view.rollbackUnavailableReason);await command('audit',{sessionId})
 const count=state.messages.length
 const rollback=await rpc('rollbackTurn',{sessionId,expectedTurn:state.view.rollbackTargetTurn});assert.ok(rollback.view.undoRollbackTurn)
 const undone=await rpc('undoRollbackTurn',{sessionId});assert.equal((await command('state',{sessionId})).messages.length,count)
 console.log('rollback and undo PASS');await command('audit',{sessionId})
 const fork=await command('fork',{sessionId,chatId:undone.view.chatId,turn:undone.view.latestAssistantTurn})
 const child=await command('state',{sessionId:fork.sessionId});assert.equal(child.messages.length,count)
 console.log('native branch PASS');await command('audit',{sessionId:fork.sessionId})
 await writeFile('artifacts/conversation-roundtrip.json',JSON.stringify({sessionId,forkSessionId:fork.sessionId,messages:count},null,2))
}finally{await browser.close()}
