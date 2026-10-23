// Roof toppers: who needs open sky, the single spire, the helicopter clock, turbine spin.
import { FACILITIES } from './defs'
import type { FacilityKind } from './defs'
import type { Game } from './state'
import { dayOf, minuteOfDay } from './state'
import { weatherFor } from '../render/sky-fx'

export const TURBINE_MAX = 3

const OPEN_SKY: ReadonlySet<string> = new Set([
  'rocketPad', 'observatory', 'helipad', 'turbine', 'waterTower', 'giantDonut', 'crown', 'dome', 'antenna', 'playground',
])

const SPIRES: ReadonlySet<string> = new Set(['crown', 'dome', 'antenna'])

export function needsOpenSky(kind: FacilityKind) {
  return OPEN_SKY.has(kind)
}

export function isSpire(kind: FacilityKind) {
  return SPIRES.has(kind)
}

export function hasSpire(g: Game) {
  for (const f of g.facilities.values()) if (isSpire(f.kind)) return true
  return false
}

/** Nothing built anywhere above the top floor this facility would occupy. */
export function onVeryTop(g: Game, floor: number, height: number) {
  const top = floor + height - 1
  for (const [fl, row] of g.floors) {
    if (fl <= top) continue
    for (let i = 0; i < row.length; i++) if (row[i] !== -1) return false
  }
  return true
}

// A helicopter every 3 hours from 8am. The last one arrives at 5pm and is gone before 8pm.
export const HELI_EVERY = 180
export const HELI_FIRST = 8 * 60
export const HELI_LAST = 20 * 60
const HELI_IN = 6
const HELI_HOVER = 4
const HELI_LAND = 6
const HELI_SIT = 12
const HELI_OUT = 8
const HELI_SEQ = HELI_IN + HELI_HOVER + HELI_LAND + HELI_SIT + HELI_OUT

export type HeliPhase = 'in' | 'hover' | 'land' | 'sit' | 'out'

export function heliPhaseAt(m: number): { phase: HeliPhase; k: number } | null {
  if (m < HELI_FIRST) return null
  const c = (m - HELI_FIRST) % HELI_EVERY
  if (m - c >= HELI_LAST) return null
  if (c >= HELI_SEQ) return null
  let t = c
  if (t < HELI_IN) return { phase: 'in', k: t / HELI_IN }
  t -= HELI_IN
  if (t < HELI_HOVER) return { phase: 'hover', k: t / HELI_HOVER }
  t -= HELI_HOVER
  if (t < HELI_LAND) return { phase: 'land', k: t / HELI_LAND }
  t -= HELI_LAND
  if (t < HELI_SIT) return { phase: 'sit', k: t / HELI_SIT }
  t -= HELI_SIT
  return { phase: 'out', k: t / HELI_OUT }
}

export function heliPhase(g: Game) {
  return heliPhaseAt(minuteOfDay(g.time))
}

/** True on the minute a helicopter phase begins. */
export function heliMinute(m: number, phase: HeliPhase) {
  const ph = heliPhaseAt(m)
  return ph?.phase === phase && ph.k === 0
}

/** Radians per millisecond. Storms spin the blades hardest. */
export function turbineRate(g: Game) {
  const w = weatherFor(g)
  if (w.storm) return 0.018
  if (w.rain || w.snow) return 0.009
  return 0.004
}

// Same day split as sky-fx weatherFor. Copied so this wave doesn't edit sky-fx.ts.
function dayHash(d: number) {
  let x = (d + 1) * 2654435761
  x ^= x >>> 13
  return (x >>> 0) % 100
}

/** Clear sky after 8pm. Rainy and snowy days don't count, even once the rain has stopped. */
export function clearNight(g: Game, m: number) {
  if (m < 20 * 60) return false
  const d = dayOf(g.time)
  const h = dayHash(d)
  const q = Math.floor(d / 3) % 4
  const snow = q === 3 && h < 55
  const rainy = !snow && h < 18
  return !snow && !rainy
}

/** A little off the quarterly upkeep of rooms on the floor directly underneath. */
export function turbineCut(g: Game) {
  let cut = 0
  for (const t of g.facilities.values()) {
    if (t.kind !== 'turbine') continue
    const below = t.floor - 1
    for (const f of g.facilities.values()) {
      if (f.floor > below || f.floor + f.height - 1 < below) continue
      if (f.x >= t.x + t.width || f.x + f.width <= t.x) continue
      cut += Math.round((FACILITIES[f.kind].upkeep ?? 0) * 0.2)
    }
  }
  return cut
}
