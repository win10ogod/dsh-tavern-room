import {chromium} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const log=await readFile(new URL('../artifacts/test-server.log',import.meta.url),'utf8'),url=log.match(/http:\/\/127\.0\.0\.1:3197\/\?token=[^\s]+/u)[0]
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage()
try {
 await page.goto(url)
 const call=async(method,args={})=>{const r=await context.request.post('http://127.0.0.1:3197/api/dsh-tavern/'+method,{data:args});const x=await r.json();if(!x.ok)throw new Error(method+': '+JSON.stringify(x));return x}
 const card={spec:'chara_card_v2',spec_version:'2.0',data:{name:'完整執行層測試',description:'You are a friendly librarian. Answer very briefly.',personality:'helpful',scenario:'library',first_mes:'<div id="runtime-check">Loading</div><script>document.getElementById("runtime-check").textContent="JavaScript 已執行";</script>',mes_example:'',creator_notes:'',system_prompt:'',post_history_instructions:'',alternate_greetings:[],tags:[],extensions:{}}}
 const existing=(await call('listCards')).cards.find(c=>c.path==='cards/full-runtime-fixture.json')
 const imported=existing?{card:existing}:await call('importCard',{payload:{kind:'text',name:'full-runtime-fixture.json',text:JSON.stringify(card)}})
 console.log('card',imported.card.path)
 const created=await call('gameplay.create',{sourceCard:imported.card.path.split('/').at(-1),model:{provider:'vllm',model:'EVE-27B'}})
 await writeFile(new URL('../artifacts/full-engine-smoke.json',import.meta.url),JSON.stringify(created,null,2))
 console.log(JSON.stringify({ok:created.ok,sessionId:created.sessionId,error:created.error,chatKeys:Object.keys(created.chat||{})}))
}finally{await browser.close()}
