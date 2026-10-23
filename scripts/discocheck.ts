// Headless: Disco hours, visitors, the 10pm dance-off, Disco Fever, and the 2am sticker.
import { FACILITIES, ATTRACTIONS, SHOP_CAPACITY, SPEND } from '../src/game/defs'
import {
  discoAfterWeekend, discoBeat, discoFlashCount, discoFlashTile, discoMinute, discoMode, discoPerHour, discoShared, discoZone, feverOn, moveAt,
} from '../src/game/disco'
import { pokeFacility } from '../src/game/poke'
import { newPerson, step, isOpen, afterBuild } from '../src/game/sim'
import { personName } from '../src/game/people-info'
import { newGame } from '../src/game/state'
import type { Facility, Game } from '../src/game/state'
import { stepStickers } from '../src/game/stickers'
import { forceSurprise } from '../src/game/surprises'
import { checkFacility, paintRun, placeFacility } from '../src/game/world'

const fail = (msg: string) => { console.error(`discocheck FAILED: ${msg}`); process.exit(1) }

const def = FACILITIES.disco
if (def.category !== 'fun' || def.stars !== 2 || def.cost !== 220000 || def.width !== 28 || def.height !== 2 || def.pop !== 10)
  fail(`catalog ${def.cost} ${def.width}x${def.height} ${def.stars}★ pop ${def.pop}`)
if (!def.blurb.includes('A little noisy!')) fail(`blurb ${def.blurb}`)
if (!ATTRACTIONS.includes('disco')) fail('disco is not an attraction, so nobody will visit')
if (SPEND.disco !== 300) fail(`spend ${SPEND.disco}`)
if (SHOP_CAPACITY.disco !== 40) fail(`capacity ${SHOP_CAPACITY.disco}`)
if (discoBeat(0) !== 0 || discoBeat(2000) !== 1) fail('beat did not advance')
if (!discoShared(100) || discoShared(1500)) fail('shared beat window')
if (moveAt(0, 1500) === moveAt(1, 1500)) fail('dancers share a move off the beat')
if (moveAt(0, 100) !== moveAt(1, 100)) fail('dancers differ on the beat')

function tower(): { g: Game; disco: Facility; condo: Facility } {
  const g = newGame('sandbox', false)
  paintRun(g, 'lobby', 40, 70, 0)
  paintRun(g, 'floor', 71, 170, 0)
  paintRun(g, 'floor', 60, 170, 1)
  if (!placeFacility(g, 'stairs', 60, 0)) fail(`could not place stairs: ${checkFacility(g, 'stairs', 60, 0).reason}`)
  const disco = placeFacility(g, 'disco', 80, 1)
  if (!disco) fail(`could not place disco: ${checkFacility(g, 'disco', 80, 1).reason}`)
  const condo = placeFacility(g, 'condo', 108, 1)
  if (!condo) fail(`could not place condo: ${checkFacility(g, 'condo', 108, 1).reason}`)
  afterBuild(g)
  if (!disco.reachable) fail('disco is not reachable from the lobby')
  if (!condo.noisy) fail('condo beside the disco was not marked noisy')
  return { g, disco, condo }
}

const built = tower()
const { g, disco } = built

for (const day of [1, 2, 3]) {
  for (let m = 0; m < 1440; m += 5) {
    g.time = day * 1440 + m
    const open = isOpen(g, disco)
    const mode = discoMode(g)
    if (open !== (mode !== 'closed')) fail(`day ${day} ${m} open ${open} mode ${mode}`)
    if (mode === 'kids' && (m < 16 * 60 || m >= 19 * 60)) fail(`kids at ${m}`)
    if (mode === 'club' && m >= 16 * 60 && m < 19 * 60) fail(`club during kids' hour ${m}`)
  }
}

g.time = 1 * 1440 + 15 * 60
if (discoMode(g) !== 'closed' || isOpen(g, disco)) fail('open at 3pm')
g.time = 1 * 1440 + 16 * 60
if (discoMode(g) !== 'kids' || discoPerHour(g) !== 5) fail(`4pm kids perHour ${discoPerHour(g)}`)
g.time = 1 * 1440 + 20 * 60
if (discoMode(g) !== 'club' || discoPerHour(g) !== 9) fail(`8pm perHour ${discoPerHour(g)}`)
g.time = 1 * 1440 + 22 * 60
if (discoPerHour(g) !== 18) fail(`10pm perHour ${discoPerHour(g)}`)
g.time = 2 * 1440 + 22 * 60
if (discoPerHour(g) !== 25) fail(`weekend 10pm perHour ${discoPerHour(g)}`)
g.time = 2 * 1440 + 17 * 60
if (discoPerHour(g) !== 7) fail(`weekend kids perHour ${discoPerHour(g)}`)
g.time = 1 * 1440 + 90
if (isOpen(g, disco) || discoAfterWeekend(g)) fail('weekday 1:30am stayed open')
g.time = 3 * 1440 + 90
if (!isOpen(g, disco) || discoMode(g) !== 'club' || !discoAfterWeekend(g)) fail('weekend night did not stay open until 2am')
g.time = 3 * 1440 + 120
if (isOpen(g, disco)) fail('still open at 2:00am')

