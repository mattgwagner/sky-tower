// Building, demolishing and grid queries.
import {
  FACILITIES, FLOOR_COST, MAX_FLOOR, MIN_FLOOR, TOWER_WIDTH, TRANSPORTS,
  isConnector, isLobbyFloor,
} from './defs'
import type { FacilityKind, TransportKind } from './defs'
import { isSpire, needsOpenSky, onVeryTop, TURBINE_MAX } from './roof'
import type { Facility, Game, Msg, Shaft } from './state'
import { cell, dayOf, row } from './state'
import { SLIDE_MAX, SLIDE_MIN, slideCost } from './slide'

export function log(g: Game, text: string, kind: Msg['kind'] = 'info', floor?: number, x?: number) {
  g.log.push({ id: g.nextId++, t: g.time, text, kind, floor, x })
  if (g.log.length > 80) g.log.splice(0, g.log.length - 80)
}

export function fx(g: Game, x: number, floor: number, text: string, color = '#3ddc84') {
  if (g.fx.length < 28 || text.length > 8) g.fx.push({ x, floor, text, color, age: 0 })
}

export function spend(g: Game, amount: number): boolean {
  if (g.mode === 'sandbox') return true
  if (g.money < amount) return false
  g.money -= amount
  g.stats.expense += amount
  return true
}

export function earn(g: Game, amount: number) {
  const mult = g.mode === 'family' ? 1.25 : 1
  const v = Math.round(amount * mult)
  g.money += v
  g.stats.income += v
  return v
}

export function unlocked(g: Game, stars: number) {
  return g.mode === 'sandbox' || g.stars >= stars
}

export interface PlaceCheck {
  ok: boolean
  cost: number
  reason?: string
}

function freeCell(v: number) {
  return v <= 0
}

function isLobbyCell(g: Game, v: number) {
  return v > 0 && g.facilities.get(v)?.kind === 'lobby'
}

/** The open-sky topper occupying any cell in [x, x+w) on floor f, if there is one. */
function topperUnder(g: Game, f: number, x: number, w: number): Facility | null {
  for (let i = x; i < x + w; i++) {
    const v = cell(g, f, i)
    if (v <= 0) continue
    const fac = g.facilities.get(v)
    if (fac && needsOpenSky(fac.kind)) return fac
  }
  return null
}

/** Remove lobby cells in [x, x+w) on floor f, keeping the rest of the lobby as separate pieces. */
function carveLobby(g: Game, f: number, x: number, w: number) {
  const r = row(g, f)
  if (!r) return
  const hit = new Set<number>()
  for (let i = x; i < x + w; i++) if (isLobbyCell(g, r[i])) hit.add(r[i])
  for (const id of hit) {
    const lob = g.facilities.get(id)!
    g.facilities.delete(id)
    for (let i = lob.x; i < lob.x + lob.width; i++) r[i] = 0
    const pieces: [number, number][] = [[lob.x, x], [x + w, lob.x + lob.width]]
    for (const [a, b] of pieces) {
      if (b <= a) continue
      const nid = g.nextId++
      g.facilities.set(nid, { ...lob, id: nid, x: a, width: b - a, complaints: [] })
      for (let i = a; i < b; i++) r[i] = nid
    }
  }
}

