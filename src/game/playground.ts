// Sky Playground hours and weather. Drawing lives in render/playground.ts.
import type { Game } from './state'
import { isWeekend, minuteOfDay } from './state'
import { weatherFor } from '../render/sky-fx'

const AT = (h: number, m = 0) => h * 60 + m

/** Rain (10am–6pm on a rainy day) shuts the playground. Snow does not. */
export function playgroundRainedOut(g: Game) {
  return weatherFor(g).rain
}

/**
 * Visitors per hour while the room is open.
 * Sunny weekend afternoons are the rush; rain is zero.
 */
export function playgroundPerHour(g: Game) {
  const w = weatherFor(g)
  if (w.rain) return 0
  const m = minuteOfDay(g.time)
  if (isWeekend(g.time) && !w.snow && m >= AT(12) && m < AT(17)) return 14
  return 5
}

/** How many kids to draw, from empty up to one on every piece of equipment. */
export function playgroundKids(inside: number) {
  if (inside <= 0) return 0
  return Math.min(6, Math.ceil((inside / 20) * 6))
}

/** Pendulum angle. The dev console reads this off `window.api` instead of sampling pixels. */
export function playgroundSwing(now: number, phase = 0) {
  return Math.sin(now / 680 + phase) * 0.62
}

/** The ice cream cart only rolls in on a sunny weekend afternoon, and only if the tower sells cones. */
export function playgroundCart(g: Game) {
  const w = weatherFor(g)
  if (w.rain || w.snow || !isWeekend(g.time)) return false
  const m = minuteOfDay(g.time)
  if (m < AT(12) || m >= AT(17)) return false
  for (const f of g.facilities.values()) if (f.kind === 'iceCream') return true
  return false
}