// 2:00am on a weekday morning does not count. 2:00am after a weekend does.
const early = tower()
early.g.time = 2 * 1440 + 120 - 0.05
step(early.g)
if ((early.g.counters.discoLate ?? 0) !== 0) fail('2am sticker on a weekday morning')
early.g.time = 3 * 1440 + 120 - 0.05
step(early.g)
if ((early.g.counters.discoLate ?? 0) < 1) fail('kept open till 2am did not count')

// Too few people: the 10pm beat does nothing.
const quiet = tower()
quiet.disco.inside = 3
quiet.g.time = 1 * 1440 + 22 * 60
discoMinute(quiet.g, 22 * 60)
if (quiet.g.flags.danceOff) fail('dance-off fired with only 3 inside')

// A full floor: the beat fires from the sim, then the winner is announced.
const show = tower()
const dancers = []
for (let i = 0; i < 4; i++) {
  const p = newPerson(show.g, 'visitor', 0)
  p.state = 'inside'
  p.at = show.disco.id
  dancers.push(p)
}
show.disco.inside = 4
show.g.time = 1 * 1440 + 22 * 60 - 0.05
step(show.g)
const off = show.g.flags.danceOff
if (!off || (show.g.counters.danceOffs ?? 0) < 1) fail('dance-off did not start at 10pm')
const winner = off.winner === 0 ? off.a : off.b
const expectName = personName(dancers[off.winner])
if (winner !== expectName) fail(`winner ${winner} wanted ${expectName}`)
show.g.time = Math.floor(off.start + 32) + 0.95
step(show.g)
const line = show.g.log.find((m) => m.text.startsWith('Dance-off winner:'))
if (!line || line.text !== `Dance-off winner: ${expectName}!`) fail(`news ${line?.text}`)
if (show.disco.incomeToday < 2000) fail(`prize ${show.disco.incomeToday}`)

if (discoZone(show.disco, show.disco.x + show.disco.width - 1, show.disco.floor) !== 'dj') fail('DJ zone')
if (discoZone(show.disco, show.disco.x + 6, show.disco.floor) !== 'tile') fail('tile zone')
if (discoZone(show.disco, show.disco.x + 6, show.disco.floor + 1) !== 'room') fail('upper floor zone')
const beforeFlash = discoFlashCount()
const dj = pokeFacility(show.g, show.disco, 5000, show.disco.x + show.disco.width - 2, show.disco.floor)
if (dj !== 'scratch' || show.g.flags.discoPattern !== 1) fail(`DJ poke ${dj} pattern ${show.g.flags.discoPattern}`)
if (!show.g.fx.some((f) => f.text === 'DROP THE BEAT! 🎧')) fail('missing drop the beat')
const tile = pokeFacility(show.g, show.disco, 6000, show.disco.x + 6, show.disco.floor)
if (tile !== 'pop' || discoFlashCount() !== beforeFlash + 1) fail('tile poke did not flash')
if (discoFlashTile(show.disco.id, 6000) !== show.disco.x + 6) fail('flash tile')
const lines = new Set<string>()
for (let i = 0; i < 24; i++) {
  pokeFacility(show.g, show.disco, 8000 + i * 400, show.disco.x + 1, show.disco.floor + 1)
  const last = show.g.fx.at(-1)
  if (last) lines.add(last.text)
}
if (!lines.has('Bubbles! 🫧') || !lines.has('Everybody FREEZE! … ok go')) fail(`room lines ${[...lines].join(' | ')}`)

const fever = tower()
if (!forceSurprise(fever.g, 'disco') || !feverOn(fever.g)) fail('Disco Fever did not start')
if ((fever.g.counters.discoFever ?? 0) < 1) fail('fever counter')
if (!fever.g.log.some((m) => m.text.startsWith('Disco Fever!'))) fail('fever news')
fever.g.time += 8
if (feverOn(fever.g)) fail('fever lasted too long')

const earned = stepStickers(show.g).map((s) => s.id)
if (!show.g.stickers.includes('dance-off')) fail(`dance-off sticker ${earned}`)
if (!stepStickers(early.g).some((s) => s.id === 'disco-late') && !early.g.stickers.includes('disco-late')) fail('2am sticker')
if (!stepStickers(fever.g).some((s) => s.id === 'disco-fever') && !fever.g.stickers.includes('disco-fever')) fail('fever sticker')

const visit = tower()
visit.g.time = 6 * 60
let saw = 0
for (let i = 0; i < 2 * 1440 * 10; i++) {
  step(visit.g)
  saw = Math.max(saw, visit.disco.customersToday, visit.disco.customersYesterday)
}
if (visit.disco.customersYesterday <= 0) fail(`no visitors yesterday (today ${visit.disco.customersToday}, peak ${saw})`)
console.log(`discocheck ok: yesterday ${visit.disco.customersYesterday}, peak ${saw}`)
