import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const log=await readFile('artifacts/test-server.log','utf8'),url=log.match(/http:\/\/127\.0\.0\.1:3197\/\?token=[^\s]+/u)[0]
const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext(),p=await c.newPage()
try{await p.goto(url);const sessionId=JSON.parse(await readFile('artifacts/full-engine-smoke.json','utf8')).sessionId
const r=await c.request.post('http://127.0.0.1:3197/api/dsh-tavern/getSession',{data:{sessionId}});const x=await r.json();await writeFile('artifacts/session-view.json',JSON.stringify(x,null,2));console.log(Object.keys(x.view||x));console.log(JSON.stringify(x.view).slice(0,1600));
}finally{await b.close()}
