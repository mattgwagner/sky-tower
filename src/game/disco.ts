// Disco: kids' disco from 4 to 7, night club after, a 10pm dance-off, Disco Fever.
// Hours that cross midnight belong to the day that started them: 1–2am is "weekend"
// only when yesterday was a weekend, because dayOf flips at midnight.
import type { Sfx } from '../audio'
import { personName } from './people-info'
import type { Facility, Game, Person } from './state'
import { dayOf, isWeekend, minuteOfDay } from './state'
import { bump, defineSticker } from './stickers'
import { earn, facilitiesOf, fx, log } from './world'

/** Wired to the sim's sound hook once sim has finished loading. Keeps this file out of that cycle. */
export const discoFx = { play: (_name: Sfx) => {} }

/** 4pm–midnight and midnight–1am. Weekends add 1–2am via discoAfterWeekend. */
export const DISCO_HOURS: [number, number][] = [[16 * 60, 24 * 60], [0, 60]]

/** How long Disco Fever holds the tower. A few sim-minutes: about one real second at 1x. */
export const FEVER_MINUTES = 8

const DANCE_AT = 22 * 60
/** Sim minutes the dance-off stays up. ~8 real seconds at 1x, long enough to see both turns. */
const SHOW = 48
const CHEER_AT = 32
const PRIZE = 2000
const DJ_TILES = 7
const BEAT_MS = 2000
const SHARED_MS = 1000

export const MOVES = ['spin', 'jump', 'robot', 'wave', 'worm'] as const
export type Move = (typeof MOVES)[number]

/** 1am–2am after a weekend night. The clock already says the next day. */
export function discoAfterWeekend(g: Game): boolean {
  const m = minuteOfDay(g.time)
  if (m < 60 || m >= 120) return false
  const prev = dayOf(g.time) - 1
  return prev >= 0 && isWeekend(prev * 1440)
}

export function discoMode(g: Game): 'closed' | 'kids' | 'club' {
  const m = minuteOfDay(g.time)
  const open = DISCO_HOURS.some(([a, b]) => m >= a && m < b) || discoAfterWeekend(g)
  if (!open) return 'closed'
  return m >= 16 * 60 && m < 19 * 60 ? 'kids' : 'club'
}

/** Low during the kids' disco, high after 9pm. Weekends are busier. */
export function discoPerHour(g: Game): number {
  const m = minuteOfDay(g.time)
  const late = isWeekend(g.time) || discoAfterWeekend(g)
  if (m >= 16 * 60 && m < 19 * 60) return late ? 7 : 5
  if (m >= 21 * 60 || m < 2 * 60) return late ? 25 : 18
  return late ? 13 : 9
}

export function discoStatus(g: Game, f: Facility): string | null {
  if (f.fire || !f.reachable) return null
  const mode = discoMode(g)
  if (mode === 'kids') return "Kids' Disco is on! 🫧"
  if (mode === 'club') return 'Night club is open 🪩'
  return 'Closed. Come back at 4!'
}

export function feverOn(g: Game): boolean {
  const t = g.flags.discoFever
  return t != null && g.time >= t && g.time < t + FEVER_MINUTES
}

/** One full turn about every 3/4 of a real second, or null when the tower is not feverish. */
export function feverSpin(g: Game, now: number, id: number): number | null {
  if (!feverOn(g)) return null
  return (now / 120 + id) % (Math.PI * 2)
}

export function startDiscoFever(g: Game) {
  if (feverOn(g)) return
  const built = facilitiesOf(g, 'disco')
  const f = built.find((r) => r.reachable && r.fire <= 0) ?? built[0]
  if (!f) return
  g.flags.discoFever = g.time
  bump(g, 'discoFever')
  log(g, 'Disco Fever! The whole tower is dancing! 🪩', 'event', f.floor, f.x + f.width / 2)
  discoFx.play('party')
}

export type DancePhase = 'cut' | 'a' | 'b' | 'winner'

export function danceOffNow(g: Game): {
  phase: DancePhase
  a: string
  b: string
  winner: 0 | 1
  floor: number
  x: number
  id: number
} | null {
  const d = g.flags.danceOff
  if (!d) return null
  const t = g.time - d.start
  if (t < 0 || t > SHOW) return null
  const phase: DancePhase = t < 8 ? 'cut' : t < 20 ? 'a' : t < CHEER_AT ? 'b' : 'winner'
  return { phase, a: d.a, b: d.b, winner: d.winner, floor: d.floor, x: d.x, id: d.id }
}

function insidePeople(g: Game, id: number): Person[] {
  const out: Person[] = []
  for (const p of g.people.values()) if (p.state === 'inside' && p.at === id) out.push(p)
  return out
}

