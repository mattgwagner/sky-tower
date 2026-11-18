// Crossovers A (#20): rooms from Door Codes, Midnight Hotel, Night Shift and Math Maker. Crossovers B (#21) is crossover.ts.
// Characters keep their home-game look and verbs. Everything a room shows is a pure function of the
// sim clock and the room, so nothing new goes in the save. The only lasting effect is the Math
// Maker's free floor tile at noon, which is ordinary floor.
import type { FacilityKind } from './defs'
import type { Facility, Game, Person } from './state'
import { minuteOfDay } from './state'
import type { Sfx } from '../audio'
import { checkFacility, fx } from './world'
import { defineSticker } from './stickers'

export const CROSSOVER_A_KINDS = ['doorHall', 'karaoke', 'mortimerShop', 'lightsOutHall', 'lampHall', 'mathWorkshop'] as const
export type CrossoverAKind = (typeof CROSSOVER_A_KINDS)[number]

export function isCrossoverA(k: FacilityKind): k is CrossoverAKind {
  return (CROSSOVER_A_KINDS as readonly string[]).includes(k)
}

const at = (h: number, m = 0) => h * 60 + m
const mins = (g: Game) => Math.floor(minuteOfDay(g.time))
const night = (m: number) => m >= at(19) || m < at(6)

/** A small stable hash, so a room's pick changes with the clock but not between frames. */
export function crossHash(a: number, b: number) {
  let x = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d)
  x ^= x >>> 13
  return x >>> 0
}

/** Visitors an hour, before demand and appeal. Busiest when the home game is. */
export function crossPerHour(g: Game, k: CrossoverAKind) {
  const m = mins(g)
  switch (k) {
    case 'doorHall': return m >= at(18) ? 9 : 6
    case 'karaoke': return 5
    case 'mortimerShop': return 4
    case 'lightsOutHall': return night(m) ? 11 : 4
    case 'lampHall': return night(m) ? 8 : 4
    case 'mathWorkshop': return m >= at(11) && m < at(13) ? 7 : 4
  }
}

// ---------- Door Hall ----------

export const DOOR_MONSTERS = ['Grumble', 'Hoot', 'Fluff', 'Squirm', 'Clonk'] as const
export type DoorMonster = (typeof DOOR_MONSTERS)[number]
/** Sim minutes between peeks, and how long a door stays open. */
const PEEK_EVERY = 20
const PEEK_FOR = 6
export const DOORS_PER_FLOOR = 4

/** The door that's open right now and who's peeking out of it, or null between peeks. */
export function doorPeek(g: Game, f: Facility): { door: number; who: DoorMonster; t: number } | null {
  const forced = pokedPeek.get(f.id)
  if (forced && g.time - forced.t >= 0 && g.time - forced.t < PEEK_FOR) return { door: forced.door, who: forced.who, t: g.time - forced.t }
  const m = mins(g)
  const slot = Math.floor(g.time / PEEK_EVERY)
  const t = g.time - slot * PEEK_EVERY
  if (t >= PEEK_FOR || m < at(10) || m >= at(22)) return null
  return {
    door: crossHash(f.id, slot) % (DOORS_PER_FLOOR * f.height),
    who: DOOR_MONSTERS[slot % DOOR_MONSTERS.length],
    t,
  }
}

/** The number on the hall's big counter: how many doors visitors walked through today. */
export function doorCount(f: Facility) {
  return f.customersToday * DOORS_PER_FLOOR
}

// ---------- Crooner's Karaoke ----------

/** Crooner takes the stage for the first ten minutes of every hour the lounge is open. */
export function croonerSinging(g: Game) {
  const m = mins(g)
  return m % 60 < 10 && m >= at(12) && m < at(23)
}

// ---------- Mortimer's Shop ----------

export const MORTIMER_STOCK = [
  { name: 'Fresh battery', emoji: '🔋' },
  { name: 'Skeleton key', emoji: '🔑' },
  { name: 'Mega flashlight', emoji: '🔦' },
  { name: 'Lucky sock', emoji: '🧦' },
] as const

/** Sim minutes a shopper carries what they bought before putting it away. */
const CARRY_FOR = 60
/** Shoppers walking out of Mortimer's with something. Not saved: it's what they're holding on the way out. */
const bought = new WeakMap<Person, { item: number; t: number }>()
export function boughtItem(g: Game, p: Person): number | undefined {
  const b = bought.get(p)
  return b && g.time - b.t < CARRY_FOR ? b.item : undefined
}

