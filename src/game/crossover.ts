// Crossover rooms: Midnight Line, Comic Cop, Creakwood.
// The midnight train is a daily scheduled beat, not a surprise.
import { dayOf, minuteOfDay } from './state'
import { defineSticker } from './stickers'
import { facilitiesOf } from './world'

/** Minutes after midnight the Midnight Express is in the depot. */
export const DEPOT_RUN = 2
/** Day 0 starts here, and Mumbles is finished rearranging. */
const DAWN = 6 * 60

export type DepotCrate = 'candy' | 'cage'

export interface DepotBeat {
  running: boolean
  /** 0–1 while the express is crossing, else 0 when it has not run yet today. */
  progress: number
  crate: DepotCrate | null
}

/**
 * Day 0 begins at 6:00, so the first midnight the player can watch is the start of day 1.
 * Before that the platform is empty. After each run a crate sits out until the next midnight.
 */
export function depotRun(time: number): DepotBeat {
  const day = dayOf(time)
  const m = minuteOfDay(time)
  const seenMidnight = day > 0 || m < DAWN
  if (!seenMidnight) return { running: false, progress: 0, crate: null }
  if (m < DEPOT_RUN) return { running: true, progress: m / DEPOT_RUN, crate: null }
  return { running: false, progress: 1, crate: day % 2 === 0 ? 'candy' : 'cage' }
}

/** 6pm–1am, the window the platform is actually open. */
function depotOpen(minute: number) {
  return minute >= 18 * 60 || minute < 60
}

export function depotPerHour(minute: number) {
  if (!depotOpen(minute)) return 0
  if (minute >= 22 * 60 || minute < 60) return 16
  return 7
}

export function depotStatus(time: number) {
  const b = depotRun(time)
  if (b.running) return 'The Midnight Express is rolling through!'
  if (b.crate === 'candy') return 'A coffin of candy on the platform'
  if (b.crate === 'cage') return 'A rattling cage on the platform'
  if (depotOpen(minuteOfDay(time))) return 'Waiting for midnight'
  return 'Quiet until evening. The express comes at midnight.'
}

export function precinctPerHour() {
  return 6
}

export function precinctStatus() {
  return 'Officer Biscuit is at his desk'
}

function clankyMeal(minute: number): 'lunch' | 'dinner' | null {
  if (minute >= 11 * 60 && minute < 14 * 60) return 'lunch'
  if (minute >= 17 * 60 && minute < 21 * 60) return 'dinner'
  return null
}

export function clankyPerHour(minute: number) {
  return clankyMeal(minute) ? 8 : 0
}

export function clankyStatus(minute: number) {
  switch (clankyMeal(minute)) {
    case 'lunch': return 'Lunch rush — dough in the air!'
    case 'dinner': return 'Dinner — Chef Clanky is spinning dough'
    default: return 'The kitchen is quiet between meals'
  }
}

/** Four lanes across the reading room. Each morning they rotate, so nothing sits where it did yesterday. */
const LANES = [0.16, 0.38, 0.6, 0.82]

export function mumblesLayout(day: number) {
  const shift = ((day % LANES.length) + LANES.length) % LANES.length
  const at = (i: number) => LANES[(i + shift) % LANES.length]
  return { chairs: [at(0), at(1), at(2)], lamp: at(3) }
}

/** Overnight (midnight to 6am) Mumbles slides yesterday's furniture into today's places. */
export function mumblesNow(time: number) {
  const day = dayOf(time)
  const m = minuteOfDay(time)
  const moving = day > 0 && m < DAWN
  const today = mumblesLayout(Math.max(0, day))
  if (!moving) return { chairs: today.chairs, lamp: today.lamp, moving }
  const prev = mumblesLayout(Math.max(0, day - 1))
  const t = m / DAWN
  const mix = (a: number, b: number) => a + (b - a) * t
  return {
    chairs: today.chairs.map((x, i) => mix(prev.chairs[i], x)),
    lamp: mix(prev.lamp, today.lamp),
    moving,
  }
}

export function readingPerHour(weekend: boolean) {
  return weekend ? 8 : 5
}

export function readingStatus(time: number) {
  if (minuteOfDay(time) < DAWN) return 'Mumbles is moving the chairs'
  return 'Notes on the walls, and a lantern on the table'
}

defineSticker({
  id: 'crossover-midnight-line',
  name: 'Crossover: Midnight Line',
  emoji: '🚂',
  hint: 'Build a Ghost Train Depot',
  secret: false,
  check: (g) => facilitiesOf(g, 'ghostDepot').length > 0,
})

defineSticker({
  id: 'crossover-comic-cop',
  name: 'Crossover: Comic Cop',
  emoji: '🐶',
  hint: "Build Biscuit's Precinct or Chef Clanky's Kitchen",
  secret: false,
  check: (g) => facilitiesOf(g, 'precinct').length > 0 || facilitiesOf(g, 'clanky').length > 0,
})

defineSticker({
  id: 'crossover-creakwood',
  name: 'Crossover: Creakwood',
  emoji: '🏮',
  hint: 'Build a Creakwood Reading Room',
  secret: false,
  check: (g) => facilitiesOf(g, 'readingRoom').length > 0,
})
