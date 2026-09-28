import {randomUUID} from 'node:crypto'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {cardData,readPngCard,validateCard,worldEntries,referencedWorlds} from './formats.js'
import {activateWorldbooks} from './worldbooks.js'
import {applyUpdates} from './mvu.js'
export const featureNames={cards:'人物卡',worldbooks:'世界書與提示詞',story:'劇情會話',memory:'卡片記憶',mvu:'MVU 狀態',phone:'角色手機聊天',appearance:'酒館外觀',presets:'酒館預設'}
const live=rows=>rows.filter(x=>!x.archived)
export function featureHandlers(service,key) {
  const store=service.store
  const need=async(collection,id)=>{const value=await store.read(collection,id);if(!value||value.archived)throw new Error('找不到資料');return value}
  if(key==='cards')return {
    list:async()=>live(await store.list('cards')).map(({id,name,asset,worldbookIds,updatedAt,source,card})=>({id,name,asset,worldbookIds,updatedAt,sourceFile:source?.file,embeddedEntries:worldEntries(cardData(card).character_book).length})),
    get:args=>need('cards',args.id),
    save:async args=>{const checked=validateCard(args.card);if(!checked.valid)throw new Error(checked.errors.join('; '));const old=args.id?await need('cards',args.id):{};return store.save('cards',{...old,...args,name:cardData(args.card).name})},
    import:async args=>{
      const bytes=Buffer.from(args.base64,'base64'),isPng=/\.png$/iu.test(args.filename),card=isPng?readPngCard(bytes):JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,'')),checked=validateCard(card)
      if(!checked.valid)throw new Error(checked.errors.join('; '))
      const id=randomUUID(),worlds=await store.list('worldbooks'),names=referencedWorlds(card)
      if(isPng){await mkdir(join(store.root,'assets'),{recursive:true});await writeFile(join(store.root,'assets',id+'.png'),bytes)}
      return store.save('cards',{id,name:cardData(card).name,card,asset:isPng?id+'.png':null,worldbookIds:worlds.filter(w=>names.includes(w.name)).map(w=>w.id)})
    },
    validate:async args=>validateCard(args.card||(await need('cards',args.id)).card),
    delete:args=>store.remove('cards',args.id),
    test:args=>service.engine.testCard(args.id,args.text||'請以角色身份自我介紹。'),
    convert:async args=>{const card=await need('cards',args.id),copy=structuredClone(card.card),data=cardData(copy);data.extensions||={};data.extensions.tavern_room_mvu={version:1,initialState:args.initialState||{},schema:args.schema||{}};return store.save('cards',{...card,card:copy})}
  }
  if(key==='worldbooks')return {
    list:async()=>live(await store.list('worldbooks')).map(({document,...meta})=>({...meta,entries:worldEntries(document).length})),
    get:args=>need('worldbooks',args.id),
    save:args=>{if(!args.name||!args.document||typeof args.document!=='object'||!args.document.entries)throw new Error('世界書需要名稱與 entries');return store.save('worldbooks',{...args,enabled:args.enabled!==false})},
    delete:args=>store.remove('worldbooks',args.id),
    preview:async args=>activateWorldbooks(await Promise.all((args.ids||[]).map(id=>need('worldbooks',id))),{messages:[{text:args.text||''}],variables:args.variables||{}}),
    resources:async()=>live(await store.list('resources')),
    saveResource:args=>{if(!['guide','posture','preset','regex','script'].includes(args.kind))throw new Error('未知資源種類');return store.save('resources',args)},
    deleteResource:args=>store.remove('resources',args.id)
  }
  if(key==='story')return {
    list:async()=>live(await store.list('stories')).map(({turns,...meta})=>({...meta,turnCount:turns?.length||0,busy:service.engine.busy.has(meta.id)})),
    create:async args=>{const card=await need('cards',args.cardId),data=cardData(card.card),opening=args.opening??data.first_mes??'';return store.save('stories',{name:args.name||card.name,cardId:card.id,worldbookIds:card.worldbookIds||[],resourceIds:[],userName:args.userName||'你',turns:[],opening,variables:data.extensions?.tavern_room_mvu?.initialState||{},activationState:{},nativeSessionId:randomUUID(),backgroundSessionId:randomUUID(),model:args.model||null})},
    get:async args=>({...await need('stories',args.id),busy:service.engine.busy.has(args.id)}),
    save:async args=>{const row=await need('stories',args.id);for(const key of ['name','worldbookIds','resourceIds','userName','backgroundEnabled','model'])if(args[key]!==undefined)row[key]=args[key];return store.save('stories',row)},
    send:args=>service.engine.start(args.id,args.text),
    cancel:args=>service.engine.cancel(args.id),
    fork:args=>service.engine.fork(args.id,args.turn,false),
    rollback:args=>service.engine.fork(args.id,args.turn,true),
    delete:async args=>{await service.engine.cancel(args.id);return store.remove('stories',args.id)},
    export:async args=>{const row=await need('stories',args.id);return {name:row.name,text:[row.opening,...row.turns.flatMap(t=>[`${row.userName}：${t.user}`,t.assistant])].join('\n\n')}}
  }
  if(key==='memory')return {
    list:async args=>live(await store.list('memories')).filter(m=>!args.cardId||!m.cardId||m.cardId===args.cardId),
    search:async args=>{const terms=String(args.query||'').toLocaleLowerCase().split(/\s+/u).filter(Boolean);return live(await store.list('memories')).filter(m=>(!m.cardId||m.cardId===args.cardId)&&terms.every(t=>JSON.stringify(m).toLocaleLowerCase().includes(t)))},
    save:args=>{if(!['preference','experience'].includes(args.kind))throw new Error('記憶種類錯誤');if(args.status&&args.status!=='unverified'&&!args.evidence)throw new Error('已驗證經驗需要依據');return store.save('memories',args)},
    delete:args=>store.remove('memories',args.id)
  }
  if(key==='mvu')return {
    rooms:async()=>live(await store.list('stories')).map(({id,name})=>({id,name})),
    get:async args=>{const row=await need('stories',args.id);return {variables:row.variables||{},drafts:row.mvuDrafts||[],revision:row.variableRevision||0}},
    update:args=>store.update('stories',args.id,row=>{if(!row)throw new Error('找不到會話');if(args.revision!==undefined&&args.revision!==(row.variableRevision||0))throw new Error('變數已更新，請重新讀取');return {...row,variables:applyUpdates(row.variables||{},args.updates),variableRevision:(row.variableRevision||0)+1}}),
    draft:args=>store.update('stories',args.id,row=>({...row,mvuDrafts:[...(row.mvuDrafts||[]),{id:randomUUID(),updates:args.updates,createdAt:Date.now()}]})),
    settle:args=>store.update('stories',args.id,row=>{const draft=row.mvuDrafts?.find(d=>d.id===args.draftId);if(!draft)throw new Error('草稿不存在');return {...row,variables:applyUpdates(row.variables||{},draft.updates),variableRevision:(row.variableRevision||0)+1,mvuDrafts:row.mvuDrafts.filter(d=>d.id!==args.draftId)}})
  }
  if(key==='phone')return {
    rooms:async()=>live(await store.list('stories')).map(({id,name})=>({id,name})),
    contacts:async args=>live(await store.list('contacts')).filter(c=>c.storyId===args.storyId),
    saveContact:args=>store.save('contacts',args),
    get:args=>need('contacts',args.id),
    send:args=>service.engine.phone(args.id,args.text),
    delete:args=>store.remove('contacts',args.id)
  }
  if(key==='appearance')return {
    get:async()=>await store.read('settings','appearance')||{theme:'paper',fontSize:16,contentWidth:850},
    save:args=>{if(!['paper','night','terracotta'].includes(args.theme))throw new Error('未知配色');return store.save('settings',{...args,id:'appearance'})}
  }
  if(key==='presets')return {
    get:async()=>await store.read('settings','presets')||{fullAccess:true,shellTimeoutMs:600000,compactRatio:0.5,pruneThreshold:8192,pruneHead:4096,pruneTail:1024,webSearch:true,webFetch:false},
    save:args=>store.save('settings',{...args,id:'presets'})
  }
  throw new Error('Unknown feature')
}