export function discoMinute(g: Game, m: number) {
  if (m === 120) {
    const prev = dayOf(g.time) - 1
    if (prev >= 0 && isWeekend(prev * 1440) && facilitiesOf(g, 'disco').some((f) => f.reachable && f.fire <= 0))
      bump(g, 'discoLate')
  }
  const show = g.flags.danceOff
  if (show && !show.told && g.time >= show.start + CHEER_AT) {
    show.told = true
    const name = show.winner === 0 ? show.a : show.b
    log(g, `Dance-off winner: ${name}!`, 'event', show.floor, show.x)
    const f = g.facilities.get(show.id)
    if (f) {
      const v = earn(g, PRIZE)
      f.incomeToday += v
      f.incomeTotal += v
      fx(g, f.x + f.width / 2, f.floor + f.height - 1, `🏆 +$${v.toLocaleString()}`, '#ffd43b')
    }
    discoFx.play('party')
  }
  if (m !== DANCE_AT) return
  if (g.flags.danceOff && dayOf(g.flags.danceOff.start) === dayOf(g.time)) return
  for (const f of facilitiesOf(g, 'disco')) {
    if (f.fire > 0 || !f.reachable || f.inside < 4) continue
    const people = insidePeople(g, f.id)
    const winner = (dayOf(g.time) + f.id) % 2 === 0 ? 0 : 1
    g.flags.danceOff = {
      id: f.id,
      start: g.time,
      a: people[0] ? personName(people[0]) : 'Boogie',
      b: people[1] ? personName(people[1]) : 'Twirl',
      winner,
      floor: f.floor + f.height - 1,
      x: f.x + f.width / 2,
      told: false,
    }
    bump(g, 'danceOffs')
    fx(g, f.x + f.width / 2, f.floor + f.height - 1, 'Dance-off! 🏆', '#da77f2')
    discoFx.play('scratch')
    break
  }
}

export function discoDancerCount(inside: number) {
  return Math.min(8, 3 + Math.min(5, Math.max(0, inside)))
}

export function discoZone(f: Facility, tile: number, floor: number): 'dj' | 'tile' | 'room' {
  if (floor !== f.floor) return 'room'
  const local = tile - f.x
  if (local >= f.width - DJ_TILES) return 'dj'
  if (local >= 2) return 'tile'
  return 'room'
}

export function discoSlotAt(width: number, localTile: number, inside: number): number {
  const slots = discoDancerCount(inside)
  const span = Math.max(1, width - DJ_TILES - 2)
  const t = Math.max(0, Math.min(span - 1, localTile - 2))
  return Math.min(slots - 1, Math.floor((t / span) * slots))
}

/** Wall-clock beat. Shared move holds for about a second, then everyone goes back to their own. */
export function discoBeat(now: number) {
  return Math.floor(now / BEAT_MS)
}

export function discoShared(now: number) {
  return now % BEAT_MS < SHARED_MS
}

export function moveAt(seed: number, now: number): Move {
  if (discoShared(now)) return MOVES[discoBeat(now) % MOVES.length]
  return MOVES[Math.abs(seed) % MOVES.length]
}

const flashes = new Map<number, { tile: number; at: number }>()
const spins = new Map<number, { slot: number; at: number }>()
const freezes = new Map<number, number>()
const bubbles = new Map<number, number>()
let flashCount = 0

export function discoFlashCount() {
  return flashCount
}

export function discoFlashTile(id: number, now: number): number | null {
  const f = flashes.get(id)
  if (!f || now - f.at > 400) return null
  return f.tile
}

export function discoSpinSlot(id: number, now: number): number | null {
  const s = spins.get(id)
  if (!s || now - s.at > 900) return null
  return s.slot
}

export function discoFrozen(g: Game, id: number) {
  return (freezes.get(id) ?? -1) > g.time
}

export function discoBubbling(g: Game, id: number) {
  return (bubbles.get(id) ?? -1) > g.time
}

export function discoPoke(g: Game, f: Facility, now: number, tile: number, floor: number): Sfx {
  const zone = discoZone(f, tile, floor)
  if (zone === 'dj') {
    g.flags.discoPattern = (g.flags.discoPattern ?? 0) + 1
    fx(g, f.x + f.width - 3, f.floor, 'DROP THE BEAT! 🎧', '#da77f2')
    return 'scratch'
  }
  if (zone === 'tile') {
    const local = tile - f.x
    flashes.set(f.id, { tile, at: now })
    spins.set(f.id, { slot: discoSlotAt(f.width, local, f.inside), at: now })
    flashCount++
    return 'pop'
  }
  if (Math.random() < 0.5) {
    freezes.set(f.id, g.time + 1.5)
    fx(g, f.x + f.width / 2, f.floor + 1, 'Everybody FREEZE! … ok go', '#74c0fc')
  } else {
    bubbles.set(f.id, g.time + 2)
    fx(g, f.x + 4, f.floor + 1, 'Bubbles! 🫧', '#a5d8ff')
  }
  return 'pop'
}

defineSticker({
  id: 'dance-off',
  name: 'Dance-Off',
  emoji: '🏆',
  hint: 'Have a dance-off at 10pm',
  secret: false,
  check: (g) => (g.counters.danceOffs ?? 0) > 0,
})
defineSticker({
  id: 'disco-fever',
  name: 'Disco Fever',
  emoji: '🪩',
  hint: 'Catch Disco Fever',
  secret: false,
  check: (g) => (g.counters.discoFever ?? 0) > 0,
})
defineSticker({
  id: 'disco-late',
  name: 'Till 2am',
  emoji: '🌙',
  hint: 'Keep a Disco open till 2am',
  secret: false,
  check: (g) => (g.counters.discoLate ?? 0) > 0,
})
