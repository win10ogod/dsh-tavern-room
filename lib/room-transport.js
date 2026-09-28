import {sessionEvents} from '../vendor/upstream/tavern-plugin/lib/domain/session-events.js'
import {randomUUID} from 'node:crypto'
import {join} from 'node:path'
export function registerRoomTransport(ctx,room) {
 const runtime=()=>ctx.get('tavernFull'), controller=()=>ctx.get('sessionController')
 const command=async(method,args={})=>{
  const engine=runtime(); if(!engine)throw new Error('酒館執行層尚未就緒')
  if(method==='allocate') {
   if(!room.has('story')&&!room.has('cards'))throw new Error('酒館會話功能已關閉')
   const sessionId='tavern-'+randomUUID(),host=controller()
   await host.create({sessionId,...(args.workspaceId?{workspaceId:args.workspaceId}:{cwd:join(engine.dataRoot,'resources')}),agentPreset:'tavern'})
   const settings=(await engine.dispatch('getTavernSettings',{})).settings
   if(settings.defaultForegroundModel)host.agents.selectForNextRequest(ctx.agents.get(sessionId),settings.defaultForegroundModel)
   return {sessionId}
  }
  if(method==='preset') {
   const resolved=await controller().resolveAgent(args.sessionId);if(resolved.error)throw resolved.error
   const agent=resolved.agent||ctx.agents.get(args.sessionId)
   const selected=agent.session.snapshotEvents().findLast(event=>event.type==='agent-preset/selected')?.data.agentPreset||agent.session.header.agentPreset
   if(selected!=='tavern')await ctx.agentPresets.select(agent,'tavern')
   return {agentPreset:'tavern'}
  }
  if(method==='create') {
   if(!room.has(args.mode==='card'?'cards':'story'))throw new Error('此酒館功能已關閉')
   const sessionId='tavern-'+randomUUID(),host=controller()
   const settings=(await engine.dispatch('getTavernSettings',{})).settings
   const selection=args.model||settings.defaultForegroundModel||ctx.agentDefaultModel.currentSelection()
   await host.create({sessionId,cwd:join(engine.dataRoot,'resources'),agentPreset:'tavern'})
   if(selection)host.agents.selectForNextRequest(ctx.agents.get(sessionId),selection)
   await engine.dispatch('preparePlayStart',{})
   const result=await engine.dispatch('startChat',{...args,sessionId,requestMode:args.requestMode||'dsh',mode:args.mode||'story'})
   return {...result,sessionId}
  }
  if(method==='audit') {
   if(!await engine.chatForSession(args.sessionId))throw new Error('找不到酒館對話')
   const session=ctx.sessions.get(args.sessionId)
   if(session)await ctx.sessions.flush(session)
   const handle=await ctx.get('sessionPersistence').open(args.sessionId,'read')
   try{const result=await handle.read(0);return {valid:true,events:result.events.length}}
   finally{await handle.close()}
  }
  if(method==='fork') {
   if(!room.has('story'))throw new Error('劇情會話功能已關閉')
   const plan=await engine.dispatch('prepareConversationFork',args)
   const created=await controller().fork({sessionId:args.sessionId,atSeq:plan.atSeq})
   const result=await engine.dispatch('forkChat',{...args,targetSessionId:created.sessionId,turn:plan.turn,atSeq:plan.atSeq,sourceRevision:plan.sourceRevision})
   return {...result,sessionId:created.sessionId}
  }
  if(method==='state') {
   if(!await engine.chatForSession(args.sessionId))throw new Error('找不到酒館對話')
   if(!ctx.agents.get(args.sessionId)){const resumed=await controller().resolveAgent(args.sessionId);if(resumed.error)throw resumed.error}
   const result=await engine.dispatch('getSession',{sessionId:args.sessionId})
   if(!result.view)throw new Error('找不到酒館對話')
   const chat=await engine.chatForSession(args.sessionId)
   let messages=chat?.messages||[]
   if(result.view.mode==='card'){
    const session=ctx.agents.get(args.sessionId)?.session
    const events=sessionEvents(session),surface=new Set(session?.surface.nodes||[])
    messages=events.filter(event=>surface.has(event.seq)).flatMap(event=>{
     const message=event.type==='user/message'?event.data:event.data?.message
     if(event.type==='user/message'&&message?.source?.kind!=='user')return []
     if(!['user/message','assistant/message','tool/result'].includes(event.type)||message?.source?.model==='synthetic-trajectory')return []
     return [{id:message.id,role:message.role,text:(message.content||[]).filter(block=>block.type==='text').map(block=>block.text).join('\n'),blocks:message.content,turn:event.data.turn,toolCallId:message.toolCallId}]
    })
   }
   return {...result,messages,running:ctx.agents.get(args.sessionId)?.phase?.kind==='running'}
  }
  if(method==='send'||method==='cancel') {
   if(!room.has('story'))throw new Error('劇情會話功能已關閉')
   const result=await engine.dispatch('getSession',{sessionId:args.sessionId})
   if(!result.view)throw new Error('找不到酒館對話')
   if(method==='cancel'){await controller().cancel({sessionId:args.sessionId});return {cancelled:true}}
   if(typeof args.text!=='string'||!args.text.trim())throw new Error('請輸入內容')
   await controller().prompt({sessionId:args.sessionId,requestId:randomUUID(),content:[{type:'text',text:args.text}],mode:'followup'},new AbortController().signal)
   return {accepted:true}
  }
  throw new Error('未知酒館操作')
 }
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/tavern-room-engine',methods:['POST'],requestBody:'buffered',fetch:async request=>{
  try{const {method,args}=await request.json();return Response.json({ok:true,...await command(method,args)})}
  catch(error){return Response.json({ok:false,error:error.message},{status:400})}
 }}))
 ctx.effect(()=>ctx.webServer.register({path:'/api/tavern-room-signals',kind:'prefix',handler:async(req,res)=>{
  const denied=ctx.connection.requestRejection(req)
  if(denied){res.writeHead(denied);res.end();return}
  if(req.method!=='GET'){res.writeHead(405);res.end();return}
  const sessionId=new URL(req.url,'http://localhost').searchParams.get('sessionId')
  const signals=ctx.get('tavernSessionSignals')
  if(!signals||!sessionId){res.writeHead(400);res.end();return}
  const abort=new AbortController();res.on('close',()=>abort.abort())
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'})
  res.write(': connected\n\n')
  const timer=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n')},15000)
  try{for await(const item of signals.follow([sessionId],abort.signal)){if(res.destroyed)break;res.write('data: '+JSON.stringify(item)+'\n\n')}}
  finally{clearInterval(timer);res.end()}
 }}))
}
