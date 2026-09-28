export function appearancePanel(React,initial,onSave,onLoad){
 const h=React.createElement
 return function Appearance(){
  const [draft,setDraft]=React.useState(initial),[error,setError]=React.useState('')
  React.useEffect(()=>{let active=true;onLoad?.().then(value=>{if(active)setDraft(value)}).catch(e=>setError(e.message));return()=>{active=false}},[])
  const field=(key,value)=>setDraft({...draft,[key]:value})
  return h('details',{className:'room-new'},h('summary',null,'外觀'),
   h('div',{className:'room-actions'},h('label',null,'配色 ',h('select',{value:draft.theme,onChange:e=>field('theme',e.target.value)},h('option',{value:'paper'},'紙白'),h('option',{value:'night'},'夜色'),h('option',{value:'terracotta'},'暖陶'))),
    h('label',null,'字級 ',h('input',{type:'number',min:10,max:40,value:draft.fontSize,onChange:e=>field('fontSize',Number(e.target.value))})),
    h('label',null,'內容寬度 ',h('input',{type:'number',min:480,max:1800,value:draft.contentWidth,onChange:e=>field('contentWidth',Number(e.target.value))}))),
   h('button',{onClick:()=>onSave(draft).catch(e=>setError(e.message))},'儲存外觀'),error?h('p',{role:'alert'},error):null)
 }
}
