// Mega Slide: a 2–5 floor down-only tube. People step in on the floor above the
// top, whoosh down a zig-zag, and pop out at the bottom.
import type { Sfx } from '../audio'
import { FACILITIES } from './defs'
import type { Facility, Game, Person } from './state'
import { fx } from './world'

export const SLIDE_MIN = 2
export const SLIDE_MAX = 5
export const SLIDE_DEFAULT = 3
/** Sim steps per floor of drop: about a third of the stairs. */
export const SLIDE_STEPS = 18
const PER_FLOOR = 20000

export type SlideLook = 'rainbow' | 'aqua' | 'tube'
export const SLIDE_LOOKS: SlideLook[] = ['rainbow', 'aqua', 'tube']
export const slideLook = (variant: number): SlideLook => SLIDE_LOOKS[variant % SLIDE_LOOKS.length]

export const slideCost = (drop: number) => FACILITIES.megaSlide.cost + PER_FLOOR * drop

/** How far (0..1) a rider is down the tube. */
export const slideProgress = (p: Person, f: Facility) => p.climb / (SLIDE_STEPS * f.height)

/** Floors of drop for a drag from f0 to f1; a plain click gives the default. */
export function dragDrop(f0: number, f1: number) {
  if (f0 === f1) return { floor: f0, drop: SLIDE_DEFAULT }
  return { floor: Math.min(f0, f1), drop: Math.max(SLIDE_MIN, Math.min(SLIDE_MAX, Math.abs(f1 - f0))) }
}

/**
 * Where a rider is, as (tile, floor) with floor fractional. The tube zig-zags across
 * its width once per floor, from the top entry (floor + height) down to the bottom.
 */
export function slidePos(f: Facility, k: number): { tile: number; floor: number } {
  const span = f.height * Math.min(1, Math.max(0, k))
  const i = Math.min(f.height - 1, Math.floor(span))
  const s = span - i
  const across = i % 2 === 0 ? s : 1 - s
  return { tile: f.x + 0.5 + across * (f.width - 1), floor: f.floor + f.height - span }
}

/** Short-lived landing puffs for the renderer. */
export const puffs: { fac: number; splash: boolean; born: number }[] = []
export const PUFF_MS = 700

const WHEE = ['WHEEE! 🛝', 'WHEEE!', 'Again! Again!', 'Wooo-hoo!']
const GRUMBLE = ['My tie! 👔', 'My coffee! ☕', 'Not again…']

/** A rider shot out of the bottom. Returns a sound to play, if any. */
export function slideLanded(g: Game, p: Person, f: Facility): Sfx | null {
  f.rides = (f.rides ?? 0) + 1
  const look = slideLook(f.id)
  const x = slidePos(f, 1).tile
  const now = performance.now()
  while (puffs.length && now - puffs[0].born > PUFF_MS) puffs.shift()
  if (puffs.length < 20) puffs.push({ fac: f.id, splash: look === 'aqua', born: now })
  if (p.kind === 'worker' && Math.random() < 0.08) {
    fx(g, x, f.floor, GRUMBLE[Math.floor(Math.random() * GRUMBLE.length)], '#adb5bd')
    p.mood = Math.min(100, p.mood + 4)
    return null
  }
  p.mood = Math.max(0, p.mood - 8)
  if (Math.random() < 0.25) fx(g, x, f.floor, WHEE[Math.floor(Math.random() * WHEE.length)], look === 'aqua' ? '#66d9e8' : '#ff8787')
  if (Math.random() < 0.15) return look === 'aqua' ? 'splash' : 'whistle'
  return null
}

export function slideDayTick(g: Game) {
  for (const f of g.facilities.values()) if (f.kind === 'megaSlide') f.rides = 0
}
