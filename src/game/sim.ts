// The simulation: people, schedules, hotel, economy, rating and events.
import type { Sfx } from '../audio'
import {
  ATTRACTIONS, BREAKFAST, DAYS_PER_QUARTER, DINNER, FOOD, LUNCH, FACILITIES, HOTEL_NIGHT, MAX_FLOOR, MINUTES_PER_STEP, OFFICE_RENT, CONDO_PRICE,
  RENT_HAPPY, RENT_MULT, SHOP_CAPACITY, SPEND, TRANSPORTS, isCommercial, isConnector, isHotel, isResidential, starRules,
} from './defs'
import type { FacilityKind } from './defs'
import { joinQueue, leaveQueue, stepShaft } from './elevators'
import type { ElevatorHooks } from './elevators'
import { findRoute } from './routing'
import { holidayRush, partyDay, stepHoliday, trickArrive, trickNext } from './holidays'
import type { HolidaySim } from './holidays'
import { SLIDE_STEPS, slideDayTick, slideLanded } from './slide'
import type { Facility, Game, Person, PersonKind, Shaft } from './state'
import { dayOf, floorLabel, isWeekend, minuteOfDay, quarterOf } from './state'
import { giantsArrive } from './giants'
import { surpriseDay, surpriseMinute } from './surprises'
import { clearNight, heliMinute, turbineCut } from './roof'
import { playgroundPerHour, playgroundRainedOut } from './playground'
import { zooHour } from './zoo'
import { frogsHour } from './frogs'
import { discoAfterWeekend, discoFx, discoMinute, discoPerHour } from './disco'
import { marketRush } from './market'
import { concertDoors, concertMinute, concertOpen, concertPerHour, concertStay } from './concert'
import { bump } from './stickers'
import { demolish, earn, facilitiesOf, fx, lobbyEntrances, log, spend, today, topFloor } from './world'

export { giantCount, giantNow, giantsArrive } from './giants'

// ---------- sound hook (set by UI) ----------
export const sound = {
  play: (_name: Sfx) => {},
}
let discoWired = false

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const at = (h: number, m = 0) => h * 60 + m

// ---------- people ----------

export function newPerson(g: Game, kind: PersonKind, home: number): Person {
  const p: Person = {
    id: g.nextId++, kind, home, state: 'off', at: 0, floor: 0, x: 0,
    speed: rnd(0.28, 0.42) * (kind === 'guard' ? 1.4 : 1),
    goalFloor: 0, goalX: 0, goalFac: 0, purpose: '', returnTo: 0,
    legs: [], leg: 0, wait: 0, tripStress: 0, mood: 0,
    shirt: Math.floor(Math.random() * 8), agenda: [], climb: 0, qShaft: 0, qDir: 1, task: 0,
  }
  g.people.set(p.id, p)
  return p
}

function schedule(p: Person, t: number, act: string, arg?: number) {
  const item = { t, act, arg }
  let i = p.agenda.length
  while (i > 0 && p.agenda[i - 1].t > t) i--
  p.agenda.splice(i, 0, item)
}

function facCenter(f: Facility) {
  return f.x + f.width / 2
}

function startPos(g: Game, p: Person): { floor: number; x: number } | null {
  if (p.state === 'inside') {
    const f = g.facilities.get(p.at)
    if (f) return { floor: f.floor, x: f.x + rnd(1, Math.max(1.5, f.width - 1)) }
    return { floor: p.floor, x: p.x }
  }
  if (p.state === 'off') {
    const ents = lobbyEntrances(g)
    if (!ents.length) return null
    const e = pick(ents)
    return { floor: e.floor, x: e.x }
  }
  return { floor: p.floor, x: p.x }
}

function leaveFacility(g: Game, p: Person) {
  if (p.state === 'inside' && p.at) {
    const f = g.facilities.get(p.at)
    if (f) f.inside = Math.max(0, f.inside - 1)
  }
  p.at = 0
}

/** Begin a trip. goalFac 0 = leave the building. Returns false if no route. */
export function startTrip(g: Game, p: Person, goalFac: number, purpose: string, goalFloorOverride?: number, goalXOverride?: number): boolean {
  const from = startPos(g, p)
  if (!from) return false
  const staff = p.kind === 'maid' || p.kind === 'guard'
  let goalFloor: number, goalX: number
  let legs = null
  if (goalFac === 0 && goalFloorOverride === undefined) {
    // nearest reachable exit
    const ents = lobbyEntrances(g)
    let best: { floor: number; x: number; legs: ReturnType<typeof findRoute> } | null = null
    // some people always ride the train home when there's a station
    const rider = !staff && p.id % 10 < 4 && ents.some((e) => e.floor < 0)
    for (const e of ents) {
      const r = findRoute(g, from.floor, from.x, e.floor, e.x, staff)
      if (!r) continue
      const better = !best || (rider ? (e.floor < 0) !== (best.floor < 0) ? e.floor < 0 : r.length < (best.legs?.length ?? 99) : r.length < (best.legs?.length ?? 99))
      if (better) best = { floor: e.floor, x: e.x, legs: r }
    }
    if (!best) return false
    goalFloor = best.floor; goalX = best.x; legs = best.legs
  } else {
    const f = goalFac ? g.facilities.get(goalFac) : undefined
    if (goalFac && !f) return false
    goalFloor = goalFloorOverride ?? f!.floor
    goalX = goalXOverride ?? (f ? f.x + rnd(1, Math.max(1.5, f.width - 1)) : 0)
    legs = findRoute(g, from.floor, from.x, goalFloor, goalX, staff)
  }
  if (!legs) return false
  leaveFacility(g, p)
  p.floor = from.floor
  p.x = from.x
  p.goalFloor = goalFloor
  p.goalX = goalX
  p.goalFac = goalFac
  p.purpose = purpose
  p.legs = legs
  p.leg = 0
  p.wait = 0
  p.tripStress = 0
  p.state = 'walking'
  return true
}

function enterFacility(_g: Game, p: Person, fac: Facility) {
  p.state = 'inside'
  p.at = fac.id
  fac.inside++
}

function recordStress(g: Game, p: Person) {
  const homeFac = g.facilities.get(p.home)
  const s = p.tripStress
  if (homeFac) homeFac.stressAvg = homeFac.stressAvg * 0.85 + s * 0.15
  p.mood = Math.max(0, Math.min(100, p.mood * 0.5 + s))
}

/** Remove a person from wherever they are (used on demolish / give up). */
export function evict(g: Game, pid: number) {
  const p = g.people.get(pid)
  if (!p) return
  if (p.state === 'waiting') {
    const s = g.shafts.get(p.qShaft)
    if (s) leaveQueue(s, pid)
  }
  if (p.state === 'riding') {
    for (const s of g.shafts.values()) for (const c of s.cars) {
      const i = c.riders.indexOf(pid)
      if (i >= 0) c.riders.splice(i, 1)
    }
  }
  leaveFacility(g, p)
  releaseTask(g, p)
  const home = g.facilities.get(p.home)
  if (!home || p.kind === 'visitor' || p.kind === 'guest' || p.kind === 'vip') {
    if (p.kind === 'guest' || p.kind === 'vip') guestGone(g, p, false)
    g.people.delete(pid)
    return
  }
  // tenant whose trip broke: poof them home/offsite
  p.legs = []
  if (home.kind === 'security' || home.kind === 'housekeeping') {
    p.state = 'inside'; p.at = home.id; home.inside++
  } else {
    p.state = 'off'
  }
}

function releaseTask(g: Game, p: Person) {
  if (p.kind === 'maid' && p.task) {
    const r = g.facilities.get(p.task)
    if (r && r.cleaner === p.id) r.cleaner = 0
    p.task = 0
  }
}

// ---------- elevator hooks ----------
const hooks = (g: Game): ElevatorHooks => ({
  destOf(pid) {
    const p = g.people.get(pid)
    return p ? p.legs[p.leg]?.to ?? p.floor : 0
  },
  onBoard(pid, s, c) {
    const p = g.people.get(pid)
    if (p) p.state = 'riding'
    bump(g, 'car:' + s.id + ':' + s.cars.indexOf(c))
  },
  onUnload(pid, s, floor) {
    const p = g.people.get(pid)
    if (!p) return
    p.floor = floor
    p.x = s.x + TRANSPORTS[s.kind].width / 2
    p.leg++
    p.state = 'walking'
  },
  onDing() {
    if (Math.random() < 0.05) sound.play('ding')
  },
})

let cachedHooks: { g: Game; h: ElevatorHooks } | null = null
function getHooks(g: Game) {
  if (!cachedHooks || cachedHooks.g !== g) cachedHooks = { g, h: hooks(g) }
  return cachedHooks.h
}

