import {createRequire,registerHooks} from 'node:module'
import {dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

// DSH 0.1.7 routes "punycode/" using resolve.paths("punycode"), which is null
// for the Node builtin. Preserve tr46's npm implementation and scope the repair
// to the exact dependency file; all other module resolution stays with the Host.
export function installNodeResolutionCompatibility(parentURL=import.meta.url) {
 const nativeResolve=(name,parent)=>createRequire(parent).resolve(name,{paths:[dirname(fileURLToPath(parent))]})
 const jsdom=nativeResolve('jsdom',parentURL)
 const url=nativeResolve('whatwg-url',pathToFileURL(jsdom))
 const tr46=nativeResolve('tr46',pathToFileURL(url))
 const parent=pathToFileURL(tr46).href
 const target=pathToFileURL(nativeResolve('punycode/',pathToFileURL(tr46))).href
 const hook=registerHooks({resolve(specifier,context,next){
  if(specifier==='punycode/'&&context.parentURL===parent)return {url:target,shortCircuit:true}
  return next(specifier,context)
 }})
 return ()=>hook.deregister()
}
