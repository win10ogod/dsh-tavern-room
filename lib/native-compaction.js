// Resolve through the running Host service: preset mounts belong to that instance.
export async function resolveAgentCompaction(ctx,agent) {
 const engine=ctx.get('agentPresets')?.serviceFor(agent,'compaction')
 if(!engine||typeof engine.compactNow!=='function'||typeof engine.compactIfNeeded!=='function')throw new Error('当前 Agent 未提供原生压缩能力')
 return engine
}