function stepPerson(g: Game, p: Person) {
  switch (p.state) {
    case 'walking': {
      const tx = p.leg < p.legs.length ? p.legs[p.leg].x : p.goalX
      const dx = tx - p.x
      if (Math.abs(dx) <= p.speed) {
        p.x = tx
        if (p.leg < p.legs.length) beginLeg(g, p)
        else arrive(g, p)
      } else p.x += Math.sign(dx) * p.speed
      break
    }
    case 'waiting': {
      p.wait++
      if (p.wait > 120 && p.wait % 10 === 0) p.tripStress += 1
      if (p.wait > 120) p.mood = Math.min(100, Math.max(p.mood, p.tripStress))
      if (p.wait > 2600) {
        // gave up
        const s = g.shafts.get(p.qShaft)
        if (s) leaveQueue(s, p.id)
        p.tripStress += 40
        recordStress(g, p)
        complain(g, p)
        evict(g, p.id)
      }
      break
    }
    case 'climbing': {
      p.climb++
      const L = p.legs[p.leg]
      const conn = g.facilities.get(L.via)
      const dur = climbSteps(conn?.kind) * Math.abs(L.to - L.from)
      if (p.climb >= dur) {
        p.floor = L.to
        p.leg++
        p.state = 'walking'
        if (conn?.kind === 'stairs') p.tripStress += 4
        if (conn?.kind === 'firePole') { p.mood = Math.max(0, p.mood - 6); if (Math.random() < 0.04) fx(g, p.x, p.floor, 'WHEEE! 🚒', '#ffa94d') }
        if (conn?.kind === 'megaSlide') { const sfx = slideLanded(g, p, conn); if (sfx) sound.play(sfx) }
      }
      break
    }
  }
}

/** Sim steps to cross one floor on a connector. */
export function climbSteps(k?: FacilityKind) {
  return k === 'escalator' ? 28 : k === 'firePole' ? 12 : k === 'megaSlide' ? SLIDE_STEPS : 55
}

function beginLeg(g: Game, p: Person) {
  const L = p.legs[p.leg]
  const s = g.shafts.get(L.via)
  if (s) {
    p.qShaft = s.id
    p.qDir = joinQueue(s, p.floor, L.to, p.id)
    p.state = 'waiting'
    return
  }
  const c = g.facilities.get(L.via)
  if (c && isConnector(c.kind)) {
    p.state = 'climbing'
    p.climb = 0
    return
  }
  // transport vanished
  evict(g, p.id)
}

function complain(g: Game, p: Person) {
  if (p.kind === 'visitor' && Math.random() < 0.02) log(g, `😤 A visitor gave up waiting for the elevator on ${floorLabel(p.floor)}`, 'bad', p.floor, p.x)
}

// ---------- arrivals ----------

function arrive(g: Game, p: Person) {
  recordStress(g, p)
  const fac = p.goalFac ? g.facilities.get(p.goalFac) : undefined
  switch (p.purpose) {
    case 'exit': {
      const station = metroAt(g, p.floor, p.x)
      if (station && trainSoon(g)) {
        // wait on the platform for the next train
        p.legs = []
        p.purpose = 'train'
        enterFacility(g, p, station)
        return
      }
      p.state = 'off'
      p.legs = []
      if (p.kind === 'visitor') g.people.delete(p.id)
      else if (p.kind === 'guest' || p.kind === 'vip') { guestGone(g, p, true); g.people.delete(p.id) }
      return
    }
    case 'home':
    case 'work':
    case 'post': {
      if (!fac) return evict(g, p.id)
      enterFacility(g, p, fac)
      if (p.kind === 'maid') maidNext(g, p)
      return
    }
    case 'shop': {
      if (!fac) return evict(g, p.id)
      const cap = SHOP_CAPACITY[fac.kind] ?? 10
      if (fac.inside >= cap || !isOpen(g, fac)) {
        p.tripStress += 15
        recordStress(g, p)
        goBack(g, p)
        return
      }
      enterFacility(g, p, fac)
      fac.customersToday++
      const spendAmt = SPEND[fac.kind] ?? 0
      if (spendAmt > 0) {
        const v = earn(g, spendAmt * RENT_MULT[fac.rent] * (0.8 + Math.random() * 0.4))
        fac.incomeToday += v
        fac.incomeTotal += v
        if (FOOD.includes(fac.kind)) bump(g, 'sold:' + fac.kind)
        if (Math.random() < 0.35) fx(g, p.x, fac.floor, `+$${v}`)
        if (Math.random() < 0.04) sound.play('cash')
      }
      const stay = stayFor(g, fac.kind)
      schedule(p, g.time + stay, 'leaveShop')
      return
    }
    case 'trick':
      return trickArrive(g, p, fac, (f) => enterFacility(g, p, f), holidaySim)
    case 'clean': {
      if (!fac) { releaseTask(g, p); return goBackToPost(g, p) }
      enterFacility(g, p, fac)
      schedule(p, g.time + (fac.roaches ? 70 : 22), 'doneClean')
      return
    }
    case 'fire': {
      if (!fac || fac.fire <= 0) return goBackToPost(g, p)
      enterFacility(g, p, fac)
      return
    }
    case 'search': {
      // walk the floor end to end
      const segEnd = p.x < 120 ? floorExtent(g, p.floor)[1] : floorExtent(g, p.floor)[0]
      p.purpose = 'sweep'
      p.goalX = segEnd
      p.legs = []
      p.leg = 0
      p.state = 'walking'
      return
    }
    case 'sweep': {
      const b = g.bomb
      if (b && !b.defused && !b.searched.includes(p.floor)) {
        b.searched.push(p.floor)
        if (b.floor === p.floor) {
          b.defused = true
          log(g, `🛡️ Security found and defused the bomb on ${floorLabel(b.floor)}! Phew!`, 'good', b.floor, b.x)
          sound.play('star')
          g.bomb = null
        }
      }
      if (g.bomb && !g.bomb.defused) return guardSearchNext(g, p)
      return goBackToPost(g, p)
    }
    default:
      if (fac) enterFacility(g, p, fac)
      else evict(g, p.id)
  }
}

function goBack(g: Game, p: Person) {
  const ret = p.returnTo
  if (ret && g.facilities.get(ret)) {
    if (!startTrip(g, p, ret, 'home')) evict(g, p.id)
  } else if (!startTrip(g, p, 0, 'exit')) evict(g, p.id)
}

function goBackToPost(g: Game, p: Person) {
  const home = g.facilities.get(p.home)
  if (!home) return evict(g, p.id)
  if (p.state === 'inside' && p.at === home.id) return
  if (!startTrip(g, p, home.id, 'post')) evict(g, p.id)
}

function floorExtent(g: Game, f: number): [number, number] {
  const r = g.floors.get(f)
  if (!r) return [0, 0]
  let a = 0
  while (a < r.length && r[a] === -1) a++
  let b = r.length - 1
  while (b > 0 && r[b] === -1) b--
  return [a + 0.5, b + 0.5]
}

// ---------- hotel ----------

function guestsOf(g: Game, roomId: number) {
  let n = 0
  for (const p of g.people.values()) if (p.home === roomId && (p.kind === 'guest' || p.kind === 'vip')) n++
  return n
}

function guestGone(g: Game, p: Person, paid: boolean) {
  const room = g.facilities.get(p.home)
  if (!room) return
  if (p.kind === 'vip') judgeVip(g, room, p)
  if (guestsOf(g, room.id) > 1) return
  room.booked = false
  room.occupied = false
  room.dirty = true
  room.dirtySince = today(g)
  if (paid) {
    const v = earn(g, (HOTEL_NIGHT[room.kind] ?? 0) * RENT_MULT[room.rent] * (p.kind === 'vip' ? 3 : 1))
    room.incomeToday += v
    room.incomeTotal += v
    fx(g, p.x, p.floor, `+$${v}`)
  }
}

function judgeVip(g: Game, room: Facility, p: Person) {
  const score = room.happiness - p.tripStress * 0.6
  if (score >= 50) {
    g.flags.vip = true
    log(g, '🌟 The VIP had a wonderful stay! Your tower\'s reputation soars.', 'star', room.floor, room.x)
    sound.play('star')
  } else {
    log(g, `😒 The VIP was not impressed (${room.complaints[0] ?? 'slow elevators'}). Fix things up for next time!`, 'bad', room.floor, room.x)
    sound.play('bad')
  }
}

function hotelBookings(g: Game) {
  const m = minuteOfDay(g.time)
  if (m < at(15) || m > at(21, 30)) return
  const demand = 0.0025 + Math.min(0.006, g.pop / 150000) + g.stars * 0.0005
  for (const r of g.facilities.values()) {
    if (!isHotel(r.kind) || r.booked || r.dirty || r.roaches || !r.reachable || r.fire) continue
    const h = r.happiness / 100
    const appeal = 0.2 + h * h * 1.4 + (r.kind === 'hotelSuite' ? 0 : 0.15)
    if (Math.random() < demand * appeal) bookRoom(g, r, 'guest')
  }
}

