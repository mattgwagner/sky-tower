// Headless check: crossover rooms get visitors, the precinct is not Security,
// and the Midnight Express runs once at midnight and leaves a crate.
import { newGame } from '../src/game/state'
import { CATEGORIES, FACILITIES, isCommercial } from '../src/game/defs'
import { afterBuild, isOpen, starProgress, step } from '../src/game/sim'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'
import { isPokable } from '../src/game/poke'
import { stepStickers } from '../src/game/stickers'
import {
  DEPOT_RUN, clankyPerHour, depotPerHour, depotRun, depotStatus, mumblesLayout, mumblesNow, precinctPerHour, readingPerHour,
} from '../src/game/crossover'

const fail = (msg: string): never => { console.error(`crossovercheck FAILED: ${msg}`); process.exit(1) }

const tab = CATEGORIES[CATEGORIES.length - 1]
if (tab.id !== 'crossover' || tab.name !== 'Crossovers' || tab.emoji !== '🔀' || tab.blurb !== 'Rooms from your other games. Same characters, now in your tower.')
  fail(`tab ${JSON.stringify(tab)}`)

const depot = FACILITIES.ghostDepot
if (depot.category !== 'crossover' || depot.stars !== 2 || depot.cost !== 400000 || depot.width !== 30 || depot.height !== 2 || depot.underground !== 'no')
  fail(`depot catalog ${JSON.stringify(depot)}`)
const precinct = FACILITIES.precinct
if (precinct.category !== 'crossover' || precinct.stars !== 1 || precinct.cost !== 120000 || precinct.width !== 16 || precinct.height !== 1)
  fail(`precinct catalog ${JSON.stringify(precinct)}`)
const kitchen = FACILITIES.clanky
if (kitchen.category !== 'crossover' || kitchen.stars !== 1 || kitchen.cost !== 140000 || kitchen.width !== 14 || kitchen.height !== 1 || !isCommercial('clanky'))
  fail(`kitchen catalog ${JSON.stringify(kitchen)}`)
const reading = FACILITIES.readingRoom
if (reading.category !== 'crossover' || reading.stars !== 1 || reading.cost !== 200000 || reading.width !== 22 || reading.height !== 2 || !isCommercial('readingRoom'))
  fail(`reading catalog ${JSON.stringify(reading)}`)
if (!isCommercial('ghostDepot') || !isCommercial('precinct')) fail('a crossover room is not commercial')
for (const k of ['ghostDepot', 'precinct', 'clanky', 'readingRoom'] as const) if (!isPokable(k)) fail(`no poke for ${k}`)

const lay0 = mumblesLayout(0)
const lay1 = mumblesLayout(1)
if (lay0.chairs.join() === lay1.chairs.join() && lay0.lamp === lay1.lamp) fail('Mumbles put the furniture back where it was')
const night = mumblesNow(1 * 1440 + 3 * 60)
const morning = mumblesNow(1 * 1440 + 6 * 60)
if (night.chairs[0] === morning.chairs[0]) fail('furniture did not move overnight')
if (!night.moving || morning.moving) fail(`moving flags night ${night.moving} morning ${morning.moving}`)

if (depotRun(10 * 60).crate !== null || depotRun(10 * 60).running) fail('a crate before the first midnight')
const mid = depotRun(1 * 1440 + DEPOT_RUN / 2)
if (!mid.running || Math.abs(mid.progress - 0.5) > 0.01 || mid.crate) fail(`mid-run ${JSON.stringify(mid)}`)
const after = depotRun(1 * 1440 + 10)
if (after.running || after.crate !== 'cage') fail(`crate ${JSON.stringify(after)}`)
const next = depotRun(2 * 1440 + 10)
if (next.crate !== 'candy') fail(`next crate ${next.crate}`)
if (depotPerHour(22 * 60) <= depotPerHour(19 * 60)) fail('the depot is not busiest late')
if (depotPerHour(12 * 60) !== 0 || precinctPerHour() <= 0 || readingPerHour(false) <= 0) fail('perHour')
if (clankyPerHour(12 * 60) <= 0 || clankyPerHour(18 * 60) <= 0 || clankyPerHour(15 * 60) !== 0) fail('kitchen hours')
if (!depotStatus(1 * 1440 + 0.4).includes('Midnight Express')) fail('status during the run')

const g = newGame('sandbox', false)
paintRun(g, 'lobby', 20, 220, 0)
paintRun(g, 'floor', 20, 220, 1)
paintRun(g, 'floor', 20, 220, 2)
if (!placeFacility(g, 'stairs', 24, 0)) fail('could not place stairs')
const deep = checkFacility(g, 'ghostDepot', 50, -2)
if (deep.ok || deep.reason !== 'Above ground only') fail(`basement depot: ${deep.reason}`)
const train = placeFacility(g, 'ghostDepot', 50, 1)
const desk = placeFacility(g, 'precinct', 90, 1)
const cook = placeFacility(g, 'clanky', 112, 1)
const books = placeFacility(g, 'readingRoom', 140, 1)
if (!train || !desk || !cook || !books) {
  fail(`place ${checkFacility(g, 'ghostDepot', 50, 1).reason} / ${checkFacility(g, 'precinct', 90, 1).reason} / ${checkFacility(g, 'clanky', 112, 1).reason} / ${checkFacility(g, 'readingRoom', 140, 1).reason}`)
}
afterBuild(g)
for (const f of [train, desk, cook, books]) if (!f.reachable) fail(`${f.kind} is not reachable`)

g.stars = 2
const prog = starProgress(g)
const sec = prog?.needs.find((n) => n.id === 'security')
if (!sec || sec.done) fail('precinct counted toward the Security office')

g.time = 1440 + 0.4
if (!isOpen(g, train) || !depotRun(g.time).running) fail('depot closed while the express is in the room')
g.time = 17 * 60
let sawTrain = false
const seen = { ghostDepot: 0, precinct: 0, clanky: 0, readingRoom: 0 }
for (let i = 0; i < 3 * 1440 * 10; i++) {
  for (const f of [train, desk, cook, books]) f.fire = 0
  const before = Math.floor(g.time)
  step(g)
  const m = g.time - Math.floor(g.time / 1440) * 1440
  if (before % 1440 > 1400 && m < DEPOT_RUN && g.log.some((l) => l.text.includes('Midnight Express'))) sawTrain = true
  seen.ghostDepot = Math.max(seen.ghostDepot, train.customersToday, train.customersYesterday)
  seen.precinct = Math.max(seen.precinct, desk.customersToday, desk.customersYesterday)
  seen.clanky = Math.max(seen.clanky, cook.customersToday, cook.customersYesterday)
  seen.readingRoom = Math.max(seen.readingRoom, books.customersToday, books.customersYesterday)
}
if (!sawTrain) fail('the Midnight Express never made the news')
for (const [k, n] of Object.entries(seen)) if (n <= 0) fail(`nobody visited ${k}`)

stepStickers(g)
for (const id of ['crossover-midnight-line', 'crossover-comic-cop', 'crossover-creakwood']) {
  if (!g.stickers.includes(id)) fail(`missing sticker ${id}`)
}
console.log(`crossovercheck ok: visitors ${JSON.stringify(seen)}, train logged`)
