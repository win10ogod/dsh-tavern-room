window.__ModuleLoader__={load(descriptor){
 if(descriptor.id!=='dsh-tavern-room/compat')throw new Error('Unexpected Tavern runtime module')
 const libraries=window.parent.__TavernRoomLibraries
 if(!libraries)throw new Error('請從 DSH 的「酒館」頁面開啟完整執行層')
 window.TavernCompatibility=descriptor.factory(name=>{if(!(name in libraries))throw new Error('Unavailable native module: '+name);return libraries[name]})
}}