/** Check whether a facility of `kind` can go with its left edge at x, bottom at floor. */
export function checkFacility(g: Game, kind: FacilityKind, x: number, floor: number, width?: number, height?: number): PlaceCheck {
  const def = FACILITIES[kind]
  const w = width ?? def.width
  const h = height ?? def.height
  if (!unlocked(g, def.stars)) return { ok: false, cost: 0, reason: `Unlocks at ${def.stars}★` }
  if (x < 0 || x + w > TOWER_WIDTH) return { ok: false, cost: 0, reason: 'Outside the lot' }
  if (floor < MIN_FLOOR || floor + h - 1 > MAX_FLOOR) return { ok: false, cost: 0, reason: 'Too high or too deep' }
  if (def.underground === 'only' && floor + h - 1 >= 0) return { ok: false, cost: 0, reason: 'Must be underground' }
  if (kind === 'lobby' && !isLobbyFloor(floor)) return { ok: false, cost: 0, reason: 'Lobbies go on floors 0, 15, 30, 45…' }
  if (kind === 'cathedral' && floor + h - 1 !== MAX_FLOOR) return { ok: false, cost: 0, reason: `Must reach the very top (floor ${MAX_FLOOR})` }
  if (kind === 'megaSlide' && (h < SLIDE_MIN || h > SLIDE_MAX)) return { ok: false, cost: 0, reason: `Slides drop ${SLIDE_MIN} to ${SLIDE_MAX} floors` }
  if (isConnector(kind) && floor + h - 1 >= MAX_FLOOR) return { ok: false, cost: 0, reason: 'Nothing above to connect to' }
  if (floor < 0 && (kind === 'hotelSingle' || kind === 'hotelTwin' || kind === 'hotelSuite' || kind === 'condo' || kind === 'office'))
    return { ok: false, cost: 0, reason: 'Nobody wants to live or work underground' }

  if (kind === 'turbine' && facilitiesOf(g, 'turbine').length >= TURBINE_MAX)
    return { ok: false, cost: 0, reason: 'Three turbines is the whole wind farm!' }
  if (isSpire(kind) && !onVeryTop(g, floor, h))
    return { ok: false, cost: 0, reason: 'It has to go on the very top' }

  let unbuilt = 0
  for (let f = floor; f < floor + h; f++) {
    for (let i = x; i < x + w; i++) {
      const v = cell(g, f, i)
      const occ = v > 0 ? g.facilities.get(v) : undefined
      const swapping = !!occ && isSpire(kind) && isSpire(occ.kind)
      if (!freeCell(v) && !swapping && !(isConnector(kind) && isLobbyCell(g, v))) return { ok: false, cost: 0, reason: 'Something is in the way' }
      if (v === -1) unbuilt++
    }
  }
  // support: above ground needs floor below; underground needs floor above
  if (floor > 0) {
    for (let i = x; i < x + w; i++) if (cell(g, floor - 1, i) === -1) return { ok: false, cost: 0, reason: 'Needs a floor underneath' }
    const under = topperUnder(g, floor - 1, x, w)
    if (under) return { ok: false, cost: 0, reason: `Move the ${FACILITIES[under.kind].name} first` }
  }
  if (needsOpenSky(kind)) {
    for (let f = floor + h; f <= MAX_FLOOR; f++) {
      if (!g.floors.has(f)) continue
      for (let i = x; i < x + w; i++) if (cell(g, f, i) !== -1) return { ok: false, cost: 0, reason: 'Needs open sky above — build it on a roof' }
    }
  }
  const top = floor + h - 1
  if (top < 0) {
    for (let i = x; i < x + w; i++) if (cell(g, top + 1, i) === -1) return { ok: false, cost: 0, reason: 'Dig down from the floor above' }
  }
  if (isConnector(kind)) {
    for (let i = x; i < x + w; i++) {
      if (cell(g, floor + h, i) === -1) return { ok: false, cost: 0, reason: 'Build the floor above first' }
    }
  }
  const cost = kind === 'floor' ? unbuilt * FLOOR_COST : (kind === 'megaSlide' ? slideCost(h) : def.cost * (def.drag ? w : 1)) + unbuilt * FLOOR_COST
  if (kind === 'floor' && unbuilt === 0) return { ok: false, cost: 0, reason: 'Already built' }
  if (g.mode !== 'sandbox' && cost > g.money) return { ok: false, cost, reason: 'Not enough money' }
  return { ok: true, cost }
}

function blankFacility(id: number, kind: FacilityKind, x: number, floor: number, width: number, height: number): Facility {
  return {
    id, kind, x, floor, width, height,
    occupied: false, rent: 1, happiness: 70, stressAvg: 0, complaints: [], inside: 0,
    dirty: false, dirtySince: 0, roaches: false, cleaner: 0, booked: false, rentedLastNight: false,
    customersToday: 0, customersYesterday: 0, incomeToday: 0, incomeTotal: 0, fire: 0,
    reachable: false, noisy: false, sad: 0,
  }
}

