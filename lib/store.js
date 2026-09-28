import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
export class Store {
  constructor(root) { this.root=resolve(root); this.queues=new Map() }
  path(collection,id) {
    if(!/^[a-z][a-z0-9-]*$/u.test(collection)||!/^[a-zA-Z0-9_-]+$/u.test(id))throw new Error('Invalid record identifier')
    return join(this.root,collection,id+'.json')
  }
  async read(collection,id) {
    try{return JSON.parse(await readFile(this.path(collection,id),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}
  }
  async list(collection) {
    const directory=join(this.root,collection)
    let names;try{names=await readdir(directory)}catch(e){if(e.code==='ENOENT')return [];throw e}
    return Promise.all(names.filter(n=>/^[a-zA-Z0-9_-]+\.json$/u.test(n)).map(n=>this.read(collection,n.slice(0,-5))))
  }
  async update(collection,id,fn) {
    const path=this.path(collection,id), prior=this.queues.get(path)||Promise.resolve()
    const pending=prior.catch(()=>{}).then(async()=>{
      const current=await this.read(collection,id), value=await fn(current)
      if(value===undefined)return current
      await mkdir(join(this.root,collection),{recursive:true})
      const temporary=path+'.'+randomUUID()+'.tmp'
      await writeFile(temporary,JSON.stringify(value,null,2)+'\n','utf8');await rename(temporary,path)
      return value
    })
    this.queues.set(path,pending)
    try{return await pending}finally{if(this.queues.get(path)===pending)this.queues.delete(path)}
  }
  save(collection,value) {
    const id=value.id||randomUUID()
    return this.update(collection,id,old=>({...value,id,createdAt:old?.createdAt||value.createdAt||Date.now(),updatedAt:Date.now()}))
  }
  async remove(collection,id) {await this.update(collection,id,old=>old?{...old,archived:true,updatedAt:Date.now()}:undefined)}
}
