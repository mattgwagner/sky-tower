// Headless check: a starter tower whose only elevator is a Party Elevator still gets people around all day.
import { newGame } from '../src/game/state'
import { buildStarter } from '../src/game/starter'
import { afterBuild, step } from '../src/game/sim'
import { addCar, demolish, placeShaft } from '../src/game/world'

const fail = (msg: string) => { console.error(`partycheck FAILED: ${msg}`); process.exit(1) }

const g = newGame('sandbox', false)
buildStarter(g)
for (const s of [...g.shafts.values()]) demolish(g, s.id, () => {})
const party = placeShaft(g, 'partyElevator', 116, 0, 8)
if (!party) fail('could not place a party elevator')
addCar(g, party!)
afterBuild(g)
if (g.shafts.size !== 1) fail(`expected only the party elevator, found ${g.shafts.size} shafts`)

const seen = new Set<number>()
let inCar = new Set<number>()
let trips = 0
for (let i = 0; i < 1440 * 10; i++) {
  step(g)
  const now = new Set(party!.cars.flatMap((c) => c.riders))
  for (const id of inCar) if (!now.has(id)) trips++
  for (const id of now) seen.add(id)
  inCar = now
}
const stranded = [...g.facilities.values()].filter((f) => (f.kind === 'office' || f.kind === 'condo') && f.floor > 0 && !f.reachable).length
if (stranded) fail(`${stranded} rooms unreachable with only the party elevator`)
if (trips < 50) fail(`only ${trips} trips finished in a day`)
console.log(`partycheck ok: ${trips} trips by ${seen.size} people in one day`)
