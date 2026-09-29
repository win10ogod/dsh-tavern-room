import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {parse} from 'yaml'
import {resolveAgentCompaction} from '../lib/native-compaction.js'
test('compaction resolves the actual Host-owned Agent service without installing an SDK copy',async()=>{
 const agent={id:'owned'},engine={compactNow(){},compactIfNeeded(){}}
 const ctx={get(name){assert.equal(name,'agentPresets');return {serviceFor(target,service){assert.equal(target,agent);assert.equal(service,'compaction');return engine}}}}
 assert.equal(await resolveAgentCompaction(ctx,agent),engine)
})
test('plugin manager receives addressable component rows instead of a virtual group',async()=>{
 const patches=parse(await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8'))
 assert.equal(patches[0].insert.length,10)
 assert.ok(patches[0].insert.every(row=>row.name.startsWith('dsh-tavern-room')&&!row.group))
})
