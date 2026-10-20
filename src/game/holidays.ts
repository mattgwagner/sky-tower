// The holiday calendar: Spooky Week, Snow Day, Heart Day, the Tower Birthday, and the New Year countdown.
// Everything here keys off the in-game day, so a holiday is the same whether you play it or skip past it.
import type { FacilityKind } from './defs'
import type { Facility, Game, Person, PersonKind } from './state'
import { dayOf, minuteOfDay } from './state'
import { facilitiesOf, fx, log, topFloor } from './world'

export const YEAR_DAYS = 12
const at = (h: number, m = 0) => h * 60 + m
const quarterIndex = (d: number) => Math.floor(d / 3) % 4

/** A stable 0..99 roll for a day. The weather uses it too, so Snow Day and the snow always agree. */
export function dayHash(d: number) {
  let x = (d + 1) * 2654435761
  x ^= x >>> 13
  return (x >>> 0) % 100
}

/** Winter is quarter 4; a bit over half its days snow. */
export const snowsOn = (d: number) => quarterIndex(d) === 3 && dayHash(d) < 55

export type HolidayId = 'spooky' | 'snow' | 'heart' | 'birthday'
export interface Holiday { id: HolidayId; name: string; emoji: string; day: number }

/** Today's holiday, or null. `day` counts from 1 for holidays that last more than one day. */
export function holidayFor(g: Game, d = dayOf(g.time)): Holiday | null {
  const founded = g.flags.founded
  if (founded !== undefined && d > founded && (d - founded) % YEAR_DAYS === 0) return { id: 'birthday', name: 'Tower Birthday', emoji: '🎂', day: 1 }
  const q = quarterIndex(d)
  if (q === 2) return { id: 'spooky', name: 'Spooky Week', emoji: '🎃', day: (d % 3) + 1 }
  if (q === 0 && d % 3 === 1) return { id: 'heart', name: 'Heart Day', emoji: '❤️', day: 1 }
  if (snowsOn(d) && !(d % 3 >= 1 && snowsOn(d - 1)) && !(d % 3 === 2 && snowsOn(d - 2))) return { id: 'snow', name: 'Snow Day', emoji: '⛄', day: 1 }
  return null
}

export const isHoliday = (g: Game, id: HolidayId) => holidayFor(g)?.id === id

/** Game minutes left in the year during the last ten, else null. */
export function newYearCountdown(g: Game): number | null {
  const d = dayOf(g.time)
  const m = minuteOfDay(g.time)
  if (d % YEAR_DAYS !== YEAR_DAYS - 1 || m < at(23, 50)) return null
  return Math.max(1, Math.ceil(1440 - m))
}

/** The first hour and a half of a new year (not the very first day of the game). */
export function newYearSplash(g: Game) {
  const d = dayOf(g.time)
  return d > 0 && d % YEAR_DAYS === 0 && minuteOfDay(g.time) < 90
}

export const isTreater = (p: Person) => p.costume !== undefined

/** The little top-bar badge: the countdown, the New Year cheer, or today's holiday. */
export function holidayBadge(g: Game): string | null {
  const left = newYearCountdown(g)
  if (left !== null) return `🎆 ${left}…`
  if (newYearSplash(g)) return '🎆 Happy New Year!'
  const h = holidayFor(g)
  if (!h) return null
  if (h.id === 'spooky') {
    let n = 0
    for (const p of g.people.values()) if (isTreater(p)) n++
    if (n) return `${h.emoji} ${h.name} · 🍬 ${n}`
  }
  return `${h.emoji} ${h.name}`
}

/** What the blimp's banner says: hearts on Heart Day. */
export const holidayBanner = (g: Game, text: string) => isHoliday(g, 'heart') ? `❤️ ${text} ❤️` : text

/** Spooky Week packs the Candy Shop and the Haunted House. */
export function holidayRush(g: Game, kind: FacilityKind) {
  return (kind === 'candy' || kind === 'hauntedHouse') && isHoliday(g, 'spooky') ? 2 : 1
}

/** The Party Hall opens on the tower's birthday even on a weekday, and the party is free. */
export const partyDay = (g: Game) => isHoliday(g, 'birthday')

const NEWS: Record<HolidayId, (g: Game) => string> = {
  spooky: () => '🎃 Spooky Week starts today! Trick-or-treaters come out at 6pm. 🦇',
  snow: () => '⛄ SNOW DAY! Snowmen in the Sky Parks and snowball fights outside!',
  heart: () => '❤️ Happy Heart Day! Love is in the air (and in the elevators).',
  birthday: (g) => `🎂 Happy birthday, ${g.name?.trim() || 'Sky Tower'}! Free party in the Party Hall, fireworks at 8pm!`,
}