/** Called as a shopper leaves any room. */
export function crossLeave(g: Game, p: Person) {
  const f = g.facilities.get(p.at)
  if (f?.kind === 'mortimerShop') bought.set(p, { item: p.id % MORTIMER_STOCK.length, t: g.time })
}

// ---------- Lights-Out Hall ----------

/** Giggles hides somewhere new every 45 minutes: which of the hall's spots, and is he peeking. */
export function gigglesSpot(g: Game, f: Facility) {
  const slot = Math.floor(g.time / 45) + (gigglesMoved.get(f.id) ?? 0)
  return { spot: crossHash(f.id + 99, slot) % 6, peeking: g.time % 45 > 6 }
}

// ---------- Lamp Hall ----------

/** Every 90 minutes the lamps flicker for 8 and everyone hides. Returns minutes into the flicker, or null. */
export function lampFlicker(g: Game, f: Facility): number | null {
  const forced = pokedFlicker.get(f.id)
  if (forced != null && g.time - forced >= 0 && g.time - forced < 8) return g.time - forced
  const t = (g.time + f.id * 13) % 90
  return t < 8 ? t : null
}

// ---------- Math Maker's Workshop ----------

/** He sets off any time in this window if today's tile isn't done, so a reload mid-walk only restarts the show. */
const WALK_FROM = at(12)
const WALK_UNTIL = at(12, 30)
type Walk = { x: number; floor: number; t: number; day: number; painted: boolean }
/** Today's walk out to paint a tile, per tower (room ids repeat across saved towers). Not saved. */
const walksByGame = new WeakMap<Game, Map<number, Walk>>()
function walksOf(g: Game) {
  let m = walksByGame.get(g)
  if (!m) walksByGame.set(g, (m = new Map()))
  return m
}
export function makerWalk(g: Game, f: Facility) {
  const w = walksOf(g).get(f.id)
  if (!w || g.time - w.t > 20) return null
  return { ...w, t: g.time - w.t }
}

/** The bare tile next to the workshop he can paint, nearest first, or null if there's no room. */
export function makerTarget(g: Game, f: Facility): number | null {
  const r = g.floors.get(f.floor)
  if (!r) return null
  for (let d = 0; d < 6; d++) {
    for (const x of [f.x + f.width + d, f.x - 1 - d]) {
      if (x < 0 || x >= r.length) continue
      if (r[x] !== -1) continue
      if (!canPaint(g, x, f.floor)) continue
      return x
    }
  }
  return null
}

/** The build rules for one tile of floor, minus the price: the tile is free, so being broke doesn't block it. */
function canPaint(g: Game, x: number, floor: number) {
  const chk = checkFacility(g, 'floor', x, floor, 1)
  return chk.ok || chk.reason === 'Not enough money'
}

/** Lay the tile directly, not through placeFacility: no charge, and no basement gold roll for a tile nobody dug. */
function paintTile(g: Game, w: { x: number; floor: number }) {
  const r = g.floors.get(w.floor)
  if (!r || r[w.x] !== -1 || !canPaint(g, w.x, w.floor)) return false
  r[w.x] = 0
  g.buildVersion++
  return true
}

// ---------- every minute ----------

export function crossMinute(g: Game, m: number) {
  const walks = walksOf(g)
  for (const f of g.facilities.values()) {
    if (f.kind !== 'mathWorkshop' || !f.reachable || f.fire) continue
    const day = Math.floor(g.time / 1440)
    if (m >= WALK_FROM && m < WALK_UNTIL && walks.get(f.id)?.day !== day) {
      const x = makerTarget(g, f)
      if (x != null) walks.set(f.id, { x, floor: f.floor, t: g.time, day, painted: false })
    }
    const w = walks.get(f.id)
    if (w && !w.painted && g.time - w.t >= 8) {
      w.painted = true
      if (paintTile(g, w)) {
        g.counters['cross:tiles'] = (g.counters['cross:tiles'] ?? 0) + 1
        fx(g, w.x + 0.5, w.floor, '🪚 Free floor!', '#9ff5d5')
      }
    }
  }
}

// ---------- pokes ----------

const pokedPeek = new Map<number, { door: number; who: DoorMonster; t: number }>()
const gigglesMoved = new Map<number, number>()
const pokedFlicker = new Map<number, number>()
const pencilTip = new Map<number, number>()

