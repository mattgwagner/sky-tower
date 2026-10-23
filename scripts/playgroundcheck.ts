// Headless check: the Sky Playground gets visitors, shuts in the rain, and cheers up the floor below.
import { newGame } from '../src/game/state'
import { FACILITIES } from '../src/game/defs'
import { afterBuild, isOpen, step } from '../src/game/sim'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'
import { weatherFor } from '../src/render/sky-fx'
import { dayHash, snowsOn } from '../src/game/holidays'
import { playgroundKids, playgroundPerHour, playgroundSwing } from '../src/game/playground'

const fail = (msg: string) => { console.error(`playgroundcheck FAILED: ${msg}`); process.exit(1) }

if (playgroundSwing(0) === playgroundSwing(500)) fail('swing angle did not change')
if (playgroundKids(0) !== 0 || playgroundKids(1) < 1 || playgroundKids(20) !== 6) fail(`kid scale ${playgroundKids(0)} ${playgroundKids(1)} ${playgroundKids(20)}`)

const def = FACILITIES.playground
if (def.category !== 'fun' || def.stars !== 1 || def.cost !== 80000 || def.width !== 20 || def.height !== 1 || def.underground !== 'no')
  fail(`catalog ${JSON.stringify(def)}`)

const g = newGame('sandbox', false)
paintRun(g, 'lobby', 40, 67, 0)
paintRun(g, 'floor', 68, 150, 0)
paintRun(g, 'floor', 50, 150, 1)
const stairs = placeFacility(g, 'stairs', 60, 0)
if (!stairs) fail('could not place stairs')
const play = placeFacility(g, 'playground', 80, 1)
if (!play) fail(`could not place playground: ${checkFacility(g, 'playground', 80, 1).reason}`)
const under = placeFacility(g, 'condo', 82, 0)
const away = placeFacility(g, 'condo', 120, 0)
if (!under || !away) fail('could not place condos')
const blocked = checkFacility(g, 'floor', 80, 2, 4)
if (blocked.ok || !blocked.reason?.includes('Sky Playground')) fail(`floor over the playground: ${blocked.reason}`)

afterBuild(g)
if (!play.reachable) fail('playground is not reachable from the lobby')
if (!under.nearPark) fail('condo under the playground was not happier')
if (away.nearPark) fail('condo off to the side got the playground bonus')
if (under.happiness <= away.happiness) fail(`happiness under ${under.happiness} vs away ${away.happiness}`)

const findDay = (pred: (d: number) => boolean) => {
  for (let d = 0; d < 90; d++) if (pred(d)) return d
  return -1
}
const rainy = findDay((d) => !snowsOn(d) && dayHash(d) < 18)
const sunnyWeekend = findDay((d) => d % 3 === 2 && !snowsOn(d) && dayHash(d) >= 18)
const weekday = findDay((d) => d % 3 !== 2 && !snowsOn(d) && dayHash(d) >= 18)
if (rainy < 0 || sunnyWeekend < 0 || weekday < 0) fail('could not find weather days')

g.time = rainy * 1440 + 14 * 60
if (!weatherFor(g).rain) fail('expected rain at 2pm')
if (playgroundPerHour(g) !== 0) fail(`rain perHour ${playgroundPerHour(g)}`)
if (isOpen(g, play)) fail('playground stayed open in the rain')

g.time = sunnyWeekend * 1440 + 14 * 60
if (weatherFor(g).rain || weatherFor(g).snow) fail('expected a sunny weekend')
if (playgroundPerHour(g) !== 14) fail(`weekend afternoon perHour ${playgroundPerHour(g)}`)
if (!isOpen(g, play)) fail('playground closed on a sunny afternoon')

g.time = weekday * 1440 + 10 * 60
if (playgroundPerHour(g) !== 5) fail(`weekday perHour ${playgroundPerHour(g)}`)

g.time = sunnyWeekend * 1440 + 23 * 60
if (isOpen(g, play)) fail('playground open at night')

g.time = 6 * 60
let saw = 0
for (let i = 0; i < 2 * 1440 * 10; i++) {
  step(g)
  saw = Math.max(saw, play.customersToday, play.customersYesterday)
}
if (play.customersYesterday <= 0 && play.customersToday <= 0) fail('nobody visited in two days')
console.log(`playgroundcheck ok: visitors seen ${saw}, yesterday ${play.customersYesterday}`)
