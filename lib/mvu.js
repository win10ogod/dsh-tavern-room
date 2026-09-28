const forbidden=new Set(['__proto__','prototype','constructor'])
function tokens(path) {
  if(path==='')return []
  if(typeof path!=='string'||!path.startsWith('/'))throw new Error('MVU path must be a JSON Pointer')
  const parts=path.slice(1).split('/').map(s=>s.replace(/~1/gu,'/').replace(/~0/gu,'~'))
  if(parts.some(x=>forbidden.has(x)))throw new Error('Invalid variable path')
  return parts
}
export function applyUpdates(document,updates) {
  let result=structuredClone(document)
  const read=path=>tokens(path).reduce((v,k)=>{if(v===null||typeof v!=='object'||!(k in v))throw new Error('Variable path does not exist: '+path);return v[k]},result)
  for(const update of updates) {
    const keys=tokens(update.path)
    if(update.op==='test'){if(JSON.stringify(read(update.path))!==JSON.stringify(update.value))throw new Error('MVU test failed');continue}
    if(update.op==='copy'||update.op==='move') {
      const val=structuredClone(read(update.from))
      if(update.op==='move')result=applyUpdates(result,[{op:'remove',path:update.from}])
      result=applyUpdates(result,[{op:'add',path:update.path,value:val}]);continue
    }
    if(!keys.length){if(update.op==='replace'||update.op==='add')result=structuredClone(update.value);else throw new Error('Unsupported root update');continue}
    let parent=result
    for(const key of keys.slice(0,-1)){if(!parent||typeof parent!=='object'||!(key in parent))throw new Error('Missing variable parent');parent=parent[key]}
    const key=keys.at(-1)
    if(!parent||typeof parent!=='object')throw new Error('Variable parent is not an object')
    if(Array.isArray(parent)&&!(update.op==='add'&&key==='-')&&(!/^(0|[1-9][0-9]*)$/u.test(key)||Number(key)>(update.op==='add'?parent.length:parent.length-1)))throw new Error('Invalid array index')
    if(update.op==='delta') {if(typeof parent[key]!=='number'||typeof update.value!=='number')throw new Error('delta requires numeric values');parent[key]+=update.value;if(!Number.isFinite(parent[key]))throw new Error('Variable number overflow')}
    else if(update.op==='remove') {if(!(key in parent))throw new Error('Variable does not exist');if(Array.isArray(parent))parent.splice(Number(key),1);else delete parent[key]}
    else if(update.op==='add'&&Array.isArray(parent)) {
      const i=key==='-'?parent.length:Number(key);if(!Number.isInteger(i)||i<0||i>parent.length)throw new Error('Invalid array index');parent.splice(i,0,structuredClone(update.value))
    }else if(['add','replace'].includes(update.op)){if(update.op==='replace'&&!(key in parent))throw new Error('Variable does not exist');parent[key]=structuredClone(update.value)}
    else throw new Error('Unsupported variable operation: '+update.op)
  }
  return result
}