export function placeFacility(g: Game, kind: FacilityKind, x: number, floor: number, width?: number, height?: number): Facility | null {
  const chk = checkFacility(g, kind, x, floor, width, height)
  if (!chk.ok) return null
  spend(g, chk.cost)
  const def = FACILITIES[kind]
  const w = width ?? def.width
  const h = height ?? def.height
  if (isSpire(kind)) {
    for (const old of [...g.facilities.values()]) if (isSpire(old.kind)) demolish(g, old.id, () => {})
  }
  if (kind === 'floor') {
    const r = row(g, floor, true)!
    for (let i = x; i < x + w; i++) if (r[i] === -1) r[i] = 0
    g.buildVersion++
    maybeGold(g, floor, x)
    return null
  }
  if (isConnector(kind)) for (let f = floor; f < floor + h; f++) carveLobby(g, f, x, w)
  const id = g.nextId++
  const fac = blankFacility(id, kind, x, floor, w, h)
  for (let f = floor; f < floor + h; f++) {
    const r = row(g, f, true)!
    for (let i = x; i < x + w; i++) r[i] = id
  }
  g.facilities.set(id, fac)
  for (let f = floor; f < floor + h; f++) bridgeGaps(g, f, x, x + w)
  g.buildVersion++
  if (floor < 0) maybeGold(g, floor, x)
  return fac
}

/** Paint lobby or floor across a horizontal drag, skipping occupied cells. */
export function paintRun(g: Game, kind: 'lobby' | 'floor', x0: number, x1: number, floor: number): number {
  const a = Math.max(0, Math.min(x0, x1))
  const b = Math.min(TOWER_WIDTH - 1, Math.max(x0, x1))
  let spent = 0
  let i = a
  while (i <= b) {
    // find maximal run of placeable cells from i
    let j = i
    while (j <= b && checkFacility(g, kind, i, floor, j - i + 1).ok) j++
    if (j > i) {
      const before = g.money
      placeFacility(g, kind, i, floor, j - i)
      spent += before - g.money
      i = j
    } else i++
  }
  if (kind === 'lobby') mergeLobbies(g, floor)
  return spent
}

function mergeLobbies(g: Game, floor: number) {
  const r = row(g, floor)
  if (!r) return
  let prev: Facility | null = null
  for (let i = 0; i < TOWER_WIDTH; i++) {
    const f = r[i] > 0 ? g.facilities.get(r[i]) : undefined
    if (f && f.kind === 'lobby') {
      if (prev && prev !== f && prev.x + prev.width === f.x) {
        prev.width += f.width
        for (let k = f.x; k < f.x + f.width; k++) r[k] = prev.id
        g.facilities.delete(f.id)
        continue
      }
      prev = f
    } else prev = null
  }
}

const BRIDGE_MAX = 16

/** Fill short unbuilt gaps between [a, b) on floor f and the nearest built cells, so people can walk across. */
function bridgeGaps(g: Game, f: number, a: number, b: number) {
  const r = row(g, f, true)!
  const supported = (i: number) => f === 0 || (f > 0 ? cell(g, f - 1, i) !== -1 && !topperUnder(g, f - 1, i, 1) : cell(g, f + 1, i) !== -1)
  for (const dir of [-1, 1]) {
    let i = dir < 0 ? a - 1 : b
    const gap: number[] = []
    while (i >= 0 && i < TOWER_WIDTH && r[i] === -1 && gap.length <= BRIDGE_MAX) { gap.push(i); i += dir }
    if (!gap.length || gap.length > BRIDGE_MAX || i < 0 || i >= TOWER_WIDTH || r[i] === -1) continue
    if (!gap.every(supported)) continue
    if (g.mode !== 'sandbox' && g.money < gap.length * FLOOR_COST) continue
    spend(g, gap.length * FLOOR_COST)
    for (const k of gap) r[k] = 0
  }
}

function maybeGold(g: Game, floor: number, x: number) {
  if (floor >= 0 || g.flags.goldFound || g.mode === 'sandbox') return
  if (Math.random() < 0.04) {
    g.flags.goldFound = true
    const amount = 500_000 + Math.round(Math.random() * 5) * 100_000
    g.money += amount
    log(g, `⛏️ You struck GOLD while digging on ${floor < 0 ? 'B' + -floor : floor}! +$${amount.toLocaleString()}`, 'good', floor, x)
    fx(g, x, floor, `+$${amount.toLocaleString()}`, '#ffd23f')
  }
}

// ---- elevators ----

export function expressStop(f: number) {
  return f <= 0 || isLobbyFloor(f)
}

