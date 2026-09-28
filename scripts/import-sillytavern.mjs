import { readFile,mkdir,copyFile,writeFile,readdir } from 'node:fs/promises'
import {resolve,join,basename,extname} from 'node:path'
import {createHash} from 'node:crypto'
import {Store} from '../lib/store.js'
import {readPngCard,cardData,validateCard,referencedWorlds,worldEntries} from '../lib/formats.js'
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1]
if(!args.includes('--source')||!args.includes('--data-root'))throw new Error('Usage: --source SillyTavern --data-root DSH-Tavern-data [--user default-user]')
const source=resolve(value('--source')),root=resolve(value('--data-root')),user=args.includes('--user')?value('--user'):'default-user'
const base=join(source,'data',user),store=new Store(root),report={source,sourceUser:user,createdAt:new Date().toISOString(),cards:[],worldbooks:[],errors:[]}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
await mkdir(join(root,'assets'),{recursive:true})
for(const file of (await readdir(join(base,'worlds'))).filter(n=>extname(n).toLowerCase()==='.json')) {
 try {
  const bytes=await readFile(join(base,'worlds',file)),json=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,'')),id='st-world-'+digest(Buffer.from(user+'/'+file)).slice(0,24)
  const old=await store.read('worldbooks',id)
  if(old&&old.source?.sha256!==digest(bytes))throw new Error('Imported source changed; explicit replacement required')
  if(!old)await store.save('worldbooks',{id,name:basename(file,'.json'),document:json,enabled:true,source:{kind:'sillytavern',file,sha256:digest(bytes)}})
  report.worldbooks.push({id,name:basename(file,'.json'),entries:worldEntries(json).length,existing:!!old})
 }catch(error){report.errors.push({kind:'worldbook',file,error:error.message})}
}
const worldMap=new Map(report.worldbooks.map(w=>[w.name,w.id]))
for(const file of (await readdir(join(base,'characters'))).filter(n=>['.png','.json'].includes(extname(n).toLowerCase()))) {
 try {
  const bytes=await readFile(join(base,'characters',file)),png=extname(file).toLowerCase()==='.png',card=png?readPngCard(bytes):JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,'')),id='st-card-'+digest(Buffer.from(user+'/'+file)).slice(0,24)
  const validation=validateCard(card);if(!validation.valid)throw new Error(validation.errors.join('; '))
  const old=await store.read('cards',id)
  if(old&&old.source?.sha256!==digest(bytes))throw new Error('Imported source changed; explicit replacement required')
  if(!old) {
   if(png)await copyFile(join(base,'characters',file),join(root,'assets',id+'.png'))
   await store.save('cards',{id,name:cardData(card).name,card,asset:png?id+'.png':null,worldbookIds:referencedWorlds(card).map(name=>worldMap.get(name)).filter(Boolean),source:{kind:'sillytavern',file,sha256:digest(bytes)}})
  }
  report.cards.push({id,name:cardData(card).name,existing:!!old,linkedWorlds:referencedWorlds(card),missingWorlds:referencedWorlds(card).filter(name=>!worldMap.has(name)),embeddedEntries:worldEntries(cardData(card).character_book).length})
 }catch(error){report.errors.push({kind:'card',file,error:error.message})}
}
await writeFile(join(root,'import-report.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({dataRoot:root,cards:report.cards.length,worldbooks:report.worldbooks.length,embeddedEntries:report.cards.reduce((n,c)=>n+c.embeddedEntries,0),unresolvedWorlds:report.cards.filter(c=>c.missingWorlds.length),errors:report.errors},null,2))
if(report.errors.length)process.exitCode=1
