export const name = 'tavern-mvu'
export const inject = ['tavernRoom']
export function apply(ctx) { ctx.effect(() => ctx.tavernRoom.enable('mvu')) }
