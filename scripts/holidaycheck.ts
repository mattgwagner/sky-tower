// Headless: walk a mixed tower through a year of holidays and count trick-or-treaters, party guests and spooky customers.
import { newGame } from '../src/game/state'
import { step, afterBuild } from '../src/game/sim'
import { paintRun, placeFacility, placeShaft, addCar } from '../src/game/world'
import type { FacilityKind } from '../src/game/defs'
import { holidayFor, isTreater, treaterCount } from '../src/game/holidays'

const g = newGame('family', false)
g.mode = 'sandbox'
paintRun(g, 'lobby', 40, 199, 0)
const e1 = placeShaft(g, 'elevator', 100, 0, 10)!; addCar(g, e1); addCar(g, e1)
for (let f = 1; f <= 10; f++) paintRun(g, 'floor', 40, 199, f)
const fill = (f: number, kind: FacilityKind, w: number, x0 = 40, x1 = 199) => { for (let x = x0; x + w <= x1 + 1;) { const ok = placeFacility(g, kind, x, f); x += ok ? w : 1 } }
for (let f = 2; f <= 4; f++) fill(f, 'office', 9)
for (let f = 5; f <= 8; f++) fill(f, 'condo', 16)
placeFacility(g, 'partyHall', 40, 9); placeFacility(g, 'candy', 150, 1); placeFacility(g, 'hauntedHouse', 104, 9)
g.mode = 'family'; g.stars = 3
afterBuild(g)
const days = 13
for (let d = 0; d < days; d++) {
  let peak = 0, late = 0
  for (let i = 0; i < 14400; i++) {
    step(g)
    if (i % 100 === 0) {
      let n = 0
      for (const p of g.people.values()) if (isTreater(p)) n++
      peak = Math.max(peak, n)
      const m = g.time % 1440
      if (m >= 22 * 60 + 1 && n) late = Math.max(late, n)
    }
  }
  const h = holidayFor(g, d)
  const facs = [...g.facilities.values()]
  const by = (k: string) => facs.filter((f) => f.kind === k).reduce((a, f) => a + f.customersYesterday, 0)
  console.log(`day ${d} ${h?.name ?? '-'} pop=${g.pop} cap=${treaterCount(g.pop)} treatersPeak=${peak} after10pm=${late} candy=${by('candy')} haunted=${by('hauntedHouse')} party=${by('partyHall')}`)
}
console.log(g.log.filter((m) => /Spooky|SNOW|Heart|birthday|NEW YEAR/.test(m.text)).map((m) => `${Math.floor(m.t / 1440)}: ${m.text}`).join('\n'))
