import test from 'node:test'
import assert from 'node:assert/strict'
import {createPromptCatalog} from '../vendor/upstream/tavern-plugin/lib/prompt-catalog.js'
import {normalizeSkillAgents} from '../vendor/upstream/tavern-plugin/lib/domain/tavern-skills.js'

test('Tavern retains story and background skills while rejecting removed image tasks',()=>{
 const prompt=createPromptCatalog()
 assert.ok(prompt('story').length>0)
 assert.ok(prompt('posture-settlement').length>0)
 assert.deepEqual(normalizeSkillAgents(['card','foreground','background']),['card','foreground','background'])
 for(const name of ['scene-plan','scene-image-system','scene-image-adjustment'])assert.throws(()=>prompt(name),/未知提示词/)
 assert.throws(()=>normalizeSkillAgents(['image']),/Skill 用途/)
})
