import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {join,resolve} from 'node:path'
import {parse} from 'yaml'
export async function registerPortPresets(ctx,dataRoot) {
 const root=fileURLToPath(new URL('../vendor/upstream/presets/',import.meta.url))
 for(const id of ['tavern','tavern-background']) {
  const directory=join(root,id)
  const raw=(await readFile(join(directory,'agent.cordis.yml'),'utf8')).replace('!!js process.env.DSH_CWD ?? process.cwd()',JSON.stringify(join(dataRoot,'resources')))
  const plugins=parse(raw)
  plugins.push({id:'tavern-web-tools',name:'@deepseek-ai/dsh-tool-web',config:{search:true,fetch:true}})
  if(id==='tavern') {
   const files=plugins.find(row=>row.id==='filesystem')
   files.config.push({id:'tavern-file-tools',name:'@deepseek-ai/dsh-tool-fs'},{id:'tavern-file-search',name:'@deepseek-ai/dsh-tool-fs-search',config:{sampleOverCapGlobResults:false}})
   plugins.push({id:'tavern-shell',name:process.platform==='win32'?'@deepseek-ai/dsh-tool-pwsh':'@deepseek-ai/dsh-tool-bash'})
  }
  for(const row of plugins)if(row.group&&Array.isArray(row.config))row.config=row.config.filter(child=>child.id!=='tavern-compaction')
  const paths=rows=>{for(const row of rows){if(row.id==='user-tools')row.name='dsh-tavern-room/user-tools';else if(row.name?.startsWith('.'))row.name=resolve(directory,row.name).replaceAll('\\','/');if(row.group&&Array.isArray(row.config))paths(row.config)}}
  paths(plugins)
  const dispose=await ctx.agentPresets.register({id,name:id==='tavern'?'酒館完整模式':'酒館背景代理',plugins})
  ctx.effect(()=>dispose)
 }
}
