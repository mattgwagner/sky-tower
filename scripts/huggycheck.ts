// Headless: Huggy's pity night. A tower with a toy factory and lots of other surprises must let Huggy
// out at least once in every 7 nights over 8 weeks, and a save from before huggyLastOut still draws.
import { step, afterBuild } from '../src/game/sim'
import { dayOf, newGame } from '../src/game/state'
import { drawSurprise } from '../src/game/surprises'
import { addCar, paintRun, placeFacility, placeShaft } from '../src/game/world'

const DAYS = 56
const RUNS = Number(process.env.RUNS ?? 8)
const TOP = 21

const fail = (msg: string) => { console.error(`huggycheck FAILED: ${msg}`); process.exit(1) }

function tower(seed: number) {
  const g = newGame('family', false)
  g.mode = 'sandbox'
  paintRun(g, 'lobby', 60, 179, 0)
  const e = placeShaft(g, 'elevator', 100, 0, TOP)!
  addCar(g, e); addCar(g, e)
  for (let f = 1; f <= TOP; f++) paintRun(g, 'floor', 60, 179, f)
  const must = (kind: Parameters<typeof placeFacility>[1], x: number, f: number) => {
    if (!placeFacility(g, kind, x, f)) fail(`could not place ${kind} at ${x},${f}`)
  }
  must('toyFactory', 110, 1)
  must('zoo', 110, 3)
  for (const x of [60, 64, 68]) must('hotelSingle', x, 5)
  must('hotelSuite', 110, 5)
  must('housekeeping', 60, 6)
  must('concertHall', 110, 7)
  must('rocketPad', 110, TOP + 1)
  must('disco', 148, 8)
  g.mode = 'family'
  g.stars = 3
  g.flags.seed = seed
  afterBuild(g)
  return g
}

// An old save has no huggyLastOut: the next draw owes him a night instead of throwing or never firing.
{
  const g = tower(1)
  delete g.flags.huggyLastOut
  if (drawSurprise(g, 5) !== 'huggy') fail('a save without huggyLastOut did not get Huggy at the next draw')
}

for (let run = 0; run < RUNS; run++) {
  const seed = 5000 + run * 7919
  const g = tower(seed)
  const out = new Set<number>()
  for (let i = 0; i < DAYS * 14400; i++) {
    step(g)
    // pin random fires: a burned factory isn't reachable and can't let Huggy out
    for (const f of g.facilities.values()) f.fire = 0
    if (g.flags.huggy) out.add(dayOf(g.time) - (g.time % 1440 < 6 * 60 ? 1 : 0))
  }
  // full nights 1..DAYS-1: every 7 in a row has Huggy out on at least one
  for (let d = 1; d + 6 < DAYS; d++) {
    if (![0, 1, 2, 3, 4, 5, 6].some((k) => out.has(d + k))) fail(`seed ${seed}: no Huggy on nights ${d}..${d + 6} (out on ${[...out].sort((a, b) => a - b).join(',')})`)
  }
  console.log(`seed ${seed}: Huggy out ${out.size} nights in ${DAYS}`)
}
console.log('huggycheck ok')
