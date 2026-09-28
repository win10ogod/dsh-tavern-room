export const name='tavern-presets'
export const inject=['tavernRoom']
export function apply(ctx){ctx.effect(()=>ctx.tavernRoom.enable('presets'))}
