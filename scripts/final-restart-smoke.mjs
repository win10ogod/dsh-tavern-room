import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext(),p=await c.newPage(),report={}
try{
 await p.goto(await testHostUrl())
 const command=async(method,args)=>{const r=await c.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method,args}});const x=await r.json();if(!x.ok)throw new Error(x.error);return x}
 const features=await (await c.request.get('http://127.0.0.1:3197/api/tavern-room')).json();expect(features.features.find(f=>f.id==='memory').enabled).toBe(false)
 const disabled=await c.request.post('http://127.0.0.1:3197/api/dsh-tavern/getCardMemory',{data:{}});const refused=await disabled.json();expect(refused.ok).toBe(false);expect(refused.error).toContain('已關閉');report.switch=true
 for(const file of ['conversation-roundtrip.json','mvu-evidence.json','card-agent-evidence.json']){
  const saved=JSON.parse(await readFile('artifacts/'+file,'utf8')),id=saved.forkSessionId||saved.sessionId
  const state=await command('state',{sessionId:id});await command('audit',{sessionId:id});report[file]={sessionId:id,messages:state.messages.length,mode:state.view.mode}
 }
 const fork=report['conversation-roundtrip.json'].sessionId
 await command('send',{sessionId:fork,text:'延續目前情景，以一句话回应我。'})
 let state
 await expect.poll(async()=>{state=await command('state',{sessionId:fork});if(state.view.foregroundError)throw new Error(JSON.stringify(state.view.foregroundError));return state.messages.length>report['conversation-roundtrip.json'].messages&&!state.running&&!state.view.activity.busy},{timeout:180000}).toBeTruthy()
 expect(state.view.settleError).toBeNull();await command('audit',{sessionId:fork});report.continuedAfterRestart=true
 await writeFile('artifacts/final-restart-evidence.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await b.close()}
