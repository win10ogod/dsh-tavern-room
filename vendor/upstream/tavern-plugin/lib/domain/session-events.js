let findOwner=()=>undefined
export function configureSessionOwners(resolve){findOwner=resolve}
const projectedEvents=new WeakMap()
function presentEvents(events){
 if(projectedEvents.has(events))return projectedEvents.get(events)
 const mapped=events.map(event=>{
  if(event.type==='user/message'&&event.data?.source?.kind==='dsh-tavern'&&['assistant-surface','surface-message'].includes(event.data.source.form)){
   return Object.freeze({...event,type:event.data.source.eventType||'assistant/message',data:event.data.source.assistantEvent})
  }
  if(event.data?.tavernSurfaceTurn===undefined)return event
  const {tavernSurfaceTurn,tavernSurfaceStep,...data}=event.data
  return Object.freeze({...event,data:Object.freeze({...data,turn:tavernSurfaceTurn,step:tavernSurfaceStep})})
 })
 const result=mapped.every((value,index)=>value===events[index])?events:Object.freeze(mapped)
 if(Object.isFrozen(events))projectedEvents.set(events,result)
 return result
}
export function sessionCoordinates(session){
 const events=typeof session.snapshotEvents==='function'?session.snapshotEvents():session.events||[]
 let turn=null,step=null,nextTurn=1,nextStep=1
 for(const event of events){
  if(event.type==='turn/start'){turn=event.data.turn;nextStep=1}
  if(event.type==='step/start')step=event.data.step
  if(event.type==='step/end'){step=null;nextStep=event.data.step+1}
  if(event.type==='turn/end'){turn=null;step=null;nextTurn=event.data.turn+1}
 }
 return {turn,step,nextTurn,nextStep}
}
function synchronizeOwner(session,turn){const agent=findOwner(session.id);if(agent?.session===session&&agent.phase?.kind==='idle')agent.phase.lastTurn=Math.max(agent.phase.lastTurn||0,turn)}
export function startInitialSessionTurn(session){
 const state=sessionCoordinates(session)
 if(state.turn!==null)return state
 if(state.nextTurn!==1)throw new Error('初始對話已被其他回合推進')
 session.append('turn/start',{turn:1});session.append('step/start',{turn:1,step:1})
 return {turn:1,step:1,nextTurn:1,nextStep:1}
}
export function finishInitialSessionTurn(session){
 const state=sessionCoordinates(session)
 if(state.turn===null)return
 if(state.turn!==1||state.step!==1)throw new Error('初始對話座標已變更')
 session.append('step/end',{turn:1,step:1});session.append('turn/end',{turn:1,reason:{kind:'completed'}});synchronizeOwner(session,1)
}
// DSH rc.1 exposes immutable history through snapshotEvents(); older hosts
// expose events. Keep version differences here, without changing the Session.
export function sessionEvents(session) {
  if (!session) return []
  if (typeof session.snapshotEvents === 'function') return presentEvents(session.snapshotEvents())
  return Array.isArray(session.events) ? session.events : []
}

// V3 compaction pins only surface node zero. Reserve the host's empty system
// slot before Tavern seeds, so the first real Agent step fills that same slot.
// Existing surfaces are never reordered or rewritten.
export function ensureSessionSystemHead(session) {
  if (!(session?.header?.version >= 3) || session.surface.nodes.length > 0) return
  appendSessionEvent(session, 'system/message', { turn: 1, step: 1, message: {
    id: 'tavern-system-head:' + session.id, role: 'system', content: [],
    source: { kind: 'system-prompt' }
  } }, { surfaceOp: 'append' })
}

// Normalize only new writes at the host boundary. Existing events, seqs and
// provenance stay untouched; V3 migrations remain owned by DSH.
export function sessionEventData(session, type, data) {
  return session?.header?.version >= 3 && type === 'assistant/message' && data.stream === undefined
    ? { ...data, stream: [] } : data
}

export function appendSessionEvent(session, type, data, intent) {
  if (session?.header?.version >= 3) {
    if (intent) {
      intent = { ...intent }
      const op = intent.surfaceOp
      if (op && typeof op === 'object' && op.op === 'replace' && 'start' in op) {
        intent.surfaceOp = { op: 'replace', startSeq: op.start, endSeq: op.end }
      }
      if (type === 'assistant/message' && intent.surfaceOp === 'append') delete intent.sourceEventSeqs
    }
  }
  data = sessionEventData(session, type, data)
  if(session?.header?.version>=4&&['assistant/message','tool/result'].includes(type)&&intent?.surfaceOp&&intent.surfaceOp!=='append'){
   return presentEvents(Object.freeze([session.append('user/message',{id:data.message.id,role:'user',content:[],source:{kind:'dsh-tavern',form:'surface-message',eventType:type,assistantEvent:data}},intent)]))[0]
  }
  const coordinated=session?.header?.version>=4&&['system/message','assistant/message','tool/result'].includes(type)
  if(!coordinated)return intent===undefined?session.append(type,data):session.append(type,data,intent)
  const current=sessionCoordinates(session)
  const ownedTurn=current.turn===null,ownedStep=current.step===null
  const turn=current.turn??current.nextTurn,step=current.step??(ownedTurn?1:current.nextStep)
  if(ownedTurn)session.append('turn/start',{turn})
  if(ownedStep)session.append('step/start',{turn,step})
  const mapped={...data,turn,step}
  if(intent?.surfaceOp&&intent.surfaceOp!=='append'&&(data.turn!==turn||data.step!==step)){
   mapped.tavernSurfaceTurn=data.turn;mapped.tavernSurfaceStep=data.step
  }
  try{return intent===undefined?session.append(type,mapped):session.append(type,mapped,intent)}
  finally{
   if(ownedStep)session.append('step/end',{turn,step})
   if(ownedTurn){session.append('turn/end',{turn,reason:{kind:'completed'}});synchronizeOwner(session,turn)}
  }
}

export function surfaceReplacementRange(op) {
  return { start: op.startSeq ?? op.start, end: op.endSeq ?? op.end }
}

export function projectTavernSurfaceMessages(messages){
 return messages.flatMap(message=>{
  if(message?.source?.kind!=='dsh-tavern'||!['assistant-surface','surface-message'].includes(message.source.form))return [message]
  const restored=message.source.assistantEvent?.message
  if(!restored||!['assistant','tool'].includes(restored.role)||!Array.isArray(restored.content))throw new Error('酒館正文編輯記錄無效')
  return restored.content.length?[restored]:[]
 })
}

export function rawSessionEvents(session){return typeof session.snapshotEvents==='function'?session.snapshotEvents():session.events||[]}
