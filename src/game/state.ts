import type { FacilityKind, Mode, RentLevel, TransportKind } from './defs'
import { MAX_FLOOR, MIN_FLOOR, TOWER_WIDTH } from './defs'

export interface Facility {
  id: number
  kind: FacilityKind
  x: number
  floor: number // bottom floor
  width: number
  height: number
  occupied: boolean // tenants moved in / staffed / guests checked in tonight
  rent: RentLevel
  happiness: number // 0-100
  stressAvg: number // EMA of occupants' trip stress
  complaints: string[]
  inside: number // people currently inside
  dirty: boolean
  dirtySince: number // day index
  roaches: boolean
  cleaner: number // person id of assigned housekeeper, 0 = none
  booked: boolean // hotel: guest(s) assigned tonight
  rentedLastNight: boolean
  customersToday: number
  customersYesterday: number
  incomeToday: number
  incomeTotal: number
  fire: number // 0 = none, 0..1 intensity
  reachable: boolean
  noisy: boolean
  sad: number // consecutive unhappy days
  name?: string
  nearPark?: boolean
  rides?: number // mega slide: rides today
}

export interface Car {
  floor: number
  sub: number // steps travelled toward next floor
  dir: -1 | 0 | 1
  state: 'idle' | 'moving' | 'doors'
  timer: number
  riders: number[]
  target: number | null
}

export interface Shaft {
  id: number
  kind: TransportKind
  x: number
  lo: number
  hi: number
  stops: Record<number, boolean>
  cars: Car[]
  q: Record<number, { up: number[]; down: number[] }>
}

export type PersonKind = 'worker' | 'resident' | 'guest' | 'visitor' | 'maid' | 'guard' | 'vip'
export type PersonState = 'off' | 'inside' | 'walking' | 'waiting' | 'riding' | 'climbing'

export interface Leg {
  via: number // shaft id or connector facility id
  from: number
  to: number
  x: number
}

export interface Person {
  id: number
  kind: PersonKind
  home: number // facility id (0 for visitors)
  state: PersonState
  at: number // facility id currently inside (0 if none)
  floor: number
  x: number
  speed: number
  goalFloor: number
  goalX: number
  goalFac: number // 0 = exit the building
  purpose: string
  returnTo: number // where to go after a shop visit (facility id, 0 = exit)
  legs: Leg[]
  leg: number
  wait: number
  tripStress: number
  mood: number // 0 = calm .. 100 = furious, shown as colour
  shirt: number
  agenda: { t: number; act: string; arg?: number }[]
  climb: number
  qShaft: number
  qDir: 1 | -1
  task: number // maid: room id, guard: target facility/floor
  costume?: number // trick-or-treaters: index into COSTUMES in holidays.ts
}

export interface Msg {
  id: number
  t: number
  text: string
  kind: 'info' | 'good' | 'bad' | 'star' | 'event'
  floor?: number
  x?: number
}

export interface Bomb {
  floor: number
  x: number
  deadline: number // game time
  searched: number[]
  decided: boolean
  ransom: number
  defused: boolean
}

export interface Fx {
  x: number
  floor: number
  text: string
  color: string
  age: number
}

export interface Game {
  version: 1
  mode: Mode
  disasters: boolean
  money: number
  time: number // game minutes since start
  stars: number // 1..5, 6 = Tower
  nextId: number
  floors: Map<number, Int32Array> // -1 unbuilt, 0 empty floor, >0 occupant id
  facilities: Map<number, Facility>
  shafts: Map<number, Shaft>
  people: Map<number, Person>
  flags: {
    vip: boolean; vipVisit: number; goldFound: boolean; santaDay: number; ufoDay?: number
    /** Huggy Wuggy's hiding spot (top floor of a room + tile x), or null when he's in his case */
    huggy?: { floor: number; x: number } | null
    huggyFound?: number
    /** a DOORS-style entity visiting a floor at night */
    entity?: { kind: 'rush' | 'seek'; floor: number; start: number; a: number; b: number } | null
    guided?: boolean
    entityNight?: number
    /** the day the tower was founded, for its birthday; old saves get the day they're loaded */
    founded?: number
    /** Today's giant visitor, chosen once at midnight. Missing on older saves. */
    giant?: { kind: 'ape' | 'dragon' | 'skywriter'; day: number; start: number }
    /** day index the observatory already announced Saturn */
    saturnNight?: number
    /** water-tower poke: pigeons on this tank fly off until `at` (performance.now) ages out */
    pigeon?: { id: number; at: number }
  }
  bomb: Bomb | null
  pop: number
  stats: { day: number; income: number; expense: number; lastQuarter: { income: number; expense: number } }
  log: Msg[]
  buildVersion: number
  fx: Fx[]
  starCelebration: number
  name?: string
}

