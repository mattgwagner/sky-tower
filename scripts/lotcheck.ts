// Headless check: the 360-wide lot. A 240-wide (version 1) save loads centred and keeps working,
// the lot edges, floor 150 and B15 take rooms, and the Cathedral still earns TOWER at floor 100.
// fixtures/v1-save.json.gz was made by fixtures/genv1.ts on the pre-widening code (db5886a).
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { CATHEDRAL_TOP, MAX_FLOOR, MIN_FLOOR, TOWER_WIDTH } from '../src/game/defs'
import { cell, deserialize, newGame } from '../src/game/state'
import type { Facility, Game, Person } from '../src/game/state'
import { afterBuild, starProgress, step } from '../src/game/sim'
import { allStickers } from '../src/game/stickers'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'

const fail = (msg: string) => { console.error(`lotcheck FAILED: ${msg}`); process.exit(1) }
const DX = 60

// ---- old save ----
const json = gunzipSync(readFileSync(new URL('./fixtures/v1-save.json.gz', import.meta.url))).toString()
const old = JSON.parse(json) as {
  version: number
  floors: [number, number[]][]
  facilities: Facility[]
  shafts: { id: number; x: number }[]
  people: Person[]
  log: { id: number; x?: number }[]
  bomb: { x: number } | null
  flags: Game['flags']
}
if (old.version !== 1 || old.floors[0][1].length !== 240) fail('fixture is not a 240-wide version 1 save')
const g = deserialize(json)
if (g.version !== 2) fail(`loaded as version ${g.version}`)

for (const [f, r] of old.floors) {
  const nr = g.floors.get(f)!
  if (nr.length !== TOWER_WIDTH) fail(`floor ${f} is ${nr.length} wide`)
  for (let i = 0; i < TOWER_WIDTH; i++) {
    const want = i >= DX && i < DX + r.length ? r[i - DX] : -1
    if (nr[i] !== want) fail(`floor ${f} tile ${i} is ${nr[i]}, want ${want}`)
  }
}
for (const o of old.facilities) {
  const f = g.facilities.get(o.id)!
  if (f.x !== o.x + DX) fail(`${f.kind} ${f.id} at x=${f.x}, want ${o.x + DX}`)
  if (cell(g, f.floor, f.x) !== f.id || cell(g, f.floor + f.height - 1, f.x + f.width - 1) !== f.id) fail(`${f.kind} ${f.id} footprint moved off its tiles`)
}
for (const o of old.shafts) if (g.shafts.get(o.id)!.x !== o.x + DX) fail(`shaft ${o.id} not shifted`)
for (const o of old.people) {
  const p = g.people.get(o.id)!
  if (p.x !== o.x + DX || p.goalX !== o.goalX + DX) fail(`person ${p.id} not shifted`)
  if (p.legs.some((l, i) => l.x !== o.legs[i].x + DX)) fail(`person ${p.id} trip legs not shifted`)
}
const fl = g.flags, ofl = old.flags
if (fl.huggy!.x !== ofl.huggy!.x + DX) fail('Huggy not shifted')
if (fl.monkey!.x !== ofl.monkey!.x + DX || fl.peels![0].x !== ofl.peels![0].x + DX) fail('monkey or peel not shifted')
if (fl.entity!.a !== ofl.entity!.a + DX || fl.entity!.b !== ofl.entity!.b + DX) fail('entity not shifted')
if (g.bomb!.x !== old.bomb!.x + DX) fail('bomb not shifted')
const marker = g.log.find((m) => m.id === 999999)
if (marker?.x !== 77 + DX) fail('log jump-to x not shifted')
const huggyOn = cell(g, fl.huggy!.floor, Math.floor(fl.huggy!.x))
if (huggyOn <= 0) fail('Huggy is hiding on an empty tile')
const moving = old.people.filter((p) => p.state === 'riding' || p.state === 'walking' || p.state === 'waiting').length
if (moving < 20) fail(`fixture only has ${moving} people mid-trip`)

// the save's bomb would blow rooms away mid-check
g.bomb = null
afterBuild(g)
for (const o of old.facilities) if (o.reachable && !g.facilities.get(o.id)!.reachable) fail(`${o.kind} ${o.id} no longer reachable`)

