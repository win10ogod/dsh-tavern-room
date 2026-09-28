window.__ModuleLoader__.load({id:'dsh-tavern-room',factory:require=>{
 const React=require('react'), DshUi=require('@deepseek-ai/dsh-client-ui-primitives')
 let ReactDOM;try{ReactDOM=require('react-dom/client')}catch{ReactDOM=require('react-dom')}

 return {inject:['slots','sessions','workspaces','conversation','layout','uiWorkspace','remote','remote.commands'],apply(ctx){
  ctx.effect(()=>{window.__TavernRoomLibraries={host:ctx,react:React,'react-dom/client':ReactDOM,'@deepseek-ai/dsh-client-ui-primitives':DshUi};return ()=>delete window.__TavernRoomLibraries})
  ctx.effect(()=>ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'tavern-room',order:35,label:'酒館'},()=>React.createElement('span',{'aria-hidden':true},'♧'))))
  ctx.effect(()=>ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'tavern-room'},()=>React.createElement('iframe',{title:'酒館',src:'/tavern-room/',style:{width:'100%',height:'100%',border:0,display:'block'}}))))
 }}
}})