function bookRoom(g: Game, r: Facility, kind: 'guest' | 'vip') {
  r.booked = true
  r.occupied = true
  const n = kind === 'vip' ? 1 : FACILITIES[r.kind].pop
  const now = g.time
  const tomorrow = (dayOf(now) + 1) * 1440
  for (let i = 0; i < n; i++) {
    const p = newPerson(g, kind, r.id)
    if (kind === 'vip') p.shirt = 99
    schedule(p, now + (kind === 'vip' ? 5 : rnd(0, 40)), 'home')
    if (Math.random() < 0.5 || kind === 'vip') schedule(p, Math.max(now + 90, dayOf(now) * 1440 + rnd(at(18, 30), at(20, 30))), 'eat')
    if (Math.random() < 0.4) {
      schedule(p, tomorrow + rnd(at(7), at(8, 15)), 'breakfast')
      schedule(p, tomorrow + rnd(at(9, 45), at(10, 45)), 'checkout')
    } else schedule(p, tomorrow + rnd(at(7), at(10, 30)), 'checkout')
  }
}

function maidNext(g: Game, p: Person) {
  const m = minuteOfDay(g.time)
  if (m < at(8, 30) || m > at(17)) return
  const here = p.floor
  let best: Facility | null = null
  let bestD = 1e9
  for (const r of g.facilities.values()) {
    if (!isHotel(r.kind) || !r.dirty || r.cleaner || r.booked || r.fire) continue
    const d = Math.abs(r.floor - here) * 10 + Math.abs(facCenter(r) - p.x) * 0.1
    if (d < bestD) { bestD = d; best = r }
  }
  if (!best) return
  best.cleaner = p.id
  p.task = best.id
  if (!startTrip(g, p, best.id, 'clean')) {
    best.cleaner = 0
    p.task = 0
  }
}

// ---------- commerce ----------

const HOURS: Partial<Record<FacilityKind, [number, number][]>> = {
  fastFood: [[at(10), at(20)]],
  restaurant: [[at(11), at(14)], [at(17), at(23)]],
  shop: [[at(10), at(21)]],
  cinema: [[at(12), at(23)]],
  partyHall: [[at(11), at(21)]],
}
const SHOWS = [at(13), at(17), at(20)]
const FUN_HOURS: Partial<Record<FacilityKind, [number, number][]>> = {
  iceCream: [[at(11), at(21)]],
  arcade: [[at(12), at(23)]],
  pool: [[at(8), at(20)]],
  aquarium: [[at(9), at(19)]],
  hauntedHouse: [[at(17), at(24)]],
  dinoMuseum: [[at(9), at(18)]],
  rocketPad: [[at(10), at(12, 30)]],
  pizza: [[at(11), at(22)]],
  tacos: [[at(11), at(21)]],
  sushi: [[at(11, 30), at(14, 30)], [at(17), at(22)]],
  donuts: [[at(6), at(14)]],
  pancakes: [[at(7), at(13)]],
  candy: [[at(10), at(20)]],
  bookstore: [[at(10), at(21)]],
  library: [[at(9), at(20)]],
  fazbear: [[at(11), at(21)]],
  toyFactory: [[at(10), at(19)]],
  indigoPark: [[at(10), at(20)]],
  trampoline: [[at(10), at(20)]],
  climbing: [[at(10), at(20)]],
  miniGolf: [[at(10), at(21)]],
  bowling: [[at(12), at(23)]],
  rollerRink: [[at(14), at(23)]],
  zoo: [[at(9), at(18)]],
  rainforest: [[at(9), at(19, 30)]],
  market: [[at(7), at(22)]],
  playground: [[at(8), at(19)]],
  disco: [[at(16), at(24)], [at(0), at(1)]], // same windows as DISCO_HOURS; weekends add 1–2am in isOpen
}
const LAUNCH = at(12)

function stayFor(g: Game, k: FacilityKind) {
  switch (k) {
    case 'cinema': return 110
    case 'partyHall': return 130
    case 'restaurant': return rnd(45, 80)
    case 'shop': return rnd(15, 40)
    case 'iceCream': case 'donuts': case 'candy': return rnd(10, 20)
    case 'tacos': return rnd(15, 30)
    case 'pizza': case 'pancakes': return rnd(25, 45)
    case 'sushi': return rnd(35, 60)
    case 'trampoline': case 'climbing': case 'miniGolf': return rnd(40, 70)
    case 'bookstore': return rnd(20, 45)
    case 'library': return rnd(45, 100)
    case 'fazbear': return rnd(50, 90)
    case 'toyFactory': case 'indigoPark': return rnd(50, 90)
    case 'bowling': case 'rollerRink': return rnd(50, 90)
    case 'arcade': return rnd(30, 60)
    case 'pool': return rnd(40, 90)
    case 'aquarium': return rnd(40, 70)
    case 'hauntedHouse': return rnd(25, 40)
    case 'dinoMuseum': return rnd(50, 90)
    case 'rocketPad': return Math.max(15, LAUNCH + 15 - minuteOfDay(g.time))
    case 'zoo': return rnd(40, 80)
    case 'rainforest': return rnd(40, 70)
    case 'market': return rnd(18, 36)
    case 'playground': return rnd(25, 50)
    case 'concertHall': return concertStay(g)
    case 'disco': return rnd(40, 90)
    default: return rnd(20, 40)
  }
}

export function isOpen(g: Game, f: Facility): boolean {
  if (f.fire > 0 || !f.reachable) return false
  const m = minuteOfDay(g.time)
  if (f.kind === 'partyHall' && !isWeekend(g.time) && !partyDay(g)) return false
  if (f.kind === 'concertHall') return concertOpen(g)
  const open = (HOURS[f.kind] ?? FUN_HOURS[f.kind] ?? []).some(([a, b]) => m >= a && m < b)
    || (f.kind === 'disco' && discoAfterWeekend(g))
  if (open && f.kind === 'playground' && playgroundRainedOut(g)) return false
  return open
}

function pickShop(g: Game, _p: Person, kinds: FacilityKind[], fromFloor: number): Facility | null {
  let best: Facility | null = null
  let bestScore = -1e9
  for (const f of g.facilities.values()) {
    if (!kinds.includes(f.kind) || !isOpen(g, f)) continue
    if (f.inside >= (SHOP_CAPACITY[f.kind] ?? 10)) continue
    const score = -Math.abs(f.floor - fromFloor) * 2 + f.happiness * 0.1 + Math.random() * 25
    if (score > bestScore) { bestScore = score; best = f }
  }
  return best
}

function goShopping(g: Game, p: Person, kinds: FacilityKind[]): boolean {
  const fromFloor = p.state === 'inside' ? (g.facilities.get(p.at)?.floor ?? 0) : 0
  const shop = pickShop(g, p, kinds, fromFloor)
  if (!shop) return false
  p.returnTo = p.state === 'inside' ? p.at : 0
  return startTrip(g, p, shop.id, 'shop')
}

