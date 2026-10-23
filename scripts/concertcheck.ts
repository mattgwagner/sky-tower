// Headless check: the Concert Hall fills before each show, pays at curtain, rotates its act, and plays the Mystery Band.
import { dayOf, newGame } from '../src/game/state'
import { FACILITIES, isCommercial } from '../src/game/defs'
import { afterBuild, isOpen, step } from '../src/game/sim'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'
import { LINEUP, actFor, concertPerHour, concertPhase, concertStatus, showAt } from '../src/game/concert'
import { forceSurprise } from '../src/game/surprises'
import { stepStickers } from '../src/game/stickers'

const fail = (msg: string) => { console.error(`concertcheck FAILED: ${msg}`); process.exit(1) }

const def = FACILITIES.concertHall
if (def.category !== 'shops' || def.stars !== 2 || def.cost !== 600000 || def.height !== 3 || !isCommercial('concertHall'))
  fail(`catalog ${JSON.stringify(def)}`)
if (showAt(6) !== 14 * 60 || showAt(0) !== 19 * 60 + 30 || showAt(13) !== 14 * 60) fail('show times')

const g = newGame('sandbox', false)
paintRun(g, 'lobby', 40, 67, 0)
for (let fl = 0; fl <= 3; fl++) paintRun(g, fl ? 'floor' : 'lobby', fl ? 50 : 68, 150, fl)
if (!placeFacility(g, 'stairs', 60, 0)) fail('could not place stairs')
const hall = placeFacility(g, 'concertHall', 80, 1)
if (!hall) fail(`could not place hall: ${checkFacility(g, 'concertHall', 80, 1).reason}`)
afterBuild(g)
if (!hall!.reachable) fail('hall is not reachable from the lobby')

const at = (day: number, h: number, m = 0) => day * 1440 + h * 60 + m
g.time = at(3, 12)
if (isOpen(g, hall!)) fail('open at noon on a show night')
if (concertStatus(g, hall!) !== 'Tonight: Robot Band 🤖 at 7:30pm') fail(`status ${concertStatus(g, hall!)}`)
g.time = at(3, 19)
if (!isOpen(g, hall!) || concertPerHour(g) !== 90 || concertPhase(g).phase !== 'doors') fail('doors not open at 7pm')
g.time = at(3, 20)
if (concertPerHour(g) !== 0 || !concertStatus(g, hall!)?.startsWith('Now playing: Robot Band')) fail(`show status ${concertStatus(g, hall!)}`)
g.time = at(3, 21)
if (concertPhase(g).phase !== 'encore') fail(`phase at 9pm ${concertPhase(g).phase}`)
g.time = at(3, 22)
if (isOpen(g, hall!) || concertStatus(g, hall!) !== 'Show\'s over, see you tomorrow') fail('still open after the show')
g.time = at(6, 13, 30)
if (!isOpen(g, hall!) || !concertStatus(g, hall!)?.startsWith('Today: Piano Matinee')) fail(`Sunday matinee ${concertStatus(g, hall!)}`)

// Seven days of shows from Monday morning: every act plays, and every show with a crowd pays.
g.time = at(7, 6)
const crowds: number[] = []
let paydays = 0
for (let d = 0; d < 7; d++) {
  const day = dayOf(g.time)
  const curtainT = day * 1440 + showAt(day)
  let curtain = -1
  for (let i = 0; i < 14400; i++) {
    // keep the week to the regular lineup: a random fire would cancel a show, and a drawn Mystery Band replaces the act
    hall!.fire = 0
    g.flags.concertMystery = undefined
    const income = hall!.incomeTotal
    const before = Math.floor(g.time)
    step(g)
    // the minute tick that crosses into the curtain minute pays out, after that step's arrivals
    if (before < curtainT && Math.floor(g.time) >= curtainT && curtain < 0) {
      curtain = hall!.inside
      if (curtain >= 20 && hall!.incomeTotal - income >= 30000) paydays++
    }
  }
  crowds.push(curtain)
}
if (crowds.some((c) => c <= 0)) fail(`an empty show: ${crowds.join(',')}`)
if (hall!.customersYesterday <= 0) fail('no customers yesterday')
if (paydays < crowds.filter((c) => c >= 20).length) fail(`paydays ${paydays} for crowds ${crowds.join(',')}`)
if (g.flags.concertActs !== (1 << LINEUP.length) - 1) fail(`acts seen ${g.flags.concertActs?.toString(2)}`)
stepStickers(g)
for (const id of ['concert-first', 'concert-all-acts']) if (!g.stickers.includes(id)) fail(`no ${id} sticker`)

// Mystery Band: drawn day doubles the crowd rate and the tickets, and swaps the act.
const day = dayOf(g.time)
g.time = day * 1440 + showAt(day) - 60
forceSurprise(g, 'mysteryBand')
if (g.flags.concertMystery !== day) fail('mystery band did not start')
if (concertPerHour(g) !== 180) fail(`mystery perHour ${concertPerHour(g)}`)
if (LINEUP.some((a) => a.id === actFor(g).id)) fail(`mystery act ${actFor(g).name}`)
if (!concertStatus(g, hall!)?.includes('MYSTERY GUEST')) fail(`mystery status ${concertStatus(g, hall!)}`)
let before = 0
while (Math.round(g.time) < day * 1440 + showAt(day)) { before = hall!.incomeTotal; step(g) }
// pack the house so the curtain minute sees a full hall
hall!.inside = Math.max(hall!.inside, 90)
for (let i = 0; i < 10; i++) step(g)
if (hall!.incomeTotal - before < 60000) fail(`mystery tickets ${hall!.incomeTotal - before}`)
if (g.flags.concertSoldOut !== day || !concertStatus(g, hall!)?.includes('SOLD OUT')) fail('full house did not sell out')
stepStickers(g)
for (const id of ['concert-sold-out', 'concert-mystery']) if (!g.stickers.includes(id)) fail(`no ${id} sticker`)

console.log(`concertcheck ok: crowds at curtain ${crowds.join(',')}, paydays ${paydays}`)
