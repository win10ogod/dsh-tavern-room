import { inflateSync } from 'node:zlib'
export function cardData(card) {return card?.data&&typeof card.data==='object'?card.data:card}
export function validateCard(card) {
  const data=cardData(card),errors=[]
  if(!data||typeof data!=='object'||Array.isArray(data))return {valid:false,errors:['人物卡必須是 JSON 物件']}
  if(typeof data.name!=='string'||!data.name.trim())errors.push('人物卡缺少 name')
  for(const key of ['description','personality','scenario','first_mes','mes_example','system_prompt','post_history_instructions'])if(data[key]!==undefined&&typeof data[key]!=='string')errors.push(key+' 必須是字串')
  return {valid:errors.length===0,errors}
}
export function readPngCard(buffer) {
  if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Not a PNG')
  const metadata=new Map()
  for(let offset=8;offset+12<=buffer.length;) {
    const size=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),end=offset+12+size
    if(end>buffer.length)throw new Error('Truncated PNG chunk')
    const payload=buffer.subarray(offset+8,offset+8+size),zero=payload.indexOf(0)
    if(zero>=0&&['tEXt','zTXt','iTXt'].includes(type)) {
      const key=payload.toString('latin1',0,zero)
      if(['chara','ccv3'].includes(key)) {
        let body
        if(type==='tEXt')body=payload.subarray(zero+1)
        else if(type==='zTXt')body=inflateSync(payload.subarray(zero+2))
        else {
          const compressed=payload[zero+1],langEnd=payload.indexOf(0,zero+3),translatedEnd=payload.indexOf(0,langEnd+1)
          if(langEnd<0||translatedEnd<0)throw new Error('Invalid iTXt metadata')
          body=payload.subarray(translatedEnd+1);if(compressed)body=inflateSync(body)
        }
        metadata.set(key,JSON.parse(Buffer.from(body.toString('utf8'),'base64').toString('utf8')))
      }
    }
    offset=end
  }
  const card=metadata.get('ccv3')||metadata.get('chara')
  if(!card)throw new Error('PNG has no character card metadata')
  return card
}
export function worldEntries(world) {
  const entries=world?.entries??world?.data?.entries??[]
  return (Array.isArray(entries)?entries:Object.values(entries)).filter(v=>v&&typeof v==='object')
}
export function referencedWorlds(card) {
  const data=cardData(card),ext=data?.extensions||{},names=[]
  if(typeof ext.world==='string'&&ext.world)names.push(ext.world)
  for(const value of ext.extra_worlds||[])if(typeof value==='string')names.push(value)
  return [...new Set(names)]
}
export function expandMacros(text,{char='',user='你',variables={}}={}) {
  return String(text??'').replace(/\{\{(char|user)\}\}/giu,(_,key)=>key.toLowerCase()==='char'?char:user)
    .replace(/\{\{getvar::([^}]+)\}\}/gu,(_,key)=>String(variables[key]??''))
}
export function applyRegex(text,scripts,placement,context={}) {
  let value=String(text);const diagnostics=[]
  for(const script of scripts||[]) {
    if(script.disabled)continue
    if(context.phase==='prompt'&&script.markdownOnly&&!script.promptOnly)continue
    if(context.phase==='display'&&script.promptOnly&&!script.markdownOnly)continue
    if(Array.isArray(script.placement)&&!script.placement.includes(placement))continue
    const expression=String(script.findRegex||'');if(!expression)continue
    try {const match=/^\/(.*)\/([a-z]*)$/su.exec(expression);value=value.replace(new RegExp(match?match[1]:expression,match?match[2]:'g'),expandMacros(script.replaceString||'',context))}
    catch(error){diagnostics.push({script:script.scriptName||script.id||'',error:error.message})}
  }
  return {text:value,diagnostics}
}