function spawnVisitors(g: Game) {
  if (g.people.size > 9000) return
  const m = minuteOfDay(g.time)
  const wk = isWeekend(g.time) ? 1.6 : 1
  const metro = facilitiesOf(g, 'metro').length ? 1.6 : 1
  const donutBoost = facilitiesOf(g, 'giantDonut').length ? 3 : 1
  const demand = Math.min(4, 0.35 + g.pop / 700) * wk * metro
  for (const f of g.facilities.values()) {
    if (!isCommercial(f.kind) || !isOpen(g, f)) continue
    const appeal = Math.max(0.2, 0.5 + f.happiness / 100 + RENT_HAPPY[f.rent] / 50)
    let perHour = 0
    if (f.kind === 'fastFood') perHour = 5
    else if (f.kind === 'restaurant') perHour = m >= at(17) ? 6 : 2
    else if (f.kind === 'shop') perHour = 4
    else if (f.kind === 'cinema') {
      if (SHOWS.some((s) => m >= s - 60 && m < s - 5)) perHour = 30
    } else if (f.kind === 'partyHall') {
      if ((m >= at(11) && m < at(11, 50)) || (m >= at(17) && m < at(17, 50))) perHour = 45
    } else if (f.kind === 'iceCream') perHour = m >= at(13) && m < at(18) ? 6 : 3
    else if (f.kind === 'arcade') perHour = 4
    else if (f.kind === 'pizza') perHour = m >= at(17) || (m >= at(11, 30) && m < at(13, 30)) ? 6 : 2
    else if (f.kind === 'tacos') perHour = m >= at(11, 30) && m < at(13, 30) ? 6 : 3
    else if (f.kind === 'sushi') perHour = m >= at(17) ? 5 : 3
    else if (f.kind === 'donuts') perHour = (m < at(10) ? 6 : 2) * donutBoost
    else if (f.kind === 'pancakes') perHour = m < at(10, 30) ? 7 : 3
    else if (f.kind === 'bookstore') perHour = 4
    else if (f.kind === 'toyFactory') perHour = 8
    else if (f.kind === 'indigoPark') perHour = isWeekend(g.time) ? 14 : 9
    else if (f.kind === 'fazbear') perHour = isWeekend(g.time) ? 14 : m >= at(16) ? 9 : 5
    else if (f.kind === 'library') perHour = isWeekend(g.time) ? 8 : 5
    else if (f.kind === 'trampoline') perHour = isWeekend(g.time) ? 12 : 7
    else if (f.kind === 'climbing') perHour = 5
    else if (f.kind === 'miniGolf') perHour = 5
    else if (f.kind === 'bowling') perHour = m >= at(18) ? 10 : 4
    else if (f.kind === 'rollerRink') perHour = m >= at(18) ? 9 : 5
    else if (f.kind === 'candy') perHour = isWeekend(g.time) ? 6 : 3
    else if (f.kind === 'pool') perHour = 5
    else if (f.kind === 'aquarium') perHour = 8
    else if (f.kind === 'hauntedHouse') perHour = m >= at(19) ? 10 : 5
    else if (f.kind === 'dinoMuseum') perHour = 10
    else if (f.kind === 'rocketPad') perHour = m >= at(10, 30) && m < at(11, 45) ? 30 : 0
    else if (f.kind === 'zoo') perHour = 9
    else if (f.kind === 'rainforest') perHour = 8
    else if (f.kind === 'market') perHour = marketRush(m, isWeekend(g.time))
    else if (f.kind === 'playground') perHour = playgroundPerHour(g)
    else if (f.kind === 'concertHall') perHour = concertPerHour(g)
    else if (f.kind === 'disco') perHour = discoPerHour(g)
    perHour *= holidayRush(g, f.kind)
    if (perHour <= 0) continue
    const doors = f.kind === 'concertHall' ? concertDoors(g) : 1
    for (let i = 0; i < doors; i++) {
      if (Math.random() >= (perHour * demand * appeal) / 60 / doors) continue
      const v = newPerson(g, 'visitor', 0)
      v.returnTo = 0
      if (!startTrip(g, v, f.id, 'shop')) g.people.delete(v.id)
    }
  }
}

function parties(g: Game) {
  const m = minuteOfDay(g.time)
  if (!isWeekend(g.time) || (m !== at(12) && m !== at(18))) return
  for (const f of facilitiesOf(g, 'partyHall')) {
    if (f.inside >= 12) {
      const v = earn(g, 20000 * RENT_MULT[f.rent])
      f.incomeToday += v
      f.incomeTotal += v
      fx(g, facCenter(f), f.floor + 1, `🎉 +$${v.toLocaleString()}`, '#ff7ad9')
      sound.play('party')
    }
  }
}

// ---------- agendas ----------

function planDay(g: Game, p: Person, fromNow: boolean) {
  const base = dayOf(g.time) * 1440
  const now = g.time
  const weekend = isWeekend(g.time)
  const add = (t: number, act: string) => { if (!fromNow || t > now) schedule(p, t, act) }
  p.agenda = p.agenda.filter((a) => a.t >= base + 1440 || a.act === 'leaveShop' || a.act === 'doneClean')
  switch (p.kind) {
    case 'worker':
      if (weekend) break
      add(base + rnd(at(7), at(9, 15)), 'work')
      if (Math.random() < 0.2) add(base + rnd(at(9, 45), at(10, 45)), 'snack')
      if (Math.random() < 0.85) add(base + rnd(at(11, 30), at(13)), 'lunch')
      add(base + rnd(at(17), at(19)), 'exit')
      break
    case 'resident':
      if (!weekend) {
        if (Math.random() < 0.25) add(base + rnd(at(7), at(7, 40)), 'breakfast')
        if (Math.random() < 0.6) {
          add(base + rnd(at(8, 30), at(9, 30)), 'exit')
          add(base + rnd(at(16, 30), at(19)), 'home')
        }
        if (Math.random() < 0.35) add(base + rnd(at(18, 30), at(20, 30)), 'eat')
        else if (Math.random() < 0.25) add(base + rnd(at(17, 30), at(19, 30)), 'fun')
      } else {
        if (Math.random() < 0.4) add(base + rnd(at(8), at(10)), 'breakfast')
        if (Math.random() < 0.6) add(base + rnd(at(10, 30), at(14)), 'fun')
        if (Math.random() < 0.5) add(base + rnd(at(15), at(19)), 'fun')
      }
      add(base + at(22), 'home')
      break
    case 'maid':
      add(base + rnd(at(7, 45), at(8, 30)), 'post')
      add(base + rnd(at(17), at(17, 30)), 'exit')
      break
  }
}

function doAct(g: Game, p: Person, act: string) {
  const home = g.facilities.get(p.home)
  switch (act) {
    case 'work':
    case 'home':
    case 'post':
      if (!home) return
      if (p.state === 'inside' && p.at === home.id) return
      if (!startTrip(g, p, home.id, act === 'post' ? 'post' : act)) {
        p.tripStress = 30
        recordStress(g, p)
        if (p.kind === 'guest' || p.kind === 'vip') { guestGone(g, p, false); g.people.delete(p.id) }
      }
      return
    case 'exit':
      if (p.state === 'off') return
      releaseTask(g, p)
      p.agenda = p.agenda.filter((a) => a.act !== 'doneClean' && a.act !== 'leaveShop')
      if (!startTrip(g, p, 0, 'exit')) {
        // stuck: poof out
        leaveFacility(g, p)
        p.state = 'off'
      }
      return
    case 'checkout':
      if (p.state === 'off') { guestGone(g, p, true); g.people.delete(p.id); return }
      if (!startTrip(g, p, 0, 'exit')) { leaveFacility(g, p); guestGone(g, p, true); g.people.delete(p.id) }
      return
    case 'lunch':
      if (p.state !== 'inside') return
      if (!goShopping(g, p, LUNCH) && home) home.stressAvg += 3
      return
    case 'eat':
      if (p.state !== 'inside') return
      goShopping(g, p, DINNER)
      return
    case 'breakfast':
      if (p.state !== 'inside') return
      goShopping(g, p, BREAKFAST)
      return
    case 'snack':
      if (p.state !== 'inside') return
      goShopping(g, p, ['donuts', 'candy', 'iceCream'])
      return
    case 'fun':
      if (p.state !== 'inside') return
      goShopping(g, p, ['shop', 'cinema', 'candy', ...DINNER, ...ATTRACTIONS.filter((k) => k !== 'rocketPad')])
      return
    case 'leaveShop':
      goBack(g, p)
      return
    case 'trick':
      trickNext(g, p, holidaySim)
      return
    case 'doneClean': {
      const r = g.facilities.get(p.task)
      if (r) {
        r.dirty = false
        if (r.roaches) log(g, `🪳 Housekeeping got rid of the cockroaches on ${floorLabel(r.floor)}!`, 'good', r.floor, r.x)
        r.roaches = false
        r.cleaner = 0
        fx(g, facCenter(r), r.floor, '✨', '#9ff')
      }
      p.task = 0
      maidNext(g, p)
      if (p.state === 'inside' && p.at !== p.home) goBackToPost(g, p)
      return
    }
  }
}

// ---------- tenants move in / out ----------

function moveIn(g: Game, f: Facility) {
  f.occupied = true
  f.sad = 0
  const def = FACILITIES[f.kind]
  if (f.kind === 'office') {
    for (let i = 0; i < def.pop; i++) {
      const p = newPerson(g, 'worker', f.id)
      planDay(g, p, true)
    }
    log(g, `💼 A company moved into the office on ${floorLabel(f.floor)}`, 'good', f.floor, f.x)
  } else if (f.kind === 'condo') {
    const v = earn(g, CONDO_PRICE * RENT_MULT[f.rent])
    f.incomeTotal += v
    fx(g, facCenter(f), f.floor, `SOLD +$${v.toLocaleString()}`, '#ffd23f')
    sound.play('cash')
    for (let i = 0; i < def.pop; i++) {
      const p = newPerson(g, 'resident', f.id)
      schedule(p, g.time + rnd(1, 40), 'home')
      planDay(g, p, true)
    }
    log(g, `🏠 A family bought the condo on ${floorLabel(f.floor)}!`, 'good', f.floor, f.x)
  } else if (f.kind === 'housekeeping') {
    for (let i = 0; i < 6; i++) {
      const p = newPerson(g, 'maid', f.id)
      p.shirt = 50
      planDay(g, p, true)
      const m = minuteOfDay(g.time)
      if (m > at(8, 30) && m < at(17)) schedule(p, g.time + rnd(1, 20), 'post')
    }
  } else if (f.kind === 'security') {
    for (let i = 0; i < 6; i++) {
      const p = newPerson(g, 'guard', f.id)
      p.shirt = 60
      p.state = 'inside'
      p.at = f.id
      p.floor = f.floor
      f.inside++
    }
  }
}

