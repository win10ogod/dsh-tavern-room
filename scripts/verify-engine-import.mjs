import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const root=process.argv[2]||'artifacts/test-data',report=JSON.parse(await readFile(join(root,'engine/room-resource-migration.json'),'utf8'))
let cards=0,worldbooks=0
for(const [id,mapped] of Object.entries(report.cards)){
 if(!id.startsWith('st-card-'))continue
 const old=JSON.parse(await readFile(join(root,'cards',id+'.json'),'utf8'))
 const original=join(root,'engine/originals',mapped.path.replace(/\.json$/i,'.png'))
 const bytes=await readFile(original).catch(()=>null)
 if(!bytes)throw new Error('Original PNG missing for '+mapped.path)
 assert.ok(bytes.equals(await readFile(join(root,'assets',old.asset))));cards++
}
for(const [id,mapped] of Object.entries(report.worldbooks)){
 if(!id.startsWith('st-world-'))continue
 const old=JSON.parse(await readFile(join(root,'worldbooks',id+'.json'),'utf8'))
 const text=await readFile(join(root,'engine/originals',mapped.path),'utf8')
 assert.deepEqual(JSON.parse(text),old.document);worldbooks++
}
console.log(JSON.stringify({cards,worldbooks,originalsPreserved:true}))
