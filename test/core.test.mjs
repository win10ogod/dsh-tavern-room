import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Store} from '../lib/store.js'
import {readPngCard,validateCard,referencedWorlds} from '../lib/formats.js'
import {activateWorldbooks} from '../lib/worldbooks.js'
import {applyUpdates} from '../lib/mvu.js'
import {featureHandlers} from '../lib/features.js'
test('PNG import preserves full character metadata and unknown extension fields',()=>{
 const card={spec:'chara_card_v2',data:{name:'測試',description:'中文',extensions:{world:'世界',custom:{precise:'9007199254740993'}},character_book:{entries:[{content:'內嵌',keys:['詞']}]}}}
 const text=Buffer.from('chara\0'+Buffer.from(JSON.stringify(card)).toString('base64')),chunk=Buffer.alloc(text.length+12);chunk.writeUInt32BE(text.length);chunk.write('tEXt',4);text.copy(chunk,8)
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk])
 assert.deepEqual(readPngCard(png),card);assert.equal(validateCard(card).valid,true);assert.deepEqual(referencedWorlds(card),['世界'])
 assert.throws(()=>readPngCard(png.subarray(0,-3)),/Truncated/)
})
test('atomic writes serialize simultaneous changes and archive retains records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tavern-test-')),store=new Store(dir)
 try {await store.save('test',{id:'one',count:0});await Promise.all(Array.from({length:20},()=>store.update('test','one',x=>({...x,count:x.count+1}))));assert.equal((await store.read('test','one')).count,20);await store.remove('test','one');assert.equal((await store.read('test','one')).archived,true);assert.throws(()=>store.path('test','../../escape'))}finally{await rm(dir,{recursive:true,force:true})}
})
test('worldbook activation retains constants, secondary logic, disabled state and recursion',()=>{
 const worlds=[{id:'w',document:{entries:{a:{uid:1,constant:true,content:'seed'},b:{uid:2,key:['seed'],content:'nested'},c:{uid:3,key:['Hello'],keysecondary:['world'],selective:true,content:'matched'},d:{uid:4,constant:true,disable:true,content:'disabled'}}}}]
 const a=activateWorldbooks(worlds,{messages:[{text:'Hello world'}]});assert.deepEqual(new Set(a.entries.map(e=>e.content)),new Set(['seed','nested','matched']))
 const b=activateWorldbooks(worlds,{messages:[{text:'Hello'}]});assert.ok(!b.entries.some(e=>e.content==='matched'))
})
test('MVU updates are atomic, respect escaped pointers, and reject unsafe/index/type edits',()=>{
 const source={hp:5,items:['a','b'],'x/y':0}
 const next=applyUpdates(source,[{op:'delta',path:'/hp',value:-2},{op:'add',path:'/items/1',value:'c'},{op:'replace',path:'/x~1y',value:7}])
 assert.deepEqual(next,{hp:3,items:['a','c','b'],'x/y':7});assert.deepEqual(source,{hp:5,items:['a','b'],'x/y':0})
 assert.throws(()=>applyUpdates(source,[{op:'add',path:'/__proto__/bad',value:1}]))
 assert.throws(()=>applyUpdates(source,[{op:'replace',path:'/items/99',value:'bad'}]))
 assert.throws(()=>applyUpdates(source,[{op:'test',path:'/hp',value:2},{op:'remove',path:'/hp'}]))
})
test('memory validation requires evidence and preserves card scope',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tavern-memory-')),service={store:new Store(dir)}
 try{const h=featureHandlers(service,'memory');assert.throws(()=>h.save({kind:'experience',status:'runtime-verified',content:'x'}),/依據/);await h.save({kind:'preference',content:'中文',cardId:'a'});await h.save({kind:'preference',content:'共用'});assert.equal((await h.search({cardId:'b',query:''})).length,1)}finally{await rm(dir,{recursive:true,force:true})}
})