function moveOut(g: Game, f: Facility, why: string) {
  for (const p of [...g.people.values()]) if (p.home === f.id) {
    evict(g, p.id)
    g.people.delete(p.id)
  }
  f.occupied = false
  f.inside = 0
  f.sad = 0
  f.stressAvg = 0
  log(g, `😢 Tenants moved out of the ${FACILITIES[f.kind].name.toLowerCase()} on ${floorLabel(f.floor)}: ${why}`, 'bad', f.floor, f.x)
  sound.play('bad')
}

// ---------- evaluation ----------

let envVersion = -1
let envGame: Game | null = null

function refreshEnvironment(g: Game) {
  if (envGame === g && envVersion === g.buildVersion) return
  envGame = g
  envVersion = g.buildVersion
  const ents = lobbyEntrances(g).filter((e) => e.floor === 0)
  const e = ents[0]
  for (const f of g.facilities.values()) {
    if (f.kind === 'lobby' || isConnector(f.kind)) { f.reachable = true; continue }
    f.reachable = !!e && findRoute(g, e.floor, e.x, f.floor, facCenter(f)) !== null
    if (f.kind === 'metro') f.reachable = true
    f.noisy = false
    f.nearPark = false
    if (f.kind === 'office' || isResidential(f.kind)) {
      for (const pk of facilitiesOf(g, 'park')) {
        if (pk.floor === f.floor && pk.x < f.x + f.width + 10 && pk.x + pk.width > f.x - 10) { f.nearPark = true; break }
      }
    }
    if (isResidential(f.kind) && !f.nearPark) {
      for (const pg of facilitiesOf(g, 'playground')) {
        if (pg.floor === f.floor + 1 && pg.x < f.x + f.width && f.x < pg.x + pg.width) { f.nearPark = true; break }
      }
    }
    if (isResidential(f.kind)) {
      const r = g.floors.get(f.floor)!
      for (let i = Math.max(0, f.x - 3); i < Math.min(r.length, f.x + f.width + 3); i++) {
        const v = r[i]
        if (v <= 0 || v === f.id) continue
        const o = g.facilities.get(v)
        if (g.shafts.has(v) || (o && ((isCommercial(o.kind) && o.kind !== 'library') || isConnector(o.kind) || o.kind === 'office'))) { f.noisy = true; break }
      }
    }
  }
}

function evaluate(g: Game) {
  refreshEnvironment(g)
  const count = (k: FacilityKind) => facilitiesOf(g, k).length
  let offices = 0, condos = 0
  for (const f of g.facilities.values()) { if (f.kind === 'office' && f.occupied) offices++; if (f.kind === 'condo' && f.occupied) condos++ }
  const food = LUNCH.reduce((n, k) => n + count(k), 0)
  const parkingShort = g.stars >= 3 && count('parking') < Math.ceil((offices + condos) / 10)
  const trashShort = g.stars >= 3 && count('recycling') < Math.ceil(g.pop / 3000)
  const medShort = g.stars >= 3 && count('medical') < Math.ceil(g.pop / 4000)
  for (const f of g.facilities.values()) {
    const c: string[] = []
    if (f.kind === 'lobby' || f.kind === 'floor' || isConnector(f.kind)) { f.complaints = []; f.happiness = 80; continue }
    if (!f.reachable) c.push('Can\'t be reached from the lobby')
    if (isCommercial(f.kind)) {
      const cap = (SHOP_CAPACITY[f.kind] ?? 10) * 4
      const ratio = Math.min(1, Math.max(f.customersYesterday, f.customersToday) / cap)
      f.happiness = Math.round(35 + ratio * 65)
      if (ratio < 0.3 && f.reachable) c.push('Not many customers yet')
      f.complaints = c
      continue
    }
    if (!(f.kind === 'office' || f.kind === 'condo' || isHotel(f.kind))) { f.complaints = c; f.happiness = f.reachable ? 80 : 20; continue }
    let h = 82 + RENT_HAPPY[f.rent] - f.stressAvg * 1.2
    if (f.stressAvg > 25) c.push('Elevators are way too slow')
    else if (f.stressAvg > 12) c.push('Waiting a while for elevators')
    if (f.noisy) { h -= 18; c.push('Too noisy next door') }
    if (f.nearPark) h += 12
    if (f.kind === 'office' && food === 0) { h -= 15; c.push('Nowhere to eat lunch') }
    if (isHotel(f.kind) && f.roaches) { h -= 45; c.push('Cockroaches!') }
    else if (isHotel(f.kind) && f.dirty) c.push('Waiting for housekeeping')
    if (isHotel(f.kind) && count('housekeeping') === 0) c.push('No housekeeping in the tower')
    if (parkingShort && (f.kind === 'office' || f.kind === 'condo' || f.kind === 'hotelSuite')) { h -= 8; c.push('Not enough parking') }
    if (trashShort && (f.kind === 'office' || f.kind === 'condo')) { h -= 12; c.push('Trash is piling up (need Recycling)') }
    if (medShort && (f.kind === 'office' || f.kind === 'condo')) { h -= 8; c.push('No medical center nearby') }
    if (f.rent >= 2) c.push('Rent is pricey')
    if (!f.reachable) h = 10
    f.happiness = Math.round(Math.max(0, Math.min(100, h)))
    f.complaints = c
  }
}

function computePop(g: Game) {
  let pop = 0
  for (const f of g.facilities.values()) {
    const def = FACILITIES[f.kind]
    if (!def.pop) continue
    if (f.kind === 'office' || f.kind === 'condo') { if (f.occupied) pop += def.pop }
    else if (isHotel(f.kind)) { if (f.booked || f.rentedLastNight) pop += def.pop }
    else if (f.reachable) pop += def.pop
  }
  g.pop = pop
}

export function starProgress(g: Game) {
  const rules = starRules(g.mode)
  const r = rules[g.stars]
  if (!r) return null
  const have = (k: FacilityKind) => facilitiesOf(g, k).length > 0
  const needs = r.needs.map((n) => {
    let done = false
    if (n.id === 'vip') done = g.flags.vip
    else if (n.id === 'cathedral') done = facilitiesOf(g, 'cathedral').some((c) => c.floor + c.height - 1 === MAX_FLOOR)
    else done = have(n.id as FacilityKind)
    return { ...n, done }
  })
  return { pop: r.pop, needs, popDone: g.pop >= r.pop, ready: g.pop >= r.pop && needs.every((n) => n.done) }
}

function checkRating(g: Game) {
  const p = starProgress(g)
  if (!p || !p.ready) return
  g.stars++
  g.starCelebration = 1
  sound.play('star')
  if (g.stars === 6) log(g, '🏆 Your building earned the TOWER rating! You\'re a legendary builder!', 'star')
  else log(g, `⭐ Your tower is now ${g.stars} stars! New things to build unlocked.`, 'star')
}

// ---------- events ----------

export function startFire(g: Game) {
  const candidates = [...g.facilities.values()].filter((f) => f.kind !== 'lobby' && !isConnector(f.kind) && f.floor > 0 && f.kind !== 'cathedral')
  if (!candidates.length) return
  const f = pick(candidates)
  f.fire = 0.15
  log(g, `🔥 FIRE on ${floorLabel(f.floor)}! ${facilitiesOf(g, 'security').length ? 'Security is on the way!' : 'Build Security to fight fires!'}`, 'bad', f.floor, f.x)
  sound.play('alarm')
  dispatchGuards(g, (guard) => startTrip(g, guard, f.id, 'fire'), 4)
}

function dispatchGuards(g: Game, go: (p: Person) => boolean, perOffice: number) {
  for (const sec of facilitiesOf(g, 'security')) {
    let n = 0
    for (const p of g.people.values()) {
      if (n >= perOffice) break
      if (p.home === sec.id && p.kind === 'guard' && p.state === 'inside' && p.at === sec.id) {
        if (go(p)) n++
      }
    }
  }
}

