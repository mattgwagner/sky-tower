// Headless check: a 4-floor Mega Slide in a sandbox starter tower gets riders, and only goes down.
import { newGame } from '../src/game/state'
import { buildStarter } from '../src/game/starter'
import { step } from '../src/game/sim'
import { findRoute } from '../src/game/routing'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'

const fail = (msg: string) => { console.error(`slidecheck FAILED: ${msg}`); process.exit(1) }

const g = newGame('sandbox', false)
buildStarter(g)
// a strip on the east side for the slide: lobby under it, floors 1-4 over it
paintRun(g, 'lobby', 170, 177, 0)
for (let f = 1; f <= 4; f++) paintRun(g, 'floor', 165, 177, f)

if (checkFacility(g, 'megaSlide', 168, 0, undefined, 1).ok) fail('a 1-floor slide was allowed')
if (checkFacility(g, 'megaSlide', 168, 0, undefined, 6).ok) fail('a 6-floor slide was allowed')
const slide = placeFacility(g, 'megaSlide', 168, 0, undefined, 4)
if (!slide || slide.height !== 4) fail('could not place a 4-floor slide')

const down = findRoute(g, 4, 171, 0, 175)
if (!down || down.length !== 1 || down[0].via !== slide!.id || down[0].from !== 4 || down[0].to !== 0)
  fail(`expected one slide leg from 4 to 0, got ${JSON.stringify(down)}`)
const up = findRoute(g, 0, 175, 4, 171)
if (up?.some((l) => l.via === slide!.id)) fail('someone climbed up the slide')

let rides = 0
for (let i = 0; i < 2 * 1440 * 10; i++) {
  const before = slide!.rides ?? 0
  step(g)
  rides += Math.max(0, (slide!.rides ?? 0) - before)
}
if (rides === 0) fail('nobody rode the slide in two days')
console.log(`slidecheck ok: ${rides} rides in two days`)
