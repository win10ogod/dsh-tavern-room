export const name = 'tavern-phone'
export const inject = ['tavernRoom']
export function apply(ctx) { ctx.effect(() => ctx.tavernRoom.enable('phone')) }