function stepFires(g: Game) {
  for (const f of [...g.facilities.values()]) {
    if (f.fire <= 0) continue
    let guards = 0
    for (const p of g.people.values()) if (p.kind === 'guard' && p.at === f.id && p.state === 'inside') guards++
    if (guards > 0) {
      f.fire -= 0.02 * guards
      if (f.fire <= 0) {
        f.fire = 0
        log(g, `🧯 Security put out the fire on ${floorLabel(f.floor)}.`, 'good', f.floor, f.x)
        for (const p of g.people.values()) if (p.kind === 'guard' && p.at === f.id) goBackToPost(g, p)
      }
      continue
    }
    f.fire += 0.006
    if (f.fire > 0.6 && Math.random() < 0.02) {
      // spread to a neighbour
      const opts = [g.floors.get(f.floor)?.[f.x - 1], g.floors.get(f.floor)?.[f.x + f.width], g.floors.get(f.floor + 1)?.[f.x + 1]]
      for (const id of opts) {
        const n = id && id > 0 ? g.facilities.get(id) : undefined
        if (n && n.fire === 0 && n.kind !== 'lobby' && !isConnector(n.kind)) {
          n.fire = 0.1
          dispatchGuards(g, (guard) => startTrip(g, guard, n.id, 'fire'), 2)
          break
        }
      }
    }
    if (f.fire >= 1) {
      log(g, `💥 The ${FACILITIES[f.kind].name.toLowerCase()} on ${floorLabel(f.floor)} burned down.`, 'bad', f.floor, f.x)
      fx(g, facCenter(f), f.floor, '💨', '#999')
      demolish(g, f.id, (pid) => evict(g, pid))
    }
  }
}

export function bombDecision(g: Game, pay: boolean) {
  const b = g.bomb
  if (!b || b.decided) return
  b.decided = true
  if (pay) {
    if (spend(g, b.ransom) || g.mode === 'sandbox') {
      log(g, '💸 You paid the ransom. The bomb threat is over.', 'info')
      g.bomb = null
      return
    }
    log(g, 'Not enough money for the ransom! Security must search.', 'bad')
  }
  const secs = facilitiesOf(g, 'security')
  if (!secs.length) log(g, '⚠️ No Security office to search for the bomb!', 'bad')
  else log(g, '👮 Security is searching every floor. Hurry!', 'event')
  dispatchGuards(g, (p) => guardSearchNext(g, p), 6)
}

function guardSearchNext(g: Game, p: Person): boolean {
  const b = g.bomb
  if (!b) return false
  const claimed = new Set<number>()
  for (const o of g.people.values()) if (o.kind === 'guard' && o !== p && (o.purpose === 'search' || o.purpose === 'sweep') && o.state !== 'inside') claimed.add(o.goalFloor)
  const floors = [...g.floors.keys()].filter((f) => !b.searched.includes(f) && !claimed.has(f))
  if (!floors.length) { goBackToPost(g, p); return false }
  const from = p.state === 'inside' ? (g.facilities.get(p.at)?.floor ?? p.floor) : p.floor
  floors.sort((a, c) => Math.abs(a - from) - Math.abs(c - from))
  for (const f of floors.slice(0, 6)) {
    const [a, c] = floorExtent(g, f)
    const x = Math.abs(p.x - a) < Math.abs(p.x - c) ? a : c
    if (startTrip(g, p, 0, 'search', f, x)) { p.goalFac = 0; return true }
    b.searched.push(f) // unreachable floors can't hide a findable bomb... mark checked
  }
  return false
}

export function startBomb(g: Game) {
  const floors = [...g.floors.keys()].filter((f) => f > 0)
  if (!floors.length) return
  const f = pick(floors)
  const [a, b] = floorExtent(g, f)
  g.bomb = { floor: f, x: rnd(a, b), deadline: g.time + 300, searched: [], decided: false, ransom: 100_000 * g.stars * 2, defused: false }
  log(g, '💣 A bomb threat! Pay the ransom or let Security search the tower.', 'event')
  sound.play('alarm')
}

function stepBomb(g: Game) {
  const b = g.bomb
  if (!b || b.defused) return
  if (!b.decided && g.time > b.deadline - 240) bombDecision(g, false)
  if (g.time < b.deadline) return
  log(g, `💥 BOOM! The bomb went off on ${floorLabel(b.floor)}.`, 'bad', b.floor, b.x)
  sound.play('boom')
  for (const f of [...g.facilities.values()]) {
    if (f.floor + f.height - 1 < b.floor - 1 || f.floor > b.floor + 1) continue
    if (f.x + f.width < b.x - 14 || f.x > b.x + 14) continue
    demolish(g, f.id, (pid) => evict(g, pid))
  }
  fx(g, b.x, b.floor, '💥', '#f80')
  g.bomb = null
  for (const p of g.people.values()) if (p.kind === 'guard' && (p.purpose === 'search' || p.purpose === 'sweep')) goBackToPost(g, p)
}

/** A VIP checks into the best free Suite. Only on the days surprises.ts draws one. */
export function startVip(g: Game) {
  if (g.flags.vip || g.flags.vipVisit === today(g)) return
  g.flags.vipVisit = today(g)
  const suites = facilitiesOf(g, 'hotelSuite').filter((s) => !s.booked && !s.dirty && !s.roaches && s.reachable)
  if (!suites.length) {
    if (facilitiesOf(g, 'hotelSuite').length) log(g, '🎩 A VIP wanted to visit but no clean Suite was free. Try again soon!', 'bad')
    return
  }
  suites.sort((a, b) => b.happiness - a.happiness)
  bookRoom(g, suites[0], 'vip')
  log(g, `🎩 A VIP is checking into the Suite on ${floorLabel(suites[0].floor)} tonight! Keep the elevators moving!`, 'event', suites[0].floor, suites[0].x)
  sound.play('party')
}

// ---------- clock ticks ----------

function minuteTick(g: Game) {
  const m = Math.round(minuteOfDay(g.time))
  // agendas
  for (const p of g.people.values()) {
    if (p.state !== 'inside' && p.state !== 'off') continue
    const a = p.agenda[0]
    if (a && a.t <= g.time) {
      p.agenda.shift()
      doAct(g, p, a.act)
    }
  }
  hotelBookings(g)
  spawnVisitors(g)
  parties(g)
  funEvents(g, m)
  trains(g, m)
  stepEntity(g)
  stepFires(g)
  stepBomb(g)
  if (m % 15 === 0) {
    // idle housekeepers look for work
    for (const p of g.people.values()) if (p.kind === 'maid' && p.state === 'inside' && p.at === p.home && !p.task) maidNext(g, p)
  }
  surpriseMinute(g)
  ufoMinute(g)
  if (m % 60 === 0) hourTick(g, m)
  giantsArrive(g)
}

function hourTick(g: Game, m: number) {
  evaluate(g)
  // occupancy: staff facilities and vacant tenants
  const moveChance = g.mode === 'classic' ? 0.18 : 0.35
  for (const f of g.facilities.values()) {
    if (f.occupied || !f.reachable || f.fire) continue
    if (f.kind === 'housekeeping' || f.kind === 'security') { moveIn(g, f); continue }
    if (f.kind === 'office' || f.kind === 'condo') {
      if (m < at(7) || m > at(20)) continue
      if (f.happiness < 30) continue
      if (Math.random() < moveChance) moveIn(g, f)
    }
  }
  computePop(g)
  checkRating(g)
  if (g.disasters && g.stars >= 2 && m >= at(9) && m <= at(20)) {
    if (Math.random() < 1 / (24 * 14)) startFire(g)
    if (g.stars >= 3 && !g.bomb && Math.random() < 1 / (24 * 20)) startBomb(g)
  }
  if (quarterOf(g.time) === 4 && dayOf(g.time) % 3 === 2 && m === at(19)) g.flags.santaDay = dayOf(g.time)
  huggyHour(g, m)
  stepHoliday(g, m, holidaySim)
  zooHour(g, m)
  frogsHour(g, m)
}

const holidaySim: HolidaySim = { newPerson, startTrip, evict, schedule }

// ---------- metro trains ----------

/** A train every TRAIN_EVERY minutes from 5am to midnight: pulls in, doors open, pulls out. */
export const TRAIN_EVERY = 30
export const TRAIN_IN = 5 // minutes to pull in
export const TRAIN_DOORS = 8 // minutes doors stay open
export const TRAIN_OUT = 5 // minutes to pull out
const TRAIN_FIRST = at(5)

/** Where today's train is: null when no train is in or near the station. `k` is 0..1 progress within the phase. */
export function trainPhase(g: Game): { phase: 'in' | 'doors' | 'out'; k: number } | null {
  const m = minuteOfDay(g.time)
  if (m < TRAIN_FIRST) return null
  const c = (m - TRAIN_FIRST) % TRAIN_EVERY
  if (c < TRAIN_IN) return { phase: 'in', k: c / TRAIN_IN }
  if (c < TRAIN_IN + TRAIN_DOORS) return { phase: 'doors', k: (c - TRAIN_IN) / TRAIN_DOORS }
  if (c < TRAIN_IN + TRAIN_DOORS + TRAIN_OUT) return { phase: 'out', k: (c - TRAIN_IN - TRAIN_DOORS) / TRAIN_OUT }
  return null
}

