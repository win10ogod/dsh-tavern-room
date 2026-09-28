import {worldEntries,expandMacros,cardData} from './formats.js'
const values=value=>Array.isArray(value)?value:typeof value==='string'?[value]:[]
function matches(key,text,entry) {
  if(typeof key!=='string'||!key)return false
  if(entry.use_regex||/^\/.+\/[gimsuy]*$/su.test(key)) {
    const m=/^\/(.*)\/([gimsuy]*)$/su.exec(key)
    return new RegExp(m?m[1]:key,m?m[2]:entry.caseSensitive?'u':'iu').test(text)
  }
  const a=entry.caseSensitive?text:text.toLocaleLowerCase(),b=entry.caseSensitive?key:key.toLocaleLowerCase()
  if(!entry.matchWholeWords)return a.includes(b)
  return new RegExp('(?<![\\p{L}\\p{N}_])'+b.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')+'(?![\\p{L}\\p{N}_])','u').test(a)
}
export function activateWorldbooks(worlds,{messages=[],card,user='你',variables={},state={},turn=0,random=Math.random}={}) {
  const activated=[],diagnostics=[],next=structuredClone(state),data=cardData(card)||{}
  const entries=worlds.flatMap(w=>worldEntries(w.document??w).map((e,i)=>({world:w.id||w.name||'embedded',entry:e,id:String(e.uid??e.id??i)})))
  let recursive='';const selected=new Set()
  for(let pass=0;pass<=entries.length;pass++) {
    let added=false
    for(const item of entries) {
      const {entry:e}=item,key=item.world+':'+item.id;if(selected.has(key)||e.disable||e.enabled===false)continue
      const ext={...e.extensions,...e},previous=next[key]||{}
      if(pass>0&&(ext.excludeRecursion||ext.preventRecursion))continue
      if(ext.delayUntilRecursion&&pass===0)continue
      const scanDepth=ext.scanDepth??2
      const scanned=messages.slice(-scanDepth).map(m=>m.text??m.content??'').join('\n')+(pass? '\n'+recursive:'')
      let text=scanned
      for(const [flag,field] of [['matchCharacterDescription','description'],['matchCharacterPersonality','personality'],['matchScenario','scenario'],['matchCreatorNotes','creator_notes']])if(ext[flag])text+='\n'+(data[field]||'')
      if(previous.cooldownUntil>turn&&!(previous.stickyUntil>=turn))continue
      if(ext.delay&&turn<Number(ext.delay))continue
      let active=e.constant||previous.stickyUntil>=turn
      try {
        if(!active) {
          active=values(e.key??e.keys).some(k=>matches(k,text,ext))
          const secondary=values(e.keysecondary??e.secondary_keys)
          if(active&&(e.selective||e.selectiveLogic!==undefined)&&secondary.length){const hit=secondary.map(k=>matches(k,text,ext));const logic=Number(e.selectiveLogic??0);active=logic===0?hit.some(Boolean):logic===1?!hit.every(Boolean):logic===2?!hit.some(Boolean):hit.every(Boolean)}
        }
      }catch(error){diagnostics.push({entry:key,error:error.message});continue}
      if(!active)continue
      if(ext.useProbability!==false&&e.probability!==undefined&&random()*100>Number(e.probability))continue
      selected.add(key);added=true
      const content=expandMacros(e.content,{char:data.name,user,variables})
      activated.push({key,world:item.world,id:item.id,comment:e.comment||e.name||'',content,order:Number(e.order??e.insertion_order??100),position:e.position??e.extensions?.position??0,role:e.role??e.extensions?.role,depth:e.depth??e.extensions?.depth,group:ext.group||'',groupWeight:ext.groupWeight??100,groupOverride:ext.groupOverride===true})
      next[key]={stickyUntil:turn+Math.max(0,Number(ext.sticky||0))-1,cooldownUntil:turn+Math.max(0,Number(ext.cooldown||0))}
      if(!ext.preventRecursion)recursive+='\n'+content
    }
    if(!added)break
  }
  const byGroup=new Map(),chosen=[]
  for(const row of activated) {if(!row.group)chosen.push(row);else {const list=byGroup.get(row.group)||[];list.push(row);byGroup.set(row.group,list)}}
  for(const list of byGroup.values()) {
    const override=list.filter(x=>x.groupOverride).sort((a,b)=>b.order-a.order)
    if(override.length){chosen.push(override[0]);continue}
    let pick=random()*list.reduce((n,x)=>n+Math.max(0,Number(x.groupWeight)),0)
    chosen.push(list.find(x=>(pick-=Math.max(0,Number(x.groupWeight)))<=0)||list[0])
  }
  chosen.sort((a,b)=>a.order-b.order)
  return {entries:chosen,state:next,diagnostics}
}