/** When the Math Maker last tipped his pencil, in real ms, for the renderer. */
export function pencilTippedAt(f: Facility) {
  return pencilTip.get(f.id) ?? -1e9
}

const PEEK_SAYS: Record<DoorMonster, string> = {
  Grumble: 'Zzz… GRUMBLE! 🎵',
  Hoot: 'Hoo goes there? 🦉',
  Fluff: 'Boing! Boing! 🐰',
  Squirm: '*dig dig dig* 🪱',
  Clonk: 'THOOM… THOOM… 🧱',
}
const CROONER_SAYS = ['Is this thing on? 🎤', 'Sing along, kid! 🎶', 'Testing… one, two… GREAT.', 'It\'s CROONER! ⭐']
const MORTIMER_SAYS = ['Mmmph! Everything\'s for sale. 🔋', 'Mmmph! 🔑', 'Mmmph… lucky sock? 🧦', 'Thanks, Mortimer! ✨']
const LAMP_SAYS = ['When the lights flicker… HIDE! 💡', '*creak* … *swing* …', 'Close call. It went right past you.']

/** Tap a crossover room. Returns the sound, or null if it isn't one. */
export function crossPoke(g: Game, f: Facility, now: number, tile: number, floor: number): Sfx | null {
  const top = f.floor + f.height - 1
  switch (f.kind) {
    case 'doorHall': {
      const row = Math.max(0, Math.min(f.height - 1, floor - f.floor))
      const col = Math.max(0, Math.min(DOORS_PER_FLOOR - 1, Math.floor(((tile - f.x) / f.width) * DOORS_PER_FLOOR)))
      const who = DOOR_MONSTERS[Math.floor(Math.random() * DOOR_MONSTERS.length)]
      pokedPeek.set(f.id, { door: row * DOORS_PER_FLOOR + col, who, t: g.time })
      fx(g, tile + 0.5, f.floor + row, PEEK_SAYS[who], '#f5c542')
      return who === 'Clonk' || who === 'Grumble' ? 'roar' : 'boing'
    }
    case 'karaoke':
      fx(g, f.x + f.width / 2, top, CROONER_SAYS[Math.floor(Math.random() * CROONER_SAYS.length)], '#5fb4e8')
      return 'party'
    case 'mortimerShop':
      fx(g, f.x + f.width / 2, top, MORTIMER_SAYS[Math.floor(Math.random() * MORTIMER_SAYS.length)], '#7dff9a')
      return 'spooky'
    case 'lightsOutHall': {
      gigglesMoved.set(f.id, (gigglesMoved.get(f.id) ?? 0) + 1)
      fx(g, f.x + f.width / 2, top, Math.random() < 0.5 ? 'You found me! 👻' : 'Hee hee! He hid somewhere else!', '#bfefff')
      return 'twinkle'
    }
    case 'lampHall':
      pokedFlicker.set(f.id, g.time)
      fx(g, f.x + f.width / 2, top, LAMP_SAYS[Math.floor(Math.random() * LAMP_SAYS.length)], '#ffcf7a')
      return 'flicker'
    case 'mathWorkshop':
      pencilTip.set(f.id, now)
      fx(g, f.x + f.width / 2, top, 'Measure twice, hammer once! ✏️', '#9ff5d5')
      return 'click'
  }
  return null
}

// ---------- stickers ----------

const has = (g: Game, kinds: FacilityKind[]) => [...g.facilities.values()].some((f) => kinds.includes(f.kind))

defineSticker({ id: 'cross-door-codes', name: 'Crossover: Door Codes', emoji: '🚪', hint: 'Build a Door Hall or Crooner\'s Karaoke', secret: false,
  check: (g) => has(g, ['doorHall', 'karaoke']) })
defineSticker({ id: 'cross-midnight-hotel', name: 'Crossover: Midnight Hotel', emoji: '🧦', hint: 'Build Mortimer\'s Shop or a Lights-Out Hall', secret: false,
  check: (g) => has(g, ['mortimerShop', 'lightsOutHall']) })
defineSticker({ id: 'cross-night-shift', name: 'Crossover: Night Shift', emoji: '💡', hint: 'Build a Lamp Hall', secret: false,
  check: (g) => has(g, ['lampHall']) })
defineSticker({ id: 'cross-math-maker', name: 'Crossover: Math Maker', emoji: '🔨', hint: 'Build the Math Maker\'s Workshop', secret: false,
  check: (g) => has(g, ['mathWorkshop']) })
