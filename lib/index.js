import {Service} from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {readFile} from 'node:fs/promises'
import {resolve,join,basename,extname} from 'node:path'
import {homedir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {Store} from './store.js'
import {featureHandlers,featureNames} from './features.js'
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url))
export default class TavernRoom extends Service {
 static inject=['connection','webServer','agents','agentDefaultModel','agentPresets','sessionPersistence']
 static Config=z.object({dataRoot:z.string().default('')})
 constructor(ctx,config={}) {
  super(ctx,'tavernRoom');this.ctx=ctx;this.store=new Store(config.dataRoot||join(process.env.DSH_HOME||join(homedir(),'.dsh'),'profile-data','tavern-room'));this.features=new Map()
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/tavern-room',handler:(req,res)=>this.http(req,res)}))
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/tavern-room',methods:['GET','POST'],requestBody:'buffered',fetch:request=>this.api(request)}))
 }
 has(key){return this.features.has(key)}
 enable(key){if(this.features.has(key))throw new Error('Duplicate Tavern feature');this.features.set(key,key==='appearance'?featureHandlers(this,key):{});return ()=>{this.features.delete(key)}}
 async call(feature,operation,args={}) {const handler=this.features.get(feature)?.[operation];if(!handler)throw new Error(`功能已關閉或操作不存在：${feature}/${operation}`);return handler(args)}
 async api(request) {
  const url=new URL(request.url),json=(status,value)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}})
  try {
    if(request.method==='GET') {
      if(url.searchParams.has('asset')) {
        const file=url.searchParams.get('asset');if(basename(file)!==file||!file.endsWith('.png'))throw new Error('Invalid asset path')
        return new Response(await readFile(join(this.store.root,'assets',file)),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=60'}})
      }
      return json(200,{features:Object.entries(featureNames).map(([id,name])=>({id,name,enabled:this.has(id)})),model:this.ctx.agentDefaultModel.currentSelection()})
    }
    const body=await request.json()
    return json(200,{value:await this.call(body.feature,body.operation,body.args||{})})
  }catch(error){return json(400,{error:error.message})}
 }
 async http(req,res) {
  const url=new URL(req.url,'http://localhost'),path=url.pathname.slice('/tavern-room'.length)
  const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
  try {
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
    let target
    {const file=path===''||path==='/'?'index.html':path.slice(1);if(!['index.html','app.js','style.css','compat-bootstrap.js','compat.js','full-app.js','appearance.js'].includes(file)){res.writeHead(404);res.end();return}target=file==='compat.js'?fileURLToPath(new URL('../vendor/upstream/tavern-plugin/lib/client.js',import.meta.url)):join(publicRoot,file)}
    const data=await readFile(target),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[extname(target)]
    res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data)
  }catch(error){json(400,{error:error.message})}
 }
}
