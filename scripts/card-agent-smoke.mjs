import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext(),p=await c.newPage()
try{
 await p.goto(await testHostUrl())
 const command=async(method,args)=>{const r=await c.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method,args}});const x=await r.json();if(!x.ok)throw new Error(x.error);return x}
 const {sessionId}=await command('create',{path:'cards/full-runtime-fixture.json',mode:'card',cardTask:'edit'})
 await command('send',{sessionId,text:'請只呼叫 tavern_validate_card 檢查目前這張人物卡，然後用一句話說明結果，不要修改檔案。'})
 let state
 await expect.poll(async()=>{state=await command('state',{sessionId});if(state.view.foregroundError)throw new Error(JSON.stringify(state.view.foregroundError));return !state.running&&state.messages.some(m=>m.role==='assistant')},{timeout:180000}).toBeTruthy()
 expect(state.messages.some(m=>m.blocks?.some(b=>b.type==='tool-call'&&b.name==='tavern_validate_card'))).toBeTruthy()
 expect(state.messages.some(m=>m.role==='tool')).toBeTruthy()
 await command('audit',{sessionId});await writeFile('artifacts/card-agent-evidence.json',JSON.stringify({sessionId,messages:state.messages},null,2));console.log('card Agent, native tools, transcript, stored format PASS')
}finally{await b.close()}
