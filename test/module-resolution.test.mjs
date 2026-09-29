import test from 'node:test'
import assert from 'node:assert/strict'
import Module,{createRequire} from 'node:module'
import {dirname} from 'node:path'
import {installNodeResolutionCompatibility} from '../lib/node-resolution-compat.js'

test('tr46 keeps npm punycode when the Host rejects its bare builtin-name search',()=>{
 const require=createRequire(import.meta.url),tr46=require.resolve('tr46'),fromTr46=createRequire(tr46)
 const expected=require(require.resolve('punycode/',{paths:[dirname(tr46)]}))
 const original=Module._resolveFilename
 let dispose
 Module._resolveFilename=function(request,parent,main,options){
  if(request==='punycode/'&&options?.paths===undefined)throw new TypeError('Host resolve.paths("punycode") is null')
  return original.call(this,request,parent,main,options)
 }
 try{
  assert.throws(()=>fromTr46.resolve('punycode/'),/resolve.paths/)
  dispose=installNodeResolutionCompatibility()
  assert.equal(fromTr46('punycode/'),expected)
  assert.throws(()=>require.resolve('punycode/'),/resolve.paths/)
 }finally{dispose?.();Module._resolveFilename=original}
})
