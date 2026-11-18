// Headless: the Crossovers tab (#20). Every room builds, opens, gets visitors and reacts to a tap;
// the Door Hall monsters take turns; Crooner sings on the hour; the lamps flicker; Mortimer's
// shoppers leave holding something; the Math Maker paints one free tile at noon, never a built one.
import { ATTRACTIONS, CATEGORIES, FACILITIES, SHOP_CAPACITY, SPEND } from '../src/game/defs'
import type { FacilityKind } from '../src/game/defs'
import {
  CROSSOVER_A_KINDS, DOOR_MONSTERS, boughtItem, crossLeave, crossMinute, croonerSinging, doorPeek, lampFlicker, makerTarget, makerWalk,
} from '../src/game/crossover-a'
import { pokeFacility } from '../src/game/poke'
import { afterBuild, isOpen, newPerson, step } from '../src/game/sim'
import { newGame } from '../src/game/state'
import type { Facility, Game } from '../src/game/state'
import { stepStickers } from '../src/game/stickers'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'

const fail = (msg: string) => { console.error(`crossoveracheck FAILED: ${msg}`); process.exit(1) }

const last = CATEGORIES.at(-1)
if (last?.id !== 'crossover' || last.name !== 'Crossovers' || last.emoji !== '🔀') fail(`last tab is ${last?.id}`)

const CATALOG: Record<string, [number, number, number, number]> = {
  // cost, width, floors, stars
  doorHall: [250000, 24, 2, 2],
  karaoke: [150000, 16, 1, 1],
  mortimerShop: [100000, 12, 1, 1],
  lightsOutHall: [220000, 20, 2, 2],
  lampHall: [160000, 18, 1, 1],
  mathWorkshop: [180000, 20, 1, 1],
}
for (const k of CROSSOVER_A_KINDS) {
  const d = FACILITIES[k]
  const [cost, w, h, stars] = CATALOG[k]
  if (d.category !== 'crossover' || d.cost !== cost || d.width !== w || d.height !== h || d.stars !== stars)
    fail(`${k} catalog ${d.category} ${d.cost} ${d.width}x${d.height} ${d.stars}★`)
  if (!ATTRACTIONS.includes(k)) fail(`${k} is not an attraction, so nobody will visit`)
  if (!SPEND[k] || !SHOP_CAPACITY[k]) fail(`${k} has no spend or capacity`)
}

const X: Record<string, number> = { doorHall: 80, karaoke: 106, mortimerShop: 124, lightsOutHall: 138, lampHall: 160, mathWorkshop: 180 }

function tower(): { g: Game; rooms: Record<string, Facility> } {
  const g = newGame('sandbox', false)
  paintRun(g, 'lobby', 40, 70, 0)
  paintRun(g, 'floor', 71, 230, 0)
  paintRun(g, 'floor', 60, 199, 1)
  if (!placeFacility(g, 'stairs', 60, 0)) fail(`could not place stairs: ${checkFacility(g, 'stairs', 60, 0).reason}`)
  const rooms: Record<string, Facility> = {}
  for (const k of CROSSOVER_A_KINDS) {
    const f = placeFacility(g, k, X[k], 1)
    if (!f) fail(`could not place ${k}: ${checkFacility(g, k, X[k], 1).reason}`)
    rooms[k] = f!
  }
  afterBuild(g)
  for (const k of CROSSOVER_A_KINDS) if (!rooms[k].reachable) fail(`${k} is not reachable from the lobby`)
  return { g, rooms }
}

// Hours
const { g, rooms } = tower()
const openAt = (k: FacilityKind, h: number) => { g.time = 1440 + h * 60; return isOpen(g, rooms[k]) }
if (!openAt('doorHall', 10) || openAt('doorHall', 22) || openAt('doorHall', 9)) fail('Door Hall hours (10am–10pm)')
if (!openAt('mortimerShop', 10) || openAt('mortimerShop', 21)) fail('Mortimer keeps shop hours')
if (!openAt('lightsOutHall', 23.5) || !openAt('lightsOutHall', 0.5) || openAt('lightsOutHall', 9)) fail('Lights-Out Hall is a night room')
if (!openAt('mathWorkshop', 12) || openAt('mathWorkshop', 20)) fail('workshop hours')

// Door Hall: one door at a time, and every monster gets a turn in a day
const seen = new Set<string>()
let peeks = 0
for (let t = 0; t < 1440; t += 1) {
  g.time = 1440 + t
  const pk = doorPeek(g, rooms.doorHall)
  if (pk) {
    peeks++
    seen.add(pk.who)
    if (pk.door < 0 || pk.door >= 8) fail(`door ${pk.door}`)
  }
}
if (seen.size !== DOOR_MONSTERS.length) fail(`only saw ${[...seen].join(', ')}`)
if (peeks < 100 || peeks > 300) fail(`peek minutes ${peeks}`)
g.time = 1440 + 3 * 60
if (doorPeek(g, rooms.doorHall)) fail('a door opened at 3am')

// Crooner on the hour
g.time = 1440 + 20 * 60 + 5
if (!croonerSinging(g)) fail('Crooner silent at 8:05pm')
g.time = 1440 + 20 * 60 + 30
if (croonerSinging(g)) fail('Crooner singing at 8:30pm')

// Lamp Hall flickers about every 90 minutes
let flickers = 0
for (let t = 0; t < 1440; t++) { g.time = 1440 + t; if (lampFlicker(g, rooms.lampHall) === 0) flickers++ }
if (flickers < 14 || flickers > 18) fail(`flickers a day ${flickers}`)

