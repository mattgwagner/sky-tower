// Headless: big mixed tower, run N days, report hotel/VIP/commerce health.
import { newGame } from '../src/game/state'
import { step, afterBuild } from '../src/game/sim'
import { addCar, paintRun, placeFacility, placeShaft } from '../src/game/world'
import type { FacilityKind } from '../src/game/defs'

const days = Number(process.argv[2] ?? 6)
const g = newGame('family', true)
g.mode = 'sandbox'
paintRun(g, 'lobby', 40, 199, 0)
const e1 = placeShaft(g, 'elevator', 100, -3, 14)!; addCar(g, e1); addCar(g, e1); addCar(g, e1)
const e2 = placeShaft(g, 'elevator', 140, 0, 14)!; addCar(g, e2); addCar(g, e2)
placeShaft(g, 'serviceElevator', 60, 0, 14)
for (let f = 1; f <= 14; f++) paintRun(g, 'floor', 40, 199, f)
const fill = (f: number, kind: FacilityKind, w: number, x0 = 40, x1 = 199) => { for (let x = x0; x + w <= x1 + 1;) { const ok = placeFacility(g, kind, x, f); x += ok ? w : 1 } }
fill(1, 'fastFood', 16, 40, 99); fill(1, 'shop', 12, 144, 199); fill(1, 'restaurant', 24, 64, 99)
for (let f = 2; f <= 5; f++) fill(f, 'office', 9)
for (let f = 6; f <= 8; f++) fill(f, 'condo', 16)
placeFacility(g, 'cinema', 150, 9); placeFacility(g, 'partyHall', 40, 9)
for (let f = 11; f <= 13; f++) { fill(f, 'hotelSingle', 4, 40, 99); fill(f, 'hotelTwin', 6, 104, 139); fill(f, 'hotelSuite', 10, 144, 199) }
placeFacility(g, 'housekeeping', 64, 14); placeFacility(g, 'housekeeping', 104, 14); placeFacility(g, 'security', 150, 14); placeFacility(g, 'medical', 170, 14)
g.mode = 'family'
g.stars = 3
afterBuild(g)
const t0 = performance.now()
for (let d = 0; d < days; d++) {
  const counts = { booked: 0, dirty: 0, roach: 0, rooms: 0 }
  let peak = 0
  for (let i = 0; i < 14400; i++) {
    step(g)
    if (i % 600 === 0) peak = Math.max(peak, g.people.size)
    if (i === 14400 - 1200) for (const f of g.facilities.values()) if (f.kind.startsWith('hotel')) { counts.rooms++; if (f.booked) counts.booked++; if (f.dirty) counts.dirty++; if (f.roaches) counts.roach++ }
  }
  const com = [...g.facilities.values()].filter(f => ['fastFood', 'restaurant', 'shop', 'cinema', 'partyHall'].includes(f.kind)).map(f => `${f.kind}:${f.customersYesterday}`).join(' ')
  console.log(`day ${d} money=${g.money} pop=${g.pop} stars=${g.stars} peakPeople=${peak} hotel(at 22:00)=${JSON.stringify(counts)}`)
  console.log('   ', com)
}
console.log(`${days} days in ${(performance.now() - t0).toFixed(0)}ms`)
console.log(g.log.filter(m => /VIP|roach|FIRE|bomb|Tenants/.test(m.text)).map(m => m.text).slice(-10).join('\n'))
const occ = [...g.facilities.values()].filter(f => f.kind === 'office' || f.kind === 'condo' || f.kind.startsWith('hotel'))
console.log('avg happiness', Math.round(occ.reduce((a, f) => a + f.happiness, 0) / occ.length), [...new Set(occ.flatMap(f => f.complaints))])
