import {projectCompactionRequest} from '../vendor/upstream/tavern-plugin/lib/domain/compaction-request.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {Session} from '@deepseek-ai/dsh-session'
import {appendSessionEvent,ensureSessionSystemHead,sessionEvents,rawSessionEvents,projectTavernSurfaceMessages} from '../vendor/upstream/tavern-plugin/lib/domain/session-events.js'
import {replaceSessionSurface} from '../vendor/upstream/tavern-plugin/lib/domain/session-surface-mutations.js'

test('Tavern edited assistant/tool messages survive native admission without altering tool JSON',()=>{
 const session=Session.create('port-format-test')
 ensureSessionSystemHead(session)
 const placeholders=['assistant','result'].map(id=>appendSessionEvent(session,'user/message',{id,role:'user',content:[],source:{kind:'dsh-tavern-surface-restore'}},{surfaceOp:'append'}))
 const argumentText='{"integer":"9007199254740993","literal":"a\\nb","nested":{"enabled":false}}'
 const assistant={turn:1,step:1,stream:[],message:{id:'edited',role:'assistant',source:{kind:'model',provider:'fixture',model:'fixture'},content:[{type:'tool-call',id:'call',name:'fixture',arguments:argumentText}]}}
 const result={turn:1,step:1,message:{id:'result-restored',role:'tool',source:{kind:'tool',callId:'call'},toolCallId:'call',content:[{type:'text',text:'{"ok":true,"payload":"unchanged"}'}]}}
 for(const [i,data] of [assistant,result].entries())replaceSessionSurface(session,i?'tool/result':'assistant/message',data,{start:placeholders[i].seq,end:placeholders[i].seq,sourceEventSeqs:[placeholders[i].seq]})
 const restored=Session.fromRestore(session.id,structuredClone(rawSessionEvents(session)),structuredClone(session.header),session.inheritedEventCount,'detached')
 const projected=sessionEvents(restored).filter(e=>e.type!=='session/end-seed'),raw=rawSessionEvents(restored).filter(e=>e.type!=='session/end-seed')
 assert.equal(projected.at(-2).type,'assistant/message');assert.equal(projected.at(-1).type,'tool/result')
 assert.equal(raw.at(-2).type,'user/message');assert.equal(raw.at(-2).data.source.kind,'dsh-tavern')
 const messages=projectTavernSurfaceMessages(raw.slice(-2).map(event=>event.data))
 assert.equal(messages[0].content[0].arguments,argumentText)
 assert.deepEqual(messages,[assistant.message,result.message])
 assert.deepEqual(projectCompactionRequest({purpose:'compaction',messages:raw.slice(-2).map(event=>event.data)}).messages,messages)
 assert.equal(raw.at(-2).data.content.length,0)
})