// Mortimer's shoppers leave holding something
const shopper = newPerson(g, 'visitor', 0)
shopper.at = rooms.mortimerShop.id
crossLeave(g, shopper)
if (boughtItem(g, shopper) == null) fail('left Mortimer\'s empty-handed')
g.time += 61
if (boughtItem(g, shopper) != null) fail('still carrying it an hour later')
const other = newPerson(g, 'visitor', 0)
other.at = rooms.karaoke.id
crossLeave(g, other)
if (boughtItem(g, other) != null) fail('karaoke handed out shop stock')

// Math Maker: a free tile at noon, never on a built tile
const maker = tower()
const wf = maker.rooms.mathWorkshop
const target = makerTarget(maker.g, wf)
if (target !== wf.x + wf.width) fail(`target ${target}, wanted the bare tile at ${wf.x + wf.width}`)
maker.g.mode = 'classic'
maker.g.money = 50000
maker.g.time = 2 * 1440 + 12 * 60
crossMinute(maker.g, 12 * 60)
if (!makerWalk(maker.g, wf)) fail('no walk at noon')
maker.g.time += 8
crossMinute(maker.g, 12 * 60 + 8)
const row = maker.g.floors.get(wf.floor)!
if (row[target!] !== 0) fail('tile not painted')
if (maker.g.money !== 50000) fail(`painting cost money: ${maker.g.money}`)
if ((maker.g.counters['cross:tiles'] ?? 0) !== 1) fail('tile counter')
// built tiles all round: no room, no walk
for (let x = wf.x + wf.width; x < wf.x + wf.width + 8; x++) row[x] = 0
if (makerTarget(maker.g, wf) !== null) fail('found room next to a fully built floor')
const before = row.slice()
maker.g.time = 3 * 1440 + 12 * 60
crossMinute(maker.g, 12 * 60)
maker.g.time += 8
crossMinute(maker.g, 12 * 60 + 8)
if (row.some((v, i) => v !== before[i])) fail('painted over a built tile')

// Broke: the tile is free, so $100 in the bank still gets it
const broke = tower()
const bw = broke.rooms.mathWorkshop
broke.g.mode = 'classic'
broke.g.money = 100
broke.g.time = 2 * 1440 + 12 * 60
crossMinute(broke.g, 12 * 60)
broke.g.time += 8
crossMinute(broke.g, 12 * 60 + 8)
if (broke.g.floors.get(bw.floor)![bw.x + bw.width] !== 0 || broke.g.money !== 100) fail(`broke tower: tile ${broke.g.floors.get(bw.floor)![bw.x + bw.width]}, money ${broke.g.money}`)

// A reload after noon still gets today's tile (no walk in memory for this tower until 12:03), once
const late = tower()
const lw = late.rooms.mathWorkshop
late.g.time = 2 * 1440 + 12 * 60 + 3
crossMinute(late.g, 12 * 60 + 3)
if (!makerWalk(late.g, lw)) fail('no walk after a reload at 12:03')
late.g.time += 8
crossMinute(late.g, 12 * 60 + 11)
const lrow = late.g.floors.get(lw.floor)!
if (lrow[lw.x + lw.width] !== 0) fail('reload at 12:03 lost the tile')
late.g.time = 2 * 1440 + 12 * 60 + 5
crossMinute(late.g, 12 * 60 + 5)
late.g.time += 8
crossMinute(late.g, 12 * 60 + 13)
if ((late.g.counters['cross:tiles'] ?? 0) !== 1) fail(`tiles in a day ${late.g.counters['cross:tiles']}`)

// Basement workshop: the free tile never rolls (and then eats) the gold strike
const deep = newGame('classic', false)
deep.money = 5_000_000
paintRun(deep, 'lobby', 40, 70, 0)
paintRun(deep, 'floor', 71, 140, 0)
paintRun(deep, 'floor', 60, 120, -1)
const dw = placeFacility(deep, 'mathWorkshop', 80, -1)
if (!dw) fail(`could not place a basement workshop: ${checkFacility(deep, 'mathWorkshop', 80, -1).reason}`)
dw!.reachable = true
deep.flags.goldFound = false // building the fixture can strike gold for real; start clean
const rnd = Math.random
Math.random = () => 0
const dm = deep.money
deep.time = 2 * 1440 + 12 * 60
crossMinute(deep, 12 * 60)
deep.time += 8
crossMinute(deep, 12 * 60 + 8)
Math.random = rnd
if (deep.floors.get(-1)![dw!.x + dw!.width] !== 0) fail('basement tile not painted')
if (deep.flags.goldFound || deep.money !== dm) fail(`basement paint touched gold: found ${deep.flags.goldFound}, money ${deep.money - dm}`)

// Pokes
for (const k of CROSSOVER_A_KINDS) {
  const f = rooms[k]
  const fxBefore = g.fx.length
  const sfx = pokeFacility(g, f, 10000 + CROSSOVER_A_KINDS.indexOf(k) * 1000, f.x + 2, f.floor)
  if (!sfx || g.fx.length === fxBefore) fail(`${k} poke did nothing`)
}

// Stickers
stepStickers(g)
for (const id of ['cross-door-codes', 'cross-midnight-hotel', 'cross-night-shift', 'cross-math-maker'])
  if (!g.stickers.includes(id)) fail(`sticker ${id}`)

// Visitors over two days. Pin fires so a random one can't burn a room mid-check.
const visit = tower()
visit.g.time = 6 * 60
for (let i = 0; i < 2 * 1440 * 10; i++) {
  for (const f of Object.values(visit.rooms)) f.fire = 0
  step(visit.g)
}
const out: string[] = []
for (const k of CROSSOVER_A_KINDS) {
  const n = visit.rooms[k].customersYesterday
  out.push(`${k} ${n}`)
  if (n <= 0) fail(`${k} had no visitors yesterday`)
}
console.log(`crossoveracheck ok: ${out.join(', ')}`)
