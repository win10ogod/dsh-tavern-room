export const name = 'tavern-story'
export const inject = ['tavernRoom']
export function apply(ctx) { ctx.effect(() => ctx.tavernRoom.enable('story')) }