function trainSoon(g: Game) {
  const m = minuteOfDay(g.time)
  return m >= TRAIN_FIRST - TRAIN_EVERY && m < at(24) - TRAIN_EVERY + TRAIN_IN
}

function metroAt(g: Game, floor: number, x: number) {
  for (const f of g.facilities.values()) if (f.kind === 'metro' && f.floor === floor && x >= f.x && x <= f.x + f.width) return f
  return null
}

function trains(g: Game, m: number) {
  if (m < TRAIN_FIRST || (m - TRAIN_FIRST) % TRAIN_EVERY !== TRAIN_IN) return
  const stations = facilitiesOf(g, 'metro')
  if (!stations.length) return
  sound.play('train')
  for (const st of stations) {
    // everyone on the platform gets on
    let boarded = 0
    for (const p of [...g.people.values()]) {
      if (p.at !== st.id || p.purpose !== 'train' || p.state !== 'inside') continue
      leaveFacility(g, p)
      boarded++
      if (p.kind === 'visitor') g.people.delete(p.id)
      else if (p.kind === 'guest' || p.kind === 'vip') { guestGone(g, p, true); g.people.delete(p.id) }
      else p.state = 'off'
    }
    // and a crowd gets off, heading somewhere fun
    const shops = [...g.facilities.values()].filter((f) => isCommercial(f.kind) && isOpen(g, f))
    const n = shops.length ? Math.min(12, 4 + Math.floor(g.pop / 400)) : 0
    let arrived = 0
    for (let i = 0; i < n && g.people.size < 9000; i++) {
      const v = newPerson(g, 'visitor', 0)
      enterFacility(g, v, st)
      v.returnTo = 0
      const shop = pickShop(g, v, shops.map((s) => s.kind), st.floor)
      if (shop && startTrip(g, v, shop.id, 'shop')) arrived++
      else { leaveFacility(g, v); g.people.delete(v.id) }
    }
    if (arrived + boarded > 0) fx(g, st.x + st.width / 2, st.floor + st.height - 1, `🚇 ${arrived} off · ${boarded} on`, '#a5d8ff')
  }
}

// ---------- spooky stuff: Huggy hide-and-seek, Rush and Seek ----------

const nightOf = (g: Game) => dayOf(g.time) - (minuteOfDay(g.time) < at(6) ? 1 : 0)
const isNight = (m: number) => m >= at(20) || m < at(6)

function hideHuggy(g: Game, factory: Facility) {
  const rooms = [...g.facilities.values()].filter((f) => f.id !== factory.id && f.width >= 4 && f.kind !== 'lobby' && !isConnector(f.kind) && f.kind !== 'rocketPad')
  if (!rooms.length) return false
  const r = pick(rooms)
  g.flags.huggy = { floor: r.floor + r.height - 1, x: r.x + 1.5 + Math.random() * (r.width - 3) }
  return true
}

/** Huggy gets out of his case. Only on the nights surprises.ts draws him. */
export function releaseHuggy(g: Game) {
  const factory = facilitiesOf(g, 'toyFactory').find((f) => f.reachable)
  if (!factory || g.flags.huggy || g.flags.huggyFound === nightOf(g)) return
  if (!hideHuggy(g, factory)) return
  log(g, '🧸 Huggy Wuggy\'s display case is EMPTY! He\'s hiding in a vent somewhere in your tower. Find him and tap him!', 'event')
  sound.play('spooky')
}

/** While he's loose, Huggy changes hiding spots every two hours and is back in his case by sunrise. */
function huggyHour(g: Game, m: number) {
  if (!g.flags.huggy) return
  const factory = facilitiesOf(g, 'toyFactory').find((f) => f.reachable)
  if (!factory) { g.flags.huggy = null; return }
  if (m === at(6)) {
    g.flags.huggy = null
    log(g, '🧸 Huggy Wuggy snuck back into his case before sunrise. Try to find him another night!', 'info', factory.floor, factory.x + 5)
    return
  }
  if (isNight(m) && m % 120 === 0) hideHuggy(g, factory)
}

/** Tapped Huggy: he goes back in his case for the rest of the night. */
export function catchHuggy(g: Game) {
  const h = g.flags.huggy
  if (!h) return
  const v = earn(g, 10000 + g.stars * 5000)
  g.flags.huggy = null
  g.flags.huggyFound = nightOf(g)
  fx(g, h.x, h.floor, `🧸 Found you, Huggy! +$${v.toLocaleString()}`, '#74c0fc')
  log(g, `🧸 You found Huggy Wuggy hiding on ${floorLabel(h.floor)}! Back in the case he goes. +$${v.toLocaleString()}`, 'good', h.floor, h.x)
  sound.play('party')
}

export const ENTITY = { rush: { warn: 40, pass: 8 }, seek: { warn: 30, pass: 16 } } as const

/** The entity visiting tonight, with how far along it is. */
export function entityNow(g: Game) {
  const e = g.flags.entity
  if (!e) return null
  const d = ENTITY[e.kind]
  const t = g.time - e.start
  if (t < 0 || t > d.warn + d.pass) return null
  return { ...e, warning: t < d.warn, k: t < d.warn ? t / d.warn : (t - d.warn) / d.pass }
}

/** Rush runs a hotel floor; Seek watches any floor above the lobby. Only on the nights surprises.ts draws one. */
export function startEntity(g: Game, kind: 'rush' | 'seek') {
  if (g.flags.entity && entityNow(g)) return
  const floors = kind === 'rush'
    ? [...new Set([...g.facilities.values()].filter((f) => isHotel(f.kind)).map((f) => f.floor))]
    : [...g.floors.keys()].filter((f) => f >= 1)
  if (!floors.length) return
  const floor = pick(floors)
  const [a, b] = floorExtent(g, floor)
  g.flags.entity = { kind, floor, start: Math.round(g.time), a, b }
  g.flags.entityNight = nightOf(g)
  if (kind === 'rush') {
    log(g, `⚡ The lights are flickering on ${floorLabel(floor)}… something is coming! Hide!`, 'event', floor, (a + b) / 2)
    sound.play('flicker')
  } else {
    log(g, `👁️ Eyes are opening on the walls of ${floorLabel(floor)}…`, 'event', floor, (a + b) / 2)
    sound.play('heartbeat')
  }
}

function stepEntity(g: Game) {
  const e = g.flags.entity
  if (!e) return
  const d = ENTITY[e.kind]
  const t = Math.round(g.time - e.start)
  if (t === d.warn) {
    sound.play(e.kind === 'rush' ? 'rush' : 'heartbeat')
    if (e.kind === 'rush') {
      for (const f of g.facilities.values()) if (isHotel(f.kind) && f.floor === e.floor) fx(g, facCenter(f), f.floor, '🚪 Hid in the closet!', '#ced4da')
    } else fx(g, e.a + 2, e.floor, 'RUN! 🏃', '#ff6b6b')
  }
  if (t >= d.warn + d.pass) {
    g.flags.entity = null
    if (e.kind === 'rush') log(g, `💨 RUSH roared down the hall on ${floorLabel(e.floor)}! Everyone hid in the closets. Phew!`, 'good', e.floor, (e.a + e.b) / 2)
    else log(g, `🏃 SEEK chased everyone across ${floorLabel(e.floor)}… then sank back into the floor.`, 'good', e.floor, (e.a + e.b) / 2)
    if (e.kind === 'rush' && !g.flags.guided) {
      g.flags.guided = true
      log(g, '💙 Guiding Light: when the lights flicker, hide in a closet. You can do this!', 'info')
    }
  }
}

/** True while a visiting entity has everyone on that floor hiding. */
export function hidingOn(g: Game, floor: number) {
  const e = entityNow(g)
  return !!e && e.floor === floor && !e.warning
}

// ---------- whimsy: rockets, dinosaurs, ghosts and aliens ----------

/** Minutes since today's launch; the renderer uses this to fly the rocket. */
export function launchClock(g: Game) {
  return minuteOfDay(g.time) - LAUNCH
}

