// Makes v1-save.json.gz for lotcheck. Run it on a pre-widening checkout (240-wide lot):
//   npx tsx scripts/fixtures/genv1.ts | gzip -9 > scripts/fixtures/v1-save.json.gz
import { newGame, serialize } from '../../src/game/state'
import { afterBuild, startEntity, step } from '../../src/game/sim'
import { addCar, paintRun, placeFacility, placeShaft } from '../../src/game/world'
import type { FacilityKind } from '../../src/game/defs'

const g = newGame('family', false, 'Old Lot')
g.mode = 'sandbox'
paintRun(g, 'lobby', 0, 239, 0)
for (let f = -1; f >= -3; f--) paintRun(g, 'floor', 20, 219, f)
const e1 = placeShaft(g, 'elevator', 100, -3, 10)!; addCar(g, e1); addCar(g, e1)
const e2 = placeShaft(g, 'elevator', 180, 0, 10)!; addCar(g, e2)
placeShaft(g, 'serviceElevator', 60, 0, 10)
for (let f = 1; f <= 10; f++) paintRun(g, 'floor', f <= 2 ? 0 : 20, f <= 2 ? 239 : 219, f)
const fill = (f: number, kind: FacilityKind, w: number, x0: number, x1: number) => { for (let x = x0; x + w <= x1 + 1;) { const ok = placeFacility(g, kind, x, f); x += ok ? w : 1 } }
fill(-1, 'parking', 8, 20, 99); fill(-2, 'parking', 8, 104, 179)
fill(1, 'fastFood', 16, 0, 59); fill(1, 'shop', 12, 64, 99); fill(1, 'restaurant', 24, 184, 239)
placeFacility(g, 'stairs', 110, 1)
for (let f = 2; f <= 5; f++) fill(f, 'office', 9, f === 2 ? 0 : 20, f === 2 ? 239 : 219)
for (let f = 6; f <= 7; f++) fill(f, 'condo', 16, 20, 219)
for (let f = 8; f <= 9; f++) { fill(f, 'hotelSingle', 4, 20, 99); fill(f, 'hotelTwin', 6, 104, 179) }
placeFacility(g, 'housekeeping', 64, 10); placeFacility(g, 'security', 120, 10)
g.mode = 'family'
g.stars = 3
afterBuild(g)
// to 8:20am on day 2, when the morning rush is in the elevators
while (g.time < 1440 + 8 * 60 + 20) step(g)
const rooms = [...g.facilities.values()].filter((f) => f.kind === 'office')
const r = rooms[3], m = rooms[11]
g.flags.huggy = { floor: r.floor + r.height - 1, x: r.x + 2.5 }
g.flags.monkey = { floor: m.floor + m.height - 1, x: m.x + 3, since: g.time }
g.flags.peels = [{ floor: m.floor, x: m.x + 1, day: 1 }]
startEntity(g, 'seek')
g.bomb = { floor: 4, x: 150, deadline: g.time + 300, searched: [], decided: false, ransom: 1, defused: false }
g.log.push({ id: 999999, t: g.time, text: 'marker', kind: 'info', floor: 3, x: 77 })
const states: Record<string, number> = {}
for (const p of g.people.values()) states[p.state] = (states[p.state] ?? 0) + 1
console.error('states', JSON.stringify(states), 'facilities', g.facilities.size, 'row', g.floors.get(0)!.length)
process.stdout.write(serialize(g))
