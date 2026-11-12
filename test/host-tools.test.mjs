import test from 'node:test'
import assert from 'node:assert/strict'
import { createHostToolPolicy } from '../vendor/upstream/tavern-plugin/lib/host/tools.js'

// DSH 0.2.2 removed assembly.tools from the system-prompt waterfall. The policy reads the
// step's admitted tools, lets Tavern filter them, then enforces the result on the request
// and on execution. The ctx below is a test double with only the members the policy uses.
test('DSH 0.2.2 tool filter: admitted tools in, filtered list enforced on the request and on calls', async () => {
  const listeners = new Map()
  const guards = []
  const streamed = []
  const ctx = {
    on(name, listener) { listeners.set(name, listener) },
    effect() {},
    tools: {
      async schemas(agent, toolSet) {
        assert.equal(agent.session.id, 's1')
        assert.equal(toolSet, 'step-admission')
        return [{ name: 'submit_story' }, { name: 'bash' }]
      },
      guard(fn) { guards.push(fn) }
    },
    llm: { stream(request) { streamed.push(request.tools.map(tool => tool.name)); return 'filtered' } }
  }
  const policy = createHostToolPolicy(ctx)
  const agent = { session: { id: 's1' } }

  const result = await policy.assemble({ sections: [] }, { agent, toolSet: 'step-admission' }, (assembly, tools) => {
    assembly.tools = tools.filter(tool => tool.name === 'submit_story')
    return assembly
  })
  assert.deepEqual(result.tools.map(tool => tool.name), ['submit_story'])

  const stream = listeners.get('llm/stream')
  assert.equal(stream({ sessionId: 's1', tools: [{ name: 'submit_story' }, { name: 'bash' }] }, () => 'unfiltered'), 'filtered')
  assert.deepEqual(streamed, [['submit_story']])
  assert.equal(stream({ sessionId: 's1', purpose: 'compaction', tools: [{ name: 'bash' }] }, () => 'unfiltered'), 'unfiltered', 'auxiliary requests are left alone')

  assert.match(guards[0]({ name: 'bash', agent }), /未在当前任务开放/)
  assert.equal(guards[0]({ name: 'submit_story', agent }), undefined)

  listeners.get('session/event')({ id: 's1' }, { type: 'turn/end' })
  assert.equal(stream({ sessionId: 's1', tools: [{ name: 'bash' }] }, () => 'unfiltered'), 'unfiltered', 'the admission ends with the turn')
})
