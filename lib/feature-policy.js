const apiGroups=[
 ['memory',/^(getCardMemory|changeCardMemory|manageUserPreference|updateUserPreference|setUserPreference|setConversationUserProfile)/],
 ['phone',/^(sendPhoneMessage)/],
 ['mvu',/^(.*Mvu|.*MVU|retrySettlement|saveLedger)/],
 ['cards',/^(importCard|updateCard|deleteCard|organizeCards|importMobileCard)/],
 ['worldbooks',/^(importWorldBook|updateWorldBook|deleteWorldBook|bindWorldBook|unbindWorldBook|setWorldBookBindings|importSource|importScript|saveSystemPrompts|resetSystemPrompts)/],
 ['presets',/^(importPreset|selectPreset|deletePreset|applyConversationPreset|.*BypassPlan)/],
 ['story',/^(startChat|forkChat|importChatHistory|rollbackTurn|undoRollbackTurn|regenerate|submitTask|generateTavernHelper)/]
]
export function assertFeature(room,method){for(const [feature,test] of apiGroups)if(test.test(method)&&!room.has(feature))throw new Error('酒館功能已關閉：'+feature)}
export function toolFeature(name){
 if(/memory|user_profile/.test(name))return 'memory'
 if(/mvu|variables/.test(name))return 'mvu'
 if(/phone/.test(name))return 'phone'
 if(/worldbook|script/.test(name))return 'worldbooks'
 if(/preset/.test(name))return 'presets'
 if(/history|play_chat/.test(name))return 'story'
 return 'cards'
}
export function assertConversation(room,chat){
 if(!room||!chat)return
 if(['story','script'].includes(chat.mode)&&!room.has('story'))throw new Error('劇情會話功能已關閉。')
 if(chat.mode==='card'&&!room.has('cards'))throw new Error('人物卡工作台功能已關閉。')
 if(chat.mvu?.enabled&&!room.has('mvu'))throw new Error('這張卡需要 MVU。請開啟 MVU 功能後繼續，現有狀態已保留。')
}