export function checkShaft(g: Game, kind: TransportKind, x: number, a: number, b: number): PlaceCheck {
  const def = TRANSPORTS[kind]
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  if (!unlocked(g, def.stars)) return { ok: false, cost: 0, reason: `Unlocks at ${def.stars}★` }
  if (x < 0 || x + def.width > TOWER_WIDTH) return { ok: false, cost: 0, reason: 'Outside the lot' }
  if (lo < MIN_FLOOR || hi > MAX_FLOOR) return { ok: false, cost: 0, reason: 'Too high or too deep' }
  if (hi === lo) return { ok: false, cost: 0, reason: 'Drag up or down to cover 2+ floors' }
  if (hi - lo + 1 > def.maxSpan) return { ok: false, cost: 0, reason: `Max ${def.maxSpan} floors — use a sky lobby + express` }
  if (kind === 'expressElevator') {
    let n = 0
    for (let f = lo; f <= hi; f++) if (expressStop(f)) n++
    if (n < 2) return { ok: false, cost: 0, reason: 'Express only stops at lobbies (0, 15, 30…) and basements' }
  }
  let unbuilt = 0
  for (let f = lo; f <= hi; f++) {
    for (let i = x; i < x + def.width; i++) {
      const v = cell(g, f, i)
      if (!freeCell(v) && !isLobbyCell(g, v)) return { ok: false, cost: 0, reason: 'Something is in the way' }
      if (v === -1) unbuilt++
    }
  }
  if (lo > 0) for (let i = x; i < x + def.width; i++) if (cell(g, lo - 1, i) === -1) return { ok: false, cost: 0, reason: 'Needs a floor underneath' }
  if (lo > 0) {
    const under = topperUnder(g, lo - 1, x, def.width)
    if (under) return { ok: false, cost: 0, reason: `Move the ${FACILITIES[under.kind].name} first` }
  }
  if (hi < 0) for (let i = x; i < x + def.width; i++) if (cell(g, hi + 1, i) === -1) return { ok: false, cost: 0, reason: 'Dig down from the floor above' }
  const cost = def.cost + def.perFloorCost * (hi - lo + 1) + unbuilt * FLOOR_COST
  if (g.mode !== 'sandbox' && cost > g.money) return { ok: false, cost, reason: 'Not enough money' }
  return { ok: true, cost }
}

export function placeShaft(g: Game, kind: TransportKind, x: number, a: number, b: number): Shaft | null {
  const chk = checkShaft(g, kind, x, a, b)
  if (!chk.ok) return null
  spend(g, chk.cost)
  const def = TRANSPORTS[kind]
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const id = g.nextId++
  const stops: Record<number, boolean> = {}
  for (let f = lo; f <= hi; f++) stops[f] = kind === 'expressElevator' ? expressStop(f) : true
  const s: Shaft = {
    id, kind, x, lo, hi, stops, q: {},
    cars: [{ floor: kind === 'expressElevator' || lo <= 0 ? Math.max(lo, Math.min(0, hi)) : lo, sub: 0, dir: 0, state: 'idle', timer: 0, riders: [], target: null }],
  }
  for (let f = lo; f <= hi; f++) {
    carveLobby(g, f, x, def.width)
    const r = row(g, f, true)!
    for (let i = x; i < x + def.width; i++) r[i] = id
  }
  g.shafts.set(id, s)
  for (let f = lo; f <= hi; f++) bridgeGaps(g, f, x, x + def.width)
  g.buildVersion++
  return s
}

export function addCar(g: Game, s: Shaft): boolean {
  if (s.cars.length >= 8) return false
  if (!spend(g, TRANSPORTS[s.kind].carCost)) return false
  const span = s.hi - s.lo
  const f = s.lo + Math.round((span * s.cars.length) / 8)
  s.cars.push({ floor: f, sub: 0, dir: 0, state: 'idle', timer: 0, riders: [], target: null })
  return true
}

export function removeCar(g: Game, s: Shaft, onEvict: (pid: number) => void): boolean {
  if (s.cars.length <= 1) return false
  const c = s.cars.pop()!
  c.riders.forEach(onEvict)
  g.buildVersion++
  return true
}

