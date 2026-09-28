// Producer attribution for the DSH 0.1.7 Session format. Legacy wrappers are read only.
const aliases = { 'system-prompt': '@deepseek-ai/dsh-system-prompt', 'runtime-context': '@deepseek-ai/dsh-system-prompt', 'compact-checkpoint': 'compact', 'compact-basic': 'dsh-compaction-basic' }
export function sourceOwner(source) {
  if (!source || typeof source.kind !== 'string') return ''
  if (source.kind === 'plugin') return source.plugin || ''
  return aliases[source.kind] || source.kind.replace(/^plugin:/, '')
}
export function isPluginSource(source) {
  return !!source?.kind && !['user', 'model', 'tool'].includes(source.kind)
}
