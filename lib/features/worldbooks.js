export const name = 'tavern-worldbooks'
export const inject = ['tavernRoom']
export function apply(ctx) { ctx.effect(() => ctx.tavernRoom.enable('worldbooks')) }