// one day, with random fires pinned out
const seen = new Map<number, { key: string; since: number }>()
let stuck = ''
const end = g.time + 1440
while (g.time < end) {
  step(g)
  for (const f of g.facilities.values()) f.fire = 0
  for (const p of g.people.values()) {
    if (p.state === 'off' || p.state === 'inside') { seen.delete(p.id); continue }
    if (p.state === 'walking' && cell(g, p.floor, Math.floor(p.x)) === -1) fail(`person ${p.id} walking on thin air at ${p.floor}/${p.x}`)
    const key = `${p.state}|${p.floor}|${p.x.toFixed(2)}`
    const s = seen.get(p.id)
    if (!s || s.key !== key) seen.set(p.id, { key, since: g.time })
    else if (g.time - s.since > 240) stuck ||= `person ${p.id} (${p.kind}) stuck ${p.state} on ${p.floor} at x=${p.x.toFixed(1)}`
  }
}
if (stuck) fail(stuck)
for (const f of g.facilities.values()) if (f.kind !== 'lobby' && !f.reachable) fail(`${f.kind} ${f.id} unreachable after a day`)
const food = [...g.facilities.values()].filter((f) => f.kind === 'fastFood' || f.kind === 'restaurant')
if (!food.some((f) => f.customersYesterday > 0)) fail('no customers at the food court after a day')
const offices = [...g.facilities.values()].filter((f) => f.kind === 'office')
if (!offices.every((f) => f.occupied)) fail('offices emptied out after loading')

// ---- the new lot's corners ----
const n = newGame('sandbox', false)
paintRun(n, 'lobby', 0, TOWER_WIDTH - 1, 0)
for (let f = 1; f <= MAX_FLOOR; f++) paintRun(n, 'floor', 0, TOWER_WIDTH - 1, f)
for (let f = -1; f >= MIN_FLOOR; f--) paintRun(n, 'floor', 0, TOWER_WIDTH - 1, f)
const put = (kind: Parameters<typeof placeFacility>[1], x: number, floor: number) => {
  const r = placeFacility(n, kind, x, floor)
  if (!r) fail(`could not place ${kind} at x=${x} floor ${floor}: ${checkFacility(n, kind, x, floor).reason}`)
  return r!
}
put('office', 0, MAX_FLOOR)
put('office', TOWER_WIDTH - 9, MAX_FLOOR) // offices are 9 wide: its last tile is 359
put('parking', 0, MIN_FLOOR)
put('parking', TOWER_WIDTH - 8, MIN_FLOOR)
if (cell(n, MAX_FLOOR, TOWER_WIDTH - 1) <= 0 || cell(n, MIN_FLOOR, TOWER_WIDTH - 1) <= 0) fail('tile 359 not built on')
if (checkFacility(n, 'office', TOWER_WIDTH - 8, MAX_FLOOR).ok) fail('a room hanging off the lot was allowed')
if (checkFacility(n, 'office', 20, MAX_FLOOR + 1).ok) fail(`a room above floor ${MAX_FLOOR} was allowed`)
if (checkFacility(n, 'parking', 20, MIN_FLOOR - 1).ok) fail(`parking below B${-MIN_FLOOR} was allowed`)

if (checkFacility(n, 'cathedral', 100, MAX_FLOOR - 4).ok) fail(`a cathedral topping out at ${MAX_FLOOR} was allowed`)
const cath = put('cathedral', 100, CATHEDRAL_TOP - 4)
if (cath.floor + cath.height - 1 !== CATHEDRAL_TOP) fail('cathedral top is not floor 100')
put('office', 100, CATHEDRAL_TOP + 1) // rooms can stack on a cathedral
n.stars = 5
const need = starProgress(n)?.needs.find((x) => x.id === 'cathedral')
if (!need?.done) fail('the cathedral at floor 100 does not count toward TOWER')
const snap = { watchingSky: false }
const sticker = (id: string) => allStickers().find((s) => s.id === id)!
if (!sticker('cathedral').check(n, snap)) fail('cathedral sticker not earned at floor 100')
if (!sticker('space-elevator').check(n, snap)) fail('Space Elevator not earned at floor 150')
if (!sticker('deep').check(n, snap)) fail(`Mole People not earned at B${-MIN_FLOOR}`)

console.log(`lotcheck ok: old save centred (${old.facilities.length} rooms, ${moving} people mid-trip), corners, floor ${MAX_FLOOR}, B${-MIN_FLOOR}, cathedral at ${CATHEDRAL_TOP}`)
