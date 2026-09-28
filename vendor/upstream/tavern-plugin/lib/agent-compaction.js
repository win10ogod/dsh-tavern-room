import { serviceForAgent } from '@deepseek-ai/dsh-agent-preset-registry'
// DSH 0.1.7 owns per-agent preset service resolution on the Host plane.
export async function resolveAgentCompaction(ctx, agent) {
  const engine = serviceForAgent(ctx, agent, 'compaction')
  if (!engine || typeof engine.compactNow !== 'function' || typeof engine.compactIfNeeded !== 'function') throw new Error('当前 Agent 未提供原生压缩能力')
  return engine
}
