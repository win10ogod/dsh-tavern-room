import {appearancePanel} from './appearance.js'
const React=window.parent.__TavernRoomLibraries.react,DOM=window.parent.__TavernRoomLibraries['react-dom/client']
const nativeHost=window.parent.__TavernRoomLibraries.host
const h=React.createElement,C=window.TavernCompatibility,P=C.port
const originalRpc=P.rpc
async function api(method,args={}){
 const response=await fetch('/api/tavern-room-engine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})})
 const body=await response.text();let value
 try{value=JSON.parse(body)}catch{throw new Error('酒館服務回應不完整（HTTP '+response.status+'），請重新載入插件。')}
 if(!response.ok||!value.ok)throw new Error(value.error||'HTTP '+response.status)
 return value
}
const retained=new Map()
async function retainSession(id){
 if(retained.has(id))return retained.get(id).ready
 await nativeHost.sessions.refresh()
 if(!retained.has(id))retained.set(id,nativeHost.sessions.retain(id,{source:'tavern-room'}))
 return retained.get(id).ready
}
const sessionAdapter=new Proxy(nativeHost.sessions,{get(target,key){
 if(key==='open')return id=>{void retainSession(id).then(()=>window.dispatchEvent(new CustomEvent('tavern-room-selected',{detail:{sessionId:id}}))).catch(error=>window.dispatchEvent(new CustomEvent('tavern-room-error',{detail:error.message})))}
 if(key==='refreshSubagents')return id=>target.using(id,{source:'tavern-catalog'},async()=>{await target.refresh()})
 if(key==='openSubagent')return address=>nativeHost.get('uiWorkspace').openSession(address)
 if(key==='clear')return()=>window.dispatchEvent(new CustomEvent('tavern-room-selected',{detail:{sessionId:''}}))
 if(key==='create')return async options=>{const result=await api('allocate',options);await retainSession(result.sessionId);return result.sessionId}
 if(key==='fork')return async options=>{const id=await target.fork(options);await retainSession(id);return id}
 const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value
}})
const host=new Proxy(nativeHost,{get(target,key){if(key==='sessions')return sessionAdapter;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}})
window.addEventListener('pagehide',()=>{for(const value of retained.values())value.release();retained.clear()},{once:true})
async function sessionInput(id){await retainSession(id);return host.get('conversation').input.for(host.sessions.scope(id))}
const connections=new Map()
const signals={subscribe(sessionId,kinds,onData,onError,onReconnect){
 let record=connections.get(sessionId)
 if(!record){const source=new EventSource('/api/tavern-room-signals?sessionId='+encodeURIComponent(sessionId));record={source,listeners:new Set()};connections.set(sessionId,record)
 source.onmessage=e=>{const item=JSON.parse(e.data);for(const signal of item.signals||[item.signal])if(signal)for(const sub of record.listeners)if(sub.kinds.includes(signal.kind))sub.onData(signal)}
 source.onerror=error=>{for(const sub of record.listeners)sub.onError?.(error)}
 source.onopen=()=>{for(const sub of record.listeners)sub.onReconnect?.()}
 }
 const sub={kinds:Array.isArray(kinds)?kinds:[kinds],onData,onError,onReconnect};record.listeners.add(sub)
 return ()=>{record.listeners.delete(sub);if(!record.listeners.size){record.source.close();connections.delete(sessionId)}}
}}
P.setSignals(signals)
const navs=[['cards','人物卡','cards'],['worldbooks','世界書','worldbooks'],['story','對話','story'],['launch','開局與歷史','story'],['resources','劇本與素材','worldbooks'],['presets','預設','presets'],['profile','使用者設定','memory'],['memory','改卡記憶','memory'],['mvu','狀態與變數','mvu'],['phone','角色手機','phone'],['skills','寫作技能','cards'],['prompts','系統提示詞','worldbooks'],['settings','設定','appearance']]
function Launch({sessionId,onSelect,openTab}) {
 const [active,setActive]=React.useState(sessionId||'')
 React.useEffect(()=>{if(sessionId)setActive(sessionId)},[sessionId])
 const actions=React.useMemo(()=>P.createHostActions(host),[])
 const conversationHost=React.useMemo(()=>{const adapter=C.createConversationHostAdapter(host);return {...adapter,ensurePreset:async sessionId=>{await api('preset',{sessionId})},connectWorkspace:async id=>{const value=await adapter.connectWorkspace(id);setActive(value);return value}}},[])
 const useStore=(store,selector)=>selector(React.useSyncExternalStore(notify=>store.subscribe(notify),()=>store.getSnapshot(),()=>store.getSnapshot()))
 const useSessions=selector=>useStore(host.sessions.list,state=>selector({...state,current:active}))
 const useWorkspaces=selector=>useStore(host.workspaces.list,selector)
 const select=id=>{onSelect(id);host.sessions.open(id)}
 return h(P.Sidebar,{pluginHost:true,embedded:true,collapsed:false,width:850,
  useSessions,useWorkspaces,sessions:host.sessions,workspaces:host.workspaces,conversationHost,
  executeSlash:C.createTavernFrameSlashExecutor(host),...actions,
  renameSession:async(id,title)=>{const result=await host.sessions.binding(id).session.rename(title);if(!result.ok)throw new Error(result.error.message);await originalRpc('renameConversation',{title},id)},
  archiveSession:id=>host.workspaces.archiveSession(id),
  openConversationSettingsTab:id=>select(id),openCardLibraryTab:id=>{onSelect(id);openTab('cards')},
  openPresetLibraryTab:()=>{},openWorldBookLibraryTab:()=>{},openResourcesTab:()=>{}})
}
async function appearanceCall(operation,args){const r=await fetch('/api/tavern-room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feature:'appearance',operation,args})});const v=await r.json();if(!r.ok)throw new Error(v.error);return v.value}
function applyAppearance(value){document.documentElement.dataset.roomTheme=value.theme;document.documentElement.style.setProperty('--room-font-size',value.fontSize+'px');document.documentElement.style.setProperty('--room-content-width',value.contentWidth+'px')}
const Appearance=appearancePanel(React,{theme:'paper',fontSize:16,contentWidth:1100},async value=>{await appearanceCall('save',value);applyAppearance(value)},()=>appearanceCall('get',{}))
function App(){
 const [regenerating,setRegenerating]=React.useState(false)
 const [tab,setTab]=React.useState('cards'),[features,setFeatures]=React.useState({}),[sessionId,setSessionId]=React.useState(localStorage.getItem('tavern-room-session')||''),[sessions,setSessions]=React.useState([]),[error,setError]=React.useState(''),[state,setState]=React.useState(null),[cards,setCards]=React.useState([]),[path,setPath]=React.useState(''),[mode,setMode]=React.useState('story'),[busy,setBusy]=React.useState(false),[draft,setDraft]=React.useState(''),[meta,setMeta]=React.useState({}),[revision,setRevision]=React.useState(0)
 const current=React.useRef({sessionId,state});current.current={sessionId,state}
 const runtime=React.useRef(null),readBusy=React.useRef(false)
 const run=async fn=>{try{setError('');return await fn()}catch(e){setError(e.message);throw e}}
 const refreshCatalog=async()=>{const [catalog,cs,ss]=await Promise.all([fetch('/api/tavern-room').then(r=>r.json()),originalRpc('listCards'),originalRpc('listSessions')]);setFeatures(Object.fromEntries(catalog.features.map(f=>[f.id,f.enabled])));setCards(cs.cards);setSessions(ss.sessions||[]);P.setModes(ss.sessions||[])}
 async function refresh(){if(!current.current.sessionId||readBusy.current)return;const selected=current.current.sessionId;readBusy.current=true;try{const next=await api('state',{sessionId:selected});if(current.current.sessionId!==selected)return;setState(next);P.setMode(selected,next.view.mode);P.liveView.setView(selected,next.view);runtime.current?.sync(selected,next.view)}catch(e){setError(e.message)}finally{readBusy.current=false}}
 React.useEffect(()=>{appearanceCall('get',{}).then(applyAppearance).catch(()=>{});run(refreshCatalog).catch(()=>{});const timer=setInterval(()=>{refresh();},2000);return()=>clearInterval(timer)},[])
 React.useEffect(()=>{localStorage.setItem('tavern-room-session',sessionId);setState(null);runtime.current?.dispose();runtime.current=P.createScriptRuntime({window,signals,invalidate:()=>refresh()});refresh();if(!sessionId)return()=>runtime.current?.dispose();const stop=signals.subscribe(sessionId,['tavern-state','coordination','runtime-work'],()=>refresh());return()=>{stop();runtime.current?.dispose()}},[sessionId])
 React.useEffect(()=>{runtime.current?.setForeground(tab==='story'||tab==='mvu'||tab==='phone')},[tab])
 React.useEffect(()=>{if(!sessionId)return;let stop,closed=false;sessionInput(sessionId).then(input=>{if(closed)return;const update=()=>setDraft(input.state.getSnapshot().draft);update();stop=input.state.subscribe(update)}).catch(e=>setError(e.message));return()=>{closed=true;stop?.();retained.get(sessionId)?.release();retained.delete(sessionId)}},[sessionId])
 const select=id=>{setSessionId(id);setTab('story')}
 React.useEffect(()=>{const names=['dsh-tavern-start-session-opening','dsh-tavern-adjust-card-style','dsh-tavern-open-user-profile-task','dsh-tavern-debug-play-chat','dsh-tavern-edit-preset'];const open=()=>setTab('launch');for(const name of names)window.addEventListener(name,open);const changed=e=>{if(e.detail?.sessionId)select(e.detail.sessionId)};window.addEventListener('tavern-room-selected',changed);window.addEventListener('dsh-tavern-session-changed',changed);return()=>{for(const name of names)window.removeEventListener(name,open);window.removeEventListener('tavern-room-selected',changed);window.removeEventListener('dsh-tavern-session-changed',changed)}},[])

 async function create(){setBusy(true);try{const result=await run(()=>api('create',{path,mode,cardTask:mode==='card'?(path?'edit':'create'):undefined,userName:'你'}));select(result.sessionId);await refreshCatalog()}finally{setBusy(false)}}
 async function send(text=draft){if(!text.trim())return;setBusy(true);try{await run(async()=>{const input=await sessionInput(sessionId);input.setDraft(text);await input.submit('queue')});setDraft('');await refresh()}finally{setBusy(false)}}
 async function regenerate(){
  if(regenerating||busy||state?.running)return
  const selected=sessionId,method=state?.view?.canReplayFailedTurn?'replayTurn':'regenBody'
  setRegenerating(true);setBusy(true)
  try{await run(async()=>{
   const result=await originalRpc(method,{},selected)
   if(result.view)P.liveView.setView(selected,result.view)
   if(current.current.sessionId===selected)await refresh()
   await host.sessions.refresh()
  })}finally{setRegenerating(false);setBusy(false)}
 }
 const openTab=(name,newMeta)=>{const key=name.replace('dsh-tavern:','');setMeta(newMeta||{});setTab({'user-profile':'profile','conversation-settings':'settings','status':'mvu'}[key]||key)}
 const ctx={betterSidebar:{updateTab:(_id,value)=>{setMeta(value.meta||{});setRevision(v=>v+1)},openTab:(seed)=>openTab(seed.type,seed.meta)}}
 const props={sessionId,scope:{sessionId},tab:{id:tab,meta},ctx,visible:true,appendMention:(...args)=>{setDraft(v=>v+' @'+args.at(-1)+' ');setTab('story')},openWorldBook:source=>openTab('worldbooks',{worldBookSource:source})}
 const view=state?.view,enabled=key=>features[key]===true
 const messages=(state?.messages||[]).filter(m=>['user','assistant','tool'].includes(m.role))
 const lastAssistant=messages.findLastIndex(m=>m.role==='assistant')
 const canRegenerate=view?.canReplayFailedTurn===true||(view?.canRegenerate??view?.canRollback)===true
 const regenBlocked=busy||regenerating||state?.running||!canRegenerate||view?.activity?.busy&&view?.activity?.role!=='settlement'&&!view?.canReplayFailedTurn
 const regenReason=!canRegenerate?(view?.rollbackUnavailableReason||'尚無可重新生成的回覆'):view?.activity?.busy?(view.activity.blockReason||'請等待目前任務完成'):''
 const controlPropsFactory=()=>({sessionId,sessions:host.sessions,
  useSession:selector=>selector({running:state?.running===true}),
  useChat:selector=>selector({legacy:{nodes:view?.latestAssistantMessageId?[{kind:'assistant',messageId:view.latestAssistantMessageId}]:[]}}),
  useInput:selector=>selector({draft}),inputActions:{setDraft},
  executeSlash,openStyleTab:openTab})

 const executeSlash=(text,id=sessionId,options)=>C.createTavernFrameSlashExecutor(host)(text,id,options)
 const controlProps=controlPropsFactory()
 let body
 const components={cards:P.Cards,worldbooks:P.Worldbooks,resources:P.Resources,presets:P.Presets,profile:P.Profile,memory:P.Memory,skills:P.Skills,prompts:P.SystemPrompts,settings:P.Settings}
 if(components[tab])body=h(components[tab],props)
 if(tab==='settings')body=h(React.Fragment,null,enabled('appearance')?h(Appearance):null,view?h(P.ConversationSettings,{sessionId,sessions:host.sessions}):null,h(P.Settings))
 if(tab==='launch')body=null
 if(tab==='phone')body=view?h(P.Phone,{sessionId,view}):h('p',null,'先從「對話」選擇一段故事。')
 if(tab==='mvu')body=view?h(React.Fragment,null,h(P.StatusPanel,controlProps),h(P.PersistentStatus,{sessionId,view,executeSlash}),h('details',{open:true},h('summary',null,'MVU 變數'),h('pre',null,JSON.stringify(view.tavernHelper?.variables||view.tavernMvuRuntime||{},null,2))),h('details',null,h('summary',null,'故事狀態'),h('pre',null,JSON.stringify({posture:view.posture,ledger:view.ledger,guides:view.guides,settleStatus:view.settleStatus,settleError:view.settleError},null,2)))):h('p',null,'先從「對話」選擇一段故事。')
 if(tab==='story')body=h(React.Fragment,null,
  h('details',{className:'room-new',open:!sessionId},h('summary',null,'開始新對話'),h('div',{className:'room-actions'},h('select',{value:mode,onChange:e=>setMode(e.target.value)},h('option',{value:'story'},'角色故事'),h('option',{value:'card'},'卡片工作台')),h('select',{value:path,onChange:e=>setPath(e.target.value),'aria-label':'選擇人物卡'},h('option',{value:''},mode==='card'?'空白工作台':'選擇人物卡'),cards.map(c=>h('option',{key:c.path,value:c.path},c.name))),h('button',{disabled:busy||(!path&&mode!=='card'),onClick:()=>create().catch(()=>{})},'建立'))),
  h('div',{className:'room-actions'},h('select',{'aria-label':'選擇對話',value:sessionId,onChange:e=>select(e.target.value)},h('option',{value:''},'選擇對話'),sessions.map(s=>h('option',{key:s.sessionId,value:s.sessionId},s.title||s.cardName||s.sessionId))),sessionId?h(P.Export,{sessionId}):null),
  sessionId&&!view?h('p',null,'正在載入對話…'):null,
  view?h('div',{className:'room-transcript'},messages.map((m,index)=>{
   const turn=Number(m.turn)||index+1,projection=view.replyProjections?.find(p=>p.turn===turn)
   return h('article',{key:m.id||m.messageId||index,className:'room-message '+m.role},h('small',null,m.role==='user'?view.playerName:m.role==='tool'?'工具結果':view.card?.name||'卡片 Agent'),m.role==='assistant'&&projection?P.renderProjection(projection,{sessionId,turn,helperContext:view.tavernHelper,helperContextReader:()=>current.current.state?.view?.tavernHelper,trustedCardMode:view.tavernRuntimePolicy?.trustedCardMode,eagerFrame:true,executeSlash,frameOwner:'room-story'}):h(C.TavernColoredMarkdown,{text:m.text||'',labels:{code:{copyLabel:'複製',copiedLabel:'已複製'},footnotes:'註解'}}),...(m.blocks||[]).filter(b=>b.type==='tool-call'||b.type==='reasoning').map((b,i)=>h('details',{key:i},h('summary',null,b.type==='tool-call'?'呼叫工具：'+b.name:'思考'),h('pre',null,b.arguments||b.text))),index===lastAssistant&&['story','script'].includes(view.mode||'story')?h('div',{className:'room-actions'},h('button',{type:'button',disabled:!!regenBlocked,title:regenReason||'沿用原輸入，重新生成並替換這則回覆',onClick:()=>regenerate().catch(()=>{})},regenerating?'重新生成中…':'重新生成')):null)
  })):null,
  view?h(P.Candidates,controlProps):null,
  view?h(P.CandidateQuestion,controlProps):null,
  view?h(P.CandidateGuide,controlProps):null,
  view?h(P.Regen,controlProps):null,
  view?h(P.BodyEdit,controlProps):null,
  view?.foregroundError?h('p',{role:'alert'},JSON.stringify(view.foregroundError)):null,
  view?.settleError?h('p',{role:'alert'},String(view.settleError)):null,
  view?h('form',{className:'room-composer',onSubmit:e=>{e.preventDefault();send().catch(()=>{})}},h('textarea',{'aria-label':'輸入訊息',value:draft,onChange:e=>setDraft(e.target.value),placeholder:'繼續故事，或交給卡片 Agent 編輯資源…',rows:3}),h('div',{className:'room-actions'},h('button',{type:'submit',disabled:busy||state.running},state.running?'生成中…':'傳送'),state.running?h('button',{type:'button',onClick:()=>run(()=>api('cancel',{sessionId})).catch(()=>{})},'停止'):null)):null)
 return h(React.Fragment,null,h('nav',{className:'room-nav'},navs.filter(n=>n[0]==='settings'||(['story','launch'].includes(n[0])?(enabled('story')||enabled('cards')):enabled(n[2]))).map(([id,label])=>h('button',{key:id,className:tab===id?'active':'',onClick:()=>setTab(id)},label))),h('div',{className:'room-main'},h('header',null,h('h1',null,navs.find(n=>n[0]===tab)?.[1]||'酒館'),h('button',{onClick:()=>run(async()=>{await refreshCatalog();await refresh();setRevision(v=>v+1)}).catch(()=>{})},'重新整理')),error?h('div',{role:'alert',className:'room-error'},error):null,h('div',{hidden:tab!=='launch'},h(Launch,{sessionId,onSelect:select,openTab})),h('section',{key:tab+revision,hidden:tab==='launch'},body)),h(P.ErrorCenter))
}
document.body.innerHTML='<div id="room-root"></div>'
DOM.createRoot(document.getElementById('room-root')).render(h(App))
