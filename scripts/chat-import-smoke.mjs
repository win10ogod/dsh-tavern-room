import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext(),p=await c.newPage()
try{
 await p.goto(await testHostUrl())
 const rpc=async(method,args={})=>{const x=await (await c.request.post('http://127.0.0.1:3197/api/dsh-tavern/'+method,{data:args})).json();if(!x.ok)throw new Error(x.error);return x}
 const command=async(method,args={})=>{const x=await (await c.request.post('http://127.0.0.1:3197/api/tavern-room-engine',{data:{method,args}})).json();if(!x.ok)throw new Error(x.error);return x}
 const {sessionId}=await command('allocate'),text=[{user_name:'讀者',character_name:'館員',chat_metadata:{}},{name:'館員',is_user:false,mes:'歡迎來到圖書館。'},{name:'讀者',is_user:true,mes:'我想讀一本書。'},{name:'館員',is_user:false,mes:'請看看這本入門指南。'}].map(v=>JSON.stringify(v)).join('\n')
 const input={sessionId,operationId:randomUUID(),cardPath:'cards/full-runtime-fixture.json',fileName:'fixture.jsonl',text}
 await rpc('previewChatImport',input);await rpc('importChatHistory',input)
 const state=await command('state',{sessionId});expect(state.messages.map(m=>m.text)).toEqual(['歡迎來到圖書館。','我想讀一本書。','請看看這本入門指南。'])
 await command('audit',{sessionId});await rpc('importChatHistory',input);expect((await command('state',{sessionId})).messages).toHaveLength(3)
 console.log('chat import, retry, native stored format PASS')
}finally{await b.close()}