/** Grow or shrink a shaft by one floor at the top (+1/-1) or bottom. */
export function resizeShaft(g: Game, s: Shaft, end: 'top' | 'bottom', delta: 1 | -1, onEvict: (pid: number) => void): string | null {
  const def = TRANSPORTS[s.kind]
  if (delta === 1) {
    const f = end === 'top' ? s.hi + 1 : s.lo - 1
    if (f > MAX_FLOOR || f < MIN_FLOOR) return 'Can\'t go further'
    if (s.hi - s.lo + 2 > def.maxSpan) return `Max ${def.maxSpan} floors`
    let unbuilt = 0
    for (let i = s.x; i < s.x + def.width; i++) {
      const v = cell(g, f, i)
      if (!freeCell(v) && !isLobbyCell(g, v)) return 'Something is in the way'
      if (v === -1) unbuilt++
    }
    if (!spend(g, def.perFloorCost + unbuilt * FLOOR_COST)) return 'Not enough money'
    carveLobby(g, f, s.x, def.width)
    const r = row(g, f, true)!
    for (let i = s.x; i < s.x + def.width; i++) r[i] = s.id
    if (end === 'top') s.hi = f
    else s.lo = f
    s.stops[f] = s.kind === 'expressElevator' ? expressStop(f) : true
    bridgeGaps(g, f, s.x, s.x + def.width)
  } else {
    if (s.hi - s.lo <= 1) return 'Too short to shrink'
    const f = end === 'top' ? s.hi : s.lo
    if (s.cars.some((c) => c.floor === f || c.riders.length > 0)) return 'Wait until the cars are empty'
    const r = row(g, f)!
    for (let i = s.x; i < s.x + def.width; i++) r[i] = 0
    if (end === 'top') s.hi--
    else s.lo++
    delete s.stops[f]
    const q = s.q[f]
    if (q) { q.up.forEach(onEvict); q.down.forEach(onEvict); delete s.q[f] }
    for (const c of s.cars) c.floor = Math.max(s.lo, Math.min(s.hi, c.floor))
  }
  g.buildVersion++
  return null
}

export function occupantAt(g: Game, f: number, x: number): { fac?: Facility; shaft?: Shaft } {
  const v = cell(g, f, Math.floor(x))
  if (v <= 0) return {}
  const fac = g.facilities.get(v)
  if (fac) return { fac }
  const shaft = g.shafts.get(v)
  if (shaft) return { shaft }
  return {}
}

/** Remove a facility or shaft. Caller handles people via onEvict. */
export function demolish(g: Game, id: number, onEvict: (pid: number) => void): boolean {
  const fac = g.facilities.get(id)
  if (fac) {
    for (let f = fac.floor; f < fac.floor + fac.height; f++) {
      const r = row(g, f)!
      for (let i = fac.x; i < fac.x + fac.width; i++) r[i] = 0
    }
    g.facilities.delete(id)
    g.buildVersion++
    for (const p of g.people.values()) if (p.home === id || p.at === id || p.goalFac === id || p.returnTo === id || p.legs.some((l) => l.via === id)) onEvict(p.id)
    return true
  }
  const s = g.shafts.get(id)
  if (s) {
    const w = TRANSPORTS[s.kind].width
    for (let f = s.lo; f <= s.hi; f++) {
      const r = row(g, f)!
      for (let i = s.x; i < s.x + w; i++) r[i] = 0
    }
    g.shafts.delete(id)
    g.buildVersion++
    for (const c of s.cars) c.riders.forEach(onEvict)
    for (const k of Object.keys(s.q)) { s.q[+k].up.forEach(onEvict); s.q[+k].down.forEach(onEvict) }
    for (const p of g.people.values()) if (p.legs.some((l) => l.via === id)) onEvict(p.id)
    return true
  }
  return false
}

export function facilitiesOf(g: Game, kind: FacilityKind): Facility[] {
  const out: Facility[] = []
  for (const f of g.facilities.values()) if (f.kind === kind) out.push(f)
  return out
}

export function topFloor(g: Game) {
  let t = 0
  for (const f of g.floors.keys()) if (f > t) t = f
  return t
}

export function bottomFloor(g: Game) {
  let b = 0
  for (const f of g.floors.keys()) if (f < b) b = f
  return b
}

export function lobbyEntrances(g: Game): { floor: number; x: number }[] {
  const out: { floor: number; x: number }[] = []
  for (const f of g.facilities.values()) {
    if (f.kind === 'lobby' && f.floor === 0) {
      out.push({ floor: 0, x: f.x + 0.5 }, { floor: 0, x: f.x + f.width - 0.5 })
    }
    if (f.kind === 'metro') out.push({ floor: f.floor, x: f.x + f.width / 2 })
  }
  return out
}

export const today = (g: Game) => dayOf(g.time)
