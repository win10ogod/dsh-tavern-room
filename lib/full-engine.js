import {migrateResources} from './migrate-resources.js'
import {registerRoomTransport} from './room-transport.js'
import {EventEmitter} from 'node:events'
import {join} from 'node:path'
import {apply as applyUpstream} from '../vendor/upstream/tavern-plugin/lib/index.js'
import {configurePortDataRoot} from '../vendor/upstream/tavern-plugin/lib/domain/tavern-data.js'
export const name='tavern-full-engine'
export const inject=['tavernRoom','connection','webServer','fs','llm','tools','skills','agentDefaultModel','sandboxPolicy','shell','agentPresets','settings','tokenMeter','agents','sessions']
export async function apply(ctx) {
 configurePortDataRoot(join(ctx.tavernRoom.store.root,'engine'))
 const carrier=ctx.webServer,guard=ctx.connection,isolated=ctx.isolate('webServer'),server=new EventEmitter()
 await isolated.plugin({name:'tavern-room-carrier',apply(scope){scope.provide('webServer',{server,register(route){
  return carrier.register({...route,handler:async(req,res)=>{
   const rejected=guard.requestRejection(req)
   if(rejected){res.writeHead(rejected,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'DSH authentication required'}));return}
   server.emit('request',req,res)
   await route.handler(req,res)
  }})
 }})}})
 try { await applyUpstream(isolated); registerRoomTransport(isolated,ctx.tavernRoom); const engine=isolated.get('tavernFull',false); await migrateResources(ctx.tavernRoom,engine.importResource,engine.dataRoot); ctx.logger.info('酒館執行層已就緒') } catch(error) { ctx.logger.error(error.stack || error.message); throw error }
}
