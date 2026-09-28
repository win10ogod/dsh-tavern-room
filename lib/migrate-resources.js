import {readFile,mkdir,writeFile,rename} from 'node:fs/promises'
import {join,basename} from 'node:path'
export async function migrateResources(room,dispatch,dataRoot){
 const file=join(dataRoot,'room-resource-migration.json')
 let report
 try{report=JSON.parse(await readFile(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error;report={version:1,cards:{},worldbooks:{}}}
 const save=async()=>{await mkdir(dataRoot,{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify(report,null,2)+'\n');await rename(temp,file)}
 const worlds=await room.store.list('worldbooks'),cards=await room.store.list('cards')
 const catalog=(await dispatch('listCards',{})).cards
 for(const world of worlds){
  if(world.archived||report.worldbooks[world.id])continue
  const name=basename(world.source?.file||world.name+'.json')
  const existing=(await dispatch('listWorldBooks',{})).standalone?.find(w=>w.path==='worldbooks/'+name)
  const result=existing|| (await dispatch('importWorldBook',{payload:{kind:'text',name,text:JSON.stringify(world.document)}})).worldBook
  report.worldbooks[world.id]={path:result.path||result.source?.path||'worldbooks/'+name};await save()
 }
 for(const card of cards){
  if(card.archived||report.cards[card.id])continue
  const name=basename(card.source?.file||card.id+(card.asset?'.png':'.json'))
  let result=catalog.find(c=>c.path==='cards/'+name.replace(/\.png$/i,'.json'))
  if(!result){
   const bytes=card.asset?await readFile(join(room.store.root,'assets',basename(card.asset))):null
   const payload=bytes?{kind:'png',name,b64:Buffer.from(JSON.stringify(card.card)).toString('base64'),fileB64:bytes.toString('base64')}:{kind:'text',name,text:JSON.stringify(card.card)}
   result=(await dispatch('importCard',{payload})).card
  }
  // Preserve the original embedded book. Only bind external books when the card has none.
  const data=card.card?.data||card.card
  if(!data.character_book&&(card.worldbookIds||[]).length){const sources=card.worldbookIds.map(id=>report.worldbooks[id]).filter(Boolean).map(w=>({kind:'standalone',path:w.path}));if(sources.length)await dispatch('setWorldBookBindings',{cardPath:result.path,sources})}
  report.cards[card.id]={path:result.path};await save()
 }
 return {cards:Object.keys(report.cards).length,worldbooks:Object.keys(report.worldbooks).length}
}
