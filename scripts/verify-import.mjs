import {readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {Store} from '../lib/store.js'
import {readPngCard} from '../lib/formats.js'
const root=resolve(process.argv[2]),source=resolve(process.argv[3]),store=new Store(root)
const hash=x=>createHash('sha256').update(x).digest('hex')
const cards=await store.list('cards'),worlds=await store.list('worldbooks')
for(const c of cards){const bytes=await readFile(join(source,'characters',c.source.file));assert.equal(hash(bytes),c.source.sha256);assert.deepEqual(readPngCard(bytes),c.card);assert.equal(hash(await readFile(join(root,'assets',c.asset))),hash(bytes))}
for(const w of worlds){const bytes=await readFile(join(source,'worlds',w.source.file));assert.equal(hash(bytes),w.source.sha256);assert.deepEqual(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,'')),w.document)}
console.log(JSON.stringify({cards:cards.length,worldbooks:worlds.length,allFieldsPreserved:true,allOriginalImagesPreserved:true}))