function funEvents(g: Game, m: number) {
  // Wired on the first minute, after every module has finished loading.
  if (!discoWired) { discoWired = true; discoFx.play = (name) => sound.play(name) }
  discoMinute(g, m)
  const countdown: Record<number, string> = { [LAUNCH - 15]: '3…', [LAUNCH - 10]: '2…', [LAUNCH - 5]: '1…' }
  for (const f of g.facilities.values()) {
    if (!f.reachable || f.fire) continue
    if (f.kind === 'rocketPad') {
      if (countdown[m]) fx(g, facCenter(f), f.floor + 2, countdown[m], '#ffd43b')
      if (m === LAUNCH) {
        const v = earn(g, 25000 * (1 + f.inside / 10))
        f.incomeToday += v
        f.incomeTotal += v
        fx(g, facCenter(f), f.floor + 2, `🚀 LIFTOFF! +$${v.toLocaleString()}`, '#ffd43b')
        log(g, `🚀 3… 2… 1… LIFTOFF! The rocket blasted off from ${floorLabel(f.floor)} with ${f.inside} fans watching!`, 'event', f.floor + 1, facCenter(f))
        sound.play('rocket')
      }
      if (m === LAUNCH + 150) fx(g, facCenter(f), f.floor + 2, 'Touchdown! 🛬', '#9ff')
    }
    if (f.kind === 'dinoMuseum' && (m === at(12) || m === at(16)) && isOpen(g, f)) {
      fx(g, f.x + 12, f.floor + 2, 'ROAAAR! 🦖', '#ff922b')
      sound.play('roar')
    }
    if (f.kind === 'fazbear' && m === at(6)) {
      fx(g, facCenter(f), f.floor + 1, '🔔 6 AM! You survived the night! 🎉', '#ffd43b')
      sound.play('bell')
    }
    if (f.kind === 'hauntedHouse' && m === at(17)) {
      fx(g, facCenter(f), f.floor + 1, 'Boo! 👻', '#e5dbff')
      sound.play('spooky')
    }
  }
  roofMinute(g, m)
  concertMinute(g, m)
}

function roofMinute(g: Game, m: number) {
  if (clearNight(g, m) && g.flags.saturnNight !== dayOf(g.time)) {
    const obs = facilitiesOf(g, 'observatory')
    if (obs.length) {
      g.flags.saturnNight = dayOf(g.time)
      const f = obs[0]
      fx(g, facCenter(f), f.floor + f.height, '✨ Saw Saturn!', '#ffd43b')
    }
  }
  const pads = facilitiesOf(g, 'helipad')
  if (!pads.length) return
  if (heliMinute(m, 'in') || heliMinute(m, 'sit')) sound.play('rotor')
  if (!heliMinute(m, 'sit')) return
  for (const pad of pads) {
    const kinds = [...g.facilities.values()].filter((f) => f.id !== pad.id && isCommercial(f.kind) && isOpen(g, f)).map((f) => f.kind)
    let n = 0
    for (let i = 0; i < 6 && g.people.size < 9000; i++) {
      const v = newPerson(g, 'visitor', 0)
      enterFacility(g, v, pad)
      v.returnTo = 0
      const shop = kinds.length ? pickShop(g, v, kinds, pad.floor) : null
      if (shop && startTrip(g, v, shop.id, 'shop')) n++
      else { leaveFacility(g, v); g.people.delete(v.id) }
    }
    fx(g, facCenter(pad), pad.floor + 1, n ? `🚁 ${n} visitors` : '🚁 No way inside!', '#74c0fc')
  }
}

/** How long the UFO stays, in sim minutes. */
export const UFO_STAY = 60

/** Sim minute the UFO arrived. Old saves only have the day: it came at 10pm. */
const ufoArrived = (day: number, ufoAt?: number) => ufoAt ?? day * 1440 + at(22)

/** Minutes since the UFO arrived, or null when it isn't here. */
export function ufoTime(g: Game): number | null {
  if (g.flags.ufoDay !== dayOf(g.time)) return null
  const t = g.time - ufoArrived(g.flags.ufoDay, g.flags.ufoAt)
  return t >= 0 && t < UFO_STAY ? t : null
}

/** The UFO arrives. Only on the nights surprises.ts draws it. */
export function startUfo(g: Game) {
  g.flags.ufoDay = dayOf(g.time)
  g.flags.ufoAt = Math.round(g.time)
  log(g, '🛸 A UFO is hovering over your tower! Quick, look up!', 'event', topFloor(g) + 2, ufoX(g))
  sound.play('ufo')
}

/** An hour after it came, the UFO leaves space money. */
function ufoMinute(g: Game) {
  if (g.flags.ufoDay == null || Math.round(g.time) !== ufoArrived(g.flags.ufoDay, g.flags.ufoAt) + UFO_STAY) return
  const v = earn(g, 15000 + g.pop * 5)
  log(g, `👽 The aliens loved your tower! They left $${v.toLocaleString()} in space money.`, 'good', topFloor(g) + 1, ufoX(g))
  fx(g, ufoX(g), topFloor(g) + 1, `👽 +$${v.toLocaleString()}`, '#8ce99a')
}

/** The middle of the highest floor, where the UFO likes to hover. */
export function ufoX(g: Game) {
  const r = g.floors.get(topFloor(g))
  if (!r) return 120
  let a = 0
  while (a < r.length && r[a] === -1) a++
  let b = r.length - 1
  while (b > 0 && r[b] === -1) b--
  return (a + b + 1) / 2
}

function dayTick(g: Game) {
  const day = dayOf(g.time)
  g.stats.day = day
  slideDayTick(g)
  for (const f of g.facilities.values()) {
    f.customersYesterday = f.customersToday
    f.customersToday = 0
    f.incomeToday = 0
    if (isHotel(f.kind)) {
      f.rentedLastNight = f.booked
      if (f.dirty && !f.roaches && day - f.dirtySince >= 2) {
        f.roaches = true
        log(g, `🪳 Cockroaches in the hotel room on ${floorLabel(f.floor)}! Housekeeping needs to clean it.`, 'bad', f.floor, f.x)
      }
    }
    if ((f.kind === 'office' || f.kind === 'condo') && f.occupied) {
      if (f.happiness < 28) f.sad++
      else f.sad = 0
      if (f.sad >= 3) moveOut(g, f, f.complaints[0] ?? 'unhappy')
    }
  }
  // roaches spread
  for (const f of g.facilities.values()) {
    if (!f.roaches || Math.random() > 0.25) continue
    const r = g.floors.get(f.floor)!
    for (const id of [r[f.x - 1], r[f.x + f.width]]) {
      const n = id > 0 ? g.facilities.get(id) : undefined
      if (n && isHotel(n.kind) && !n.roaches) { n.roaches = true; n.dirty = true; break }
    }
  }
  for (const p of g.people.values()) {
    if (p.kind === 'worker' || p.kind === 'resident' || p.kind === 'maid') planDay(g, p, false)
    p.mood *= 0.6
  }
  if (day > 0 && day % DAYS_PER_QUARTER === 0) quarterTick(g)
  surpriseDay(g)
}

function quarterTick(g: Game) {
  let rent = 0
  let upkeep = 0
  for (const f of g.facilities.values()) {
    if (f.kind === 'office' && f.occupied) {
      const v = earn(g, OFFICE_RENT * RENT_MULT[f.rent])
      rent += v
      f.incomeTotal += v
    }
    upkeep += FACILITIES[f.kind].upkeep ?? 0
  }
  for (const s of g.shafts.values()) upkeep += TRANSPORTS[s.kind].upkeep * s.cars.length
  upkeep = Math.max(0, upkeep - turbineCut(g))
  if (g.mode !== 'sandbox') { g.money -= upkeep; g.stats.expense += upkeep }
  g.stats.lastQuarter = { income: g.stats.income, expense: g.stats.expense }
  g.stats.income = 0
  g.stats.expense = 0
  log(g, `📊 New quarter! Office rent +$${rent.toLocaleString()} · upkeep -$${upkeep.toLocaleString()}`, 'info')
  if (rent > 0) sound.play('cash')
}

// ---------- main step ----------

export function step(g: Game) {
  const before = g.time
  g.time += MINUTES_PER_STEP
  const h = getHooks(g)
  for (const s of g.shafts.values()) stepShaft(s, h)
  for (const p of g.people.values()) {
    if (p.state === 'walking' || p.state === 'waiting' || p.state === 'climbing') stepPerson(g, p)
  }
  if (Math.floor(g.time) !== Math.floor(before)) {
    if (dayOf(g.time) !== dayOf(before)) dayTick(g)
    minuteTick(g)
  }
}

/** Called after the player builds something so tenants react immediately. */
export function afterBuild(g: Game) {
  evaluate(g)
  computePop(g)
  for (const f of g.facilities.values()) {
    if (!f.occupied && f.reachable && (f.kind === 'housekeeping' || f.kind === 'security')) moveIn(g, f)
  }
}

export function setRent(g: Game, f: Facility, level: 0 | 1 | 2 | 3) {
  f.rent = level
  evaluate(g)
}

export function shaftLoad(s: Shaft) {
  let waiting = 0
  for (const k in s.q) waiting += s.q[k].up.length + s.q[k].down.length
  return waiting
}

export function evictHandler(g: Game) {
  return (pid: number) => evict(g, pid)
}
