// Surprises: at most one random event a day, drawn once at midnight, and some days nothing.
// Scheduled things (noon rocket, roars, trains, holidays) don't come through here. Anything that
// rolls dice to happen goes in SURPRISES; its module keeps the timing and the show, only the
// decision lives here.
import type { Game } from './state'
import { dayOf, isWeekend } from './state'
import { isHotel } from './defs'
import { facilitiesOf, topFloor } from './world'
import { escapeMonkey } from './zoo'
import { dayIsClear, startGiant } from './giants'
import { startDiscoFever } from './disco'
import { releaseHuggy, startEntity, startUfo, startVip } from './sim'
import { DOORS, showAt, startMysteryBand } from './concert'

export type SurpriseId = 'huggy' | 'monkey' | 'rush' | 'seek' | 'ufo' | 'ape' | 'dragon' | 'skywriter' | 'vip' | 'mysteryBand' | 'disco'

interface Surprise {
  id: SurpriseId
  /** Roughly how many times a week this shows up, when it is eligible. */
  weight: number
  /** Can this tower have it on `day`? Checked once, at the draw. */
  eligible(g: Game, day: number): boolean
  /** Minutes after midnight of the drawn day when it starts. Past 1440 runs into the next morning. */
  at(g: Game, day: number): number
  start(g: Game): void
}

/** Days in a week, for turning weekly weights into a daily chance. */
const WEEK = 7
/** At most this many surprise days a week, however much the tower has. The rest are quiet. */
const MAX_PER_WEEK = 4

/** Night surprises still running after midnight, so the next day can't open with a dragon on top of them. */
const LATE: SurpriseId[] = ['huggy', 'rush', 'seek']

/** A stable 32-bit roll for this tower on this day. */
export function surpriseHash(g: Game, day: number, salt = 0) {
  let x = Math.imul(day + 1, 0x9e3779b1) ^ Math.imul((g.flags.seed ?? 0) + salt + 1, 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

const hotelRooms = (g: Game) => [...g.facilities.values()].filter((f) => isHotel(f.kind)).length
const perch = (g: Game) => facilitiesOf(g, 'rocketPad').length > 0 || facilitiesOf(g, 'cathedral').length > 0
const vipStaying = (g: Game) => [...g.people.values()].some((p) => p.kind === 'vip')
const lateNight = (g: Game) => {
  const prev = g.flags.surprise
  return !!prev?.id && LATE.includes(prev.id)
}

export const SURPRISES: Surprise[] = [
  { id: 'huggy', weight: 1, eligible: (g) => facilitiesOf(g, 'toyFactory').some((f) => f.reachable), at: () => 20 * 60, start: (g) => releaseHuggy(g) },
  { id: 'monkey', weight: 1, eligible: (g) => facilitiesOf(g, 'zoo').length > 0, at: () => 10 * 60, start: (g) => escapeMonkey(g) },
  // Rush and Seek share about one night a week, at an hour between 9pm and 4am.
  { id: 'rush', weight: 0.6, eligible: (g) => hotelRooms(g) >= 2, at: (g, d) => (21 + (surpriseHash(g, d, 7) % 8)) * 60, start: (g) => startEntity(g, 'rush') },
  { id: 'seek', weight: 0.4, eligible: (g) => topFloor(g) >= 5, at: (g, d) => (21 + (surpriseHash(g, d, 7) % 8)) * 60, start: (g) => startEntity(g, 'seek') },
  { id: 'ufo', weight: 0.5, eligible: (g) => topFloor(g) >= 4, at: () => 22 * 60, start: (g) => startUfo(g) },
  // The giants share about one visit every two weeks.
  { id: 'ape', weight: 1 / 6, eligible: (g) => topFloor(g) >= 20, at: () => 18 * 60, start: (g) => startGiant(g, 'ape') },
  { id: 'dragon', weight: 1 / 6, eligible: (g) => perch(g) && !lateNight(g), at: () => 10, start: (g) => startGiant(g, 'dragon') },
  { id: 'skywriter', weight: 1 / 6, eligible: (_g, d) => dayIsClear(d), at: () => 14 * 60, start: (g) => startGiant(g, 'skywriter') },
  // A secret act at the Concert Hall about once every three weeks, announced when the doors open.
  { id: 'mysteryBand', weight: 0.4, eligible: (g) => facilitiesOf(g, 'concertHall').some((f) => f.reachable), at: (_g, d) => showAt(d) - DOORS, start: (g) => startMysteryBand(g) },
  // Filler: a VIP visit on a weekday once the hotel has a Suite, and not while the last one is still checking out.
  { id: 'vip', weight: 0.5, eligible: (g, d) => !g.flags.vip && g.stars >= 3 && !isWeekend(d * 1440) && facilitiesOf(g, 'hotelSuite').length > 0 && !vipStaying(g), at: () => 13 * 60, start: (g) => startVip(g) },
  // Light weight so a UFO still lands in surprisecheck's seed-2 month, and Disco Fever still shows up.
  { id: 'disco', weight: 0.45, eligible: (g) => facilitiesOf(g, 'disco').length > 0, at: () => 21 * 60, start: (g) => startDiscoFever(g) },
]

const byId = (id: SurpriseId) => SURPRISES.find((s) => s.id === id)!

/** Pick `day`'s surprise, or nothing. The same tower and day always draw the same thing. */
export function drawSurprise(g: Game, day: number): SurpriseId | null {
  const pool = SURPRISES.filter((s) => s.eligible(g, day))
  const total = pool.reduce((a, s) => a + s.weight, 0)
  if (!total) return null
  const chance = Math.min(total, MAX_PER_WEEK) / WEEK
  const u = surpriseHash(g, day) / 2 ** 32
  if (u >= chance) return null
  let r = (u / chance) * total
  for (const s of pool) {
    r -= s.weight
    if (r < 0) return s.id
  }
  return pool[pool.length - 1]!.id
}

/** Midnight: yesterday's surprise moves to `lastSurprise` and today's is drawn. */
export function surpriseDay(g: Game) {
  const day = dayOf(g.time)
  g.flags.seed ??= Math.floor(Math.random() * 2 ** 31)
  if (g.flags.surprise?.day === day) return
  g.flags.lastSurprise = g.flags.surprise ?? null
  const id = drawSurprise(g, day)
  g.flags.surprise = { id, day, at: id ? byId(id).at(g, day) : 0 }
}

/** Every sim minute: start today's surprise, or last night's if it was due after midnight. */
export function surpriseMinute(g: Game) {
  // a save from before surprises.ts draws today when it loads, not at the next midnight
  if (g.flags.surprise === undefined) surpriseDay(g)
  const t = Math.round(g.time)
  for (const s of [g.flags.lastSurprise, g.flags.surprise]) {
    if (s?.id && s.day * 1440 + s.at === t) byId(s.id).start(g)
  }
}

/** Dev knob: make `id` today's surprise instead of the drawn one, and start it right now. */
export function forceSurprise(g: Game, id: SurpriseId) {
  const s = byId(id)
  if (!s) return false
  // at -1 is already past, so surpriseMinute won't start it a second time
  g.flags.surprise = { id, day: dayOf(g.time), at: -1 }
  s.start(g)
  return true
}
