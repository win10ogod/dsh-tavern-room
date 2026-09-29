import test from 'node:test'
import assert from 'node:assert/strict'
import {createWorldBookLibrary} from '../vendor/upstream/tavern-plugin/lib/domain/worldbook-library.js'
import {constantWorldBookContext} from '../vendor/upstream/tavern-plugin/lib/domain/worldbook-recall.js'
import {createPlayCardSnapshots} from '../vendor/upstream/tavern-plugin/lib/domain/play-card-snapshots.js'

function fixture(){
 const source={kind:'standalone',path:'worldbooks/shared.json'},other={kind:'standalone',path:'worldbooks/other.json'}
 const document={name:'Shared',entries:{0:{uid:0,comment:'shared rule',content:'GLOBAL_RULE',key:['trigger'],constant:false,disable:false},1:{uid:1,comment:'off',content:'DISABLED_RULE',constant:false,disable:true}}}
 const documents=new Map([[source.path,structuredClone(document)],[other.path,{name:'Other',entries:{0:{uid:0,content:'OTHER',key:[],constant:true,disable:false}}}]])
 const cards=new Map([['cards/a.json',{name:'A'}],['cards/b.json',{name:'B'}]])
 const bindings=new Map();let saved
 const options={normalizePath(path){if(typeof path!=='string'||!path.endsWith('.json'))throw Error('Invalid path');return path},
  globalStore:{async read(){return structuredClone(saved)},async write(value){saved=structuredClone(value)}},
  resources:{list:async()=>[...documents.keys()],readText:async p=>documents.has(p)?JSON.stringify(documents.get(p)):undefined,
   bindingForCard:async p=>({kind:'multiple',sources:(bindings.get(p)||[]).map(s=>({...s,available:true}))}),
   bindMany:async(p,ss)=>bindings.set(p,ss),unbind:async p=>bindings.delete(p)},
  cards:{read:async p=>cards.get(p),listPaths:async()=>[...cards.keys()],update:async(p,v)=>cards.set(p,{...cards.get(p),...v})},
  removeStandalone:async p=>{documents.delete(p);await library.removeGlobalPath(p);return {removed:p}}}
 const library=createWorldBookLibrary(options)
 return {library,source,other,documents,cards,options}
}
test('global books apply to every card, retain triggers, and deduplicate local bindings',async()=>{
 const {library,source,cards}=fixture()
 assert.equal(await library.bound('cards/a.json'),null)
 await library.setGlobal(source,{enabled:true,alwaysOn:false})
 await library.bind('cards/a.json',source)
 cards.set('cards/future.json',{name:'Future'})
 for(const path of cards.keys()){
  const book=await library.bound(path)
  assert.equal(book.view.entries.length,2)
  assert.equal(constantWorldBookContext({worldBook:book}).context.includes('GLOBAL_RULE'),false)
 }
 assert.equal((await library.associations(source)).global.enabled,true)
})
test('whole-book residency preserves disabled entries and does not rewrite the resource',async()=>{
 const {library,source,documents,options}=fixture()
 await library.setGlobal(source,{enabled:true,alwaysOn:true})
 const book=await createWorldBookLibrary(options).bound('cards/b.json')
 const context=constantWorldBookContext({worldBook:book}).context
 assert.ok(context.includes('GLOBAL_RULE'));assert.ok(!context.includes('DISABLED_RULE'))
 assert.equal(documents.get(source.path).entries[0].constant,false)
 await library.setGlobal(source,{enabled:false,alwaysOn:false})
 assert.equal(await library.bound('cards/b.json'),null)
})
test('concurrent selections persist independently and rename/delete keep references valid',async()=>{
 const {library,source,other,documents}=fixture()
 await Promise.all([library.setGlobal(source,{enabled:true,alwaysOn:false}),library.setGlobal(other,{enabled:true,alwaysOn:true})])
 assert.equal((await library.globalBooks()).length,2)
 const next='worldbooks/renamed.json';documents.set(next,documents.get(source.path));documents.delete(source.path)
 await library.renameGlobal(source.path,next)
 assert.equal((await library.bound('cards/a.json')).view.entries.length,3)
 await library.remove({kind:'standalone',path:next})
 assert.equal((await library.globalBooks()).length,1)
 await assert.rejects(library.setGlobal({kind:'standalone',path:'worldbooks/missing.json'},{enabled:true,alwaysOn:false}),/不存在/)
 assert.equal((await library.globalBooks()).length,1)
})
test('saved conversations retain snapshots until explicit reload and then receive global rules',async()=>{
 const {library,source,cards}=fixture(),card=cards.get('cards/a.json')
 const snapshots=createPlayCardSnapshots({worldBooks:library,planner:{plan:async input=>({text:input.card.name+'\n'+input.worldBookContext})},readCard:async()=>card,writeChat:async draft=>draft})
 const chat={id:'chat',cardPath:'cards/a.json',mode:'story',openingWorldbookSnapshot:{version:1,source:null,document:null},messages:[]}
 await snapshots.prepare(chat,card)
 await library.setGlobal(source,{enabled:true,alwaysOn:true})
 assert.equal(await library.bound(chat.cardPath,card,chat),null)
 assert.equal((await snapshots.ensure(chat)).includes('GLOBAL_RULE'),false)
 const update=await snapshots.updateStatus(chat,card)
 assert.equal(update.worldbookChanged,true)
 Object.assign(chat,await snapshots.replacement(chat,card,update.digest))
 assert.ok(chat.cardContextSnapshot.includes('GLOBAL_RULE'))
 await library.setGlobal(source,{enabled:false,alwaysOn:false})
 const removed=await snapshots.updateStatus(chat,card)
 Object.assign(chat,await snapshots.replacement(chat,card,removed.digest))
 assert.equal(chat.cardContextSnapshot.includes('GLOBAL_RULE'),false)
})
