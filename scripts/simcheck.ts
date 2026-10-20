// Headless smoke test: run the starter tower for N days and print vitals.
import { newGame } from '../src/game/state'
import { buildStarter } from '../src/game/starter'
import { step } from '../src/game/sim'
import { STEPS_PER_SECOND } from '../src/game/defs'
import { checkStarterStickers } from './stickercheck'

const days = Number(process.argv[2] ?? 3)
const g = newGame('family', true)
buildStarter(g)
const t0 = performance.now()
let maxPeople = 0, maxWait = 0
const steps = days * 1440 * 10
for (let i = 0; i < steps; i++) {
  step(g)
  if (i % 600 === 0) {
    maxPeople = Math.max(maxPeople, g.people.size)
    for (const s of g.shafts.values()) { let w = 0; for (const k in s.q) w += s.q[k].up.length + s.q[k].down.length; maxWait = Math.max(maxWait, w) }
    if (i % (600 * 12) === 0) {
      const states: Record<string, number> = {}
      for (const p of g.people.values()) states[p.state] = (states[p.state] ?? 0) + 1
      console.log(`day ${Math.floor(g.time / 1440)} ${(Math.floor(g.time % 1440 / 60))}:00 money=${g.money} pop=${g.pop} stars=${g.stars} people=${g.people.size}`, JSON.stringify(states))
    }
  }
}
const ms = performance.now() - t0
console.log(`ran ${steps} steps in ${ms.toFixed(0)}ms (${(steps / ms * 1000 / STEPS_PER_SECOND).toFixed(0)}x realtime@1x)`)
console.log('maxPeople', maxPeople, 'maxQueue', maxWait)
const occ = [...g.facilities.values()].filter(f => f.kind === 'office' || f.kind === 'condo')
console.log('occupied', occ.filter(f => f.occupied).length, '/', occ.length, 'avg happiness', Math.round(occ.reduce((a, f) => a + f.happiness, 0) / occ.length))
console.log('complaints', [...new Set(occ.flatMap(f => f.complaints))])
console.log(g.log.slice(-12).map(m => m.text).join('\n'))
checkStarterStickers()