export const START_MONEY = 2_000_000

export function newGame(mode: Mode, disasters: boolean, name = ''): Game {
  return {
    version: 1,
    name,
    mode,
    disasters,
    money: mode === 'sandbox' ? 999_999_999 : START_MONEY,
    time: 6 * 60, // start at 6:00 on day one
    stars: 1,
    nextId: 1,
    floors: new Map(),
    facilities: new Map(),
    shafts: new Map(),
    people: new Map(),
    flags: { vip: false, vipVisit: 0, goldFound: false, santaDay: -1 },
    bomb: null,
    pop: 0,
    stats: { day: 0, income: 0, expense: 0, lastQuarter: { income: 0, expense: 0 } },
    log: [],
    buildVersion: 0,
    fx: [],
    starCelebration: 0,
  }
}

export function row(g: Game, f: number, create = false): Int32Array | undefined {
  let r = g.floors.get(f)
  if (!r && create && f >= MIN_FLOOR && f <= MAX_FLOOR) {
    r = new Int32Array(TOWER_WIDTH).fill(-1)
    g.floors.set(f, r)
  }
  return r
}

export function cell(g: Game, f: number, x: number): number {
  if (x < 0 || x >= TOWER_WIDTH) return -1
  const r = g.floors.get(f)
  return r ? r[x] : -1
}

// ---- time helpers ----
export const dayOf = (t: number) => Math.floor(t / 1440)
export const minuteOfDay = (t: number) => t - dayOf(t) * 1440
export const isWeekend = (t: number) => dayOf(t) % 3 === 2
export const quarterOf = (t: number) => (Math.floor(dayOf(t) / 3) % 4) + 1
export const yearOf = (t: number) => Math.floor(dayOf(t) / 12) + 1

export function clockLabel(t: number) {
  const m = Math.floor(minuteOfDay(t))
  const h = Math.floor(m / 60)
  const mm = m % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mm.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function floorLabel(f: number) {
  if (f === 0) return 'Lobby'
  return f < 0 ? `B${-f}` : `${f}F`
}

export function money(n: number) {
  if (n > 900_000_000) return '∞'
  const neg = n < 0
  const s = Math.abs(Math.round(n)).toLocaleString('en-US')
  return `${neg ? '-' : ''}$${s}`
}

// ---- save / load ----
interface SaveShape extends Omit<Game, 'floors' | 'facilities' | 'shafts' | 'people' | 'fx'> {
  floors: [number, number[]][]
  facilities: Facility[]
  shafts: Shaft[]
  people: Person[]
}

export function serialize(g: Game): string {
  const s: SaveShape = {
    ...g,
    floors: [...g.floors.entries()].map(([f, r]) => [f, Array.from(r)]),
    facilities: [...g.facilities.values()],
    shafts: [...g.shafts.values()],
    people: [...g.people.values()],
  }
  delete (s as unknown as Partial<Game>).fx
  return JSON.stringify(s)
}

export function deserialize(json: string): Game {
  const s = JSON.parse(json) as SaveShape
  return {
    ...s,
    floors: new Map(s.floors.map(([f, r]) => [f, Int32Array.from(r)])),
    facilities: new Map(s.facilities.map((f) => [f.id, f])),
    shafts: new Map(s.shafts.map((x) => [x.id, x])),
    people: new Map(s.people.map((p) => [p.id, p])),
    fx: [],
  }
}
