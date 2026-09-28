export const name = 'tavern-appearance'
export const inject = ['tavernRoom']
export function apply(ctx) { ctx.effect(() => ctx.tavernRoom.enable('appearance')) }
