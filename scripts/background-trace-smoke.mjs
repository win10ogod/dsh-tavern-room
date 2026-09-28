import {testHostUrl} from './await-test-host.mjs'
import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext(),p=await c.newPage(),errors=[]
p.on('pageerror',e=>errors.push(e.message))
try{
 await p.goto(await testHostUrl());try{await p.getByRole('button',{name:'继续',exact:true}).click({timeout:1500})}catch{}
 await p.getByRole('button',{name:'酒館',exact:true}).click();const f=p.frameLocator('iframe[title="酒館"]')
 await f.locator('.room-nav').getByRole('button',{name:'對話',exact:true}).click()
 const saved=JSON.parse(await readFile('artifacts/conversation-roundtrip.json','utf8'))
 await f.getByRole('combobox',{name:'選擇對話'}).selectOption(saved.forkSessionId)
 await expect(f.locator('.dsh-tavern-candidate-question')).toBeVisible({timeout:30000})
 await f.locator('.dsh-tavern-candidate-question .dsh-tavern-question-head').click()
 const trace=f.getByRole('button',{name:/^查看后台 Agent/});await expect(trace).toBeVisible({timeout:30000});await trace.click()
 await expect(p.locator('iframe[title="酒館"]')).toHaveCount(0,{timeout:30000});expect(errors).toEqual([])
 await writeFile('artifacts/background-trace-evidence.json',JSON.stringify({opened:true,errors},null,2));console.log('persisted candidates and native background trace navigation PASS')
}finally{await b.close()}