// ---------- trick-or-treaters ----------

/** The parts of the sim the trick-or-treaters need, passed in by sim.ts. */
export interface HolidaySim {
  newPerson: (g: Game, kind: PersonKind, home: number) => Person
  startTrip: (g: Game, p: Person, goalFac: number, purpose: string) => boolean
  evict: (g: Game, pid: number) => void
  schedule: (p: Person, t: number, act: string) => void
}

export const COSTUMES = ['ghost', 'dino', 'astronaut'] as const
const KNOCKS = 4
const TREAT_WAVES = [at(18), at(19), at(20)]

/** About one trick-or-treater per 40 people, never more than 12. */
export const treaterCount = (pop: number) => Math.max(2, Math.min(12, Math.round(pop / 40)))

const homes = (g: Game) => facilitiesOf(g, 'condo').filter((f) => f.occupied && f.reachable && !f.fire)

function nextDoor(g: Game, skip: number, floor: number): Facility | null {
  const list = homes(g).filter((f) => f.id !== skip)
  if (!list.length) return null
  const same = list.filter((f) => f.floor === floor)
  const from = same.length && Math.random() < 0.7 ? same : list
  return from[Math.floor(Math.random() * from.length)]
}

function spawnTreaters(g: Game, n: number, sim: HolidaySim) {
  for (let i = 0; i < n; i++) {
    const door = nextDoor(g, 0, 0)
    if (!door) return
    const p = sim.newPerson(g, 'visitor', 0)
    p.costume = p.id % COSTUMES.length
    p.task = 0
    if (!sim.startTrip(g, p, door.id, 'trick')) g.people.delete(p.id)
  }
}

/** A trick-or-treater reached a condo door: knock, wait for candy. */
export function trickArrive(g: Game, p: Person, door: Facility | undefined, enter: (f: Facility) => void, sim: HolidaySim) {
  if (!door) return sim.evict(g, p.id)
  enter(door)
  p.task++
  if (p.task === 1 || Math.random() < 0.5) fx(g, door.x + door.width / 2, door.floor, 'Trick or treat! 🎃', '#ffa94d')
  sim.schedule(p, g.time + 4 + Math.random() * 6, 'trick')
}

/** Candy in the bag, then the next door, or home once the bag is full or it's past 9pm. */
export function trickNext(g: Game, p: Person, sim: HolidaySim) {
  if (p.state === 'inside') fx(g, p.x, p.floor, '🍬', '#f783ac')
  const late = minuteOfDay(g.time) >= at(21)
  const door = late || p.task >= KNOCKS ? null : nextDoor(g, p.at, p.floor)
  if (door && sim.startTrip(g, p, door.id, 'trick')) return
  if (!sim.startTrip(g, p, 0, 'exit')) sim.evict(g, p.id)
}

// ---------- the daily hook ----------

/** Called once an hour from the sim. */
export function stepHoliday(g: Game, m: number, sim: HolidaySim) {
  const d = dayOf(g.time)
  g.flags.founded ??= d
  if (m === 0 && d > 0 && d % YEAR_DAYS === 0) log(g, `🎆 HAPPY NEW YEAR! Welcome to Year ${d / YEAR_DAYS + 1}!`, 'event')
  const h = holidayFor(g)
  if (m === at(6) && h?.day === 1) log(g, NEWS[h.id](g), 'event')
  if (h?.id === 'spooky') {
    const wave = TREAT_WAVES.indexOf(m)
    if (wave >= 0) {
      const n = treaterCount(g.pop), k = TREAT_WAVES.length
      spawnTreaters(g, Math.floor((n * (wave + 1)) / k) - Math.floor((n * wave) / k), sim)
    }
  }
  if (h?.id === 'birthday' && m === at(12)) {
    const top = topFloor(g)
    const r = g.floors.get(top)
    const mid = r ? (r.findIndex((v) => v !== -1) + r.findLastIndex((v) => v !== -1) + 1) / 2 : 0
    fx(g, mid, top + 1, '🎂 HAPPY BIRTHDAY! 🎂', '#ffd43b')
    for (const f of facilitiesOf(g, 'partyHall')) fx(g, f.x + f.width / 2, f.floor + 1, '🎉 Free party! 🎂', '#ff7ad9')
  }
  // everyone in a costume is home by 10pm
  if (m === at(22)) for (const p of [...g.people.values()]) if (isTreater(p)) sim.evict(g, p.id)
}
