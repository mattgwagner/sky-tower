// Headless check: the contracts board draws one each morning (up to 3, math and build/earn mixed),
// build / earn contracts finish from real state and pay, math answers match the live tower, wrong
// answers pay nothing, deadlines expire quietly, reloads don't re-roll, and old saves load clean.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { FACILITIES, HOTEL_NIGHT, OFFICE_RENT, RENT_MULT, TOWER_WIDTH } from '../src/game/defs'
import { dayOf, deserialize, minuteOfDay, newGame, serialize } from '../src/game/state'
import type { Contract, Game } from '../src/game/state'
import { afterBuild, isOpen, starProgress, step } from '../src/game/sim'
import { earn, facilitiesOf, paintRun, placeFacility } from '../src/game/world'
import { answerContract, answerText, contractsHour, contractsMinute, goalDrafts, mathDrafts, rewardFor } from '../src/game/contracts'
import type { Draft } from '../src/game/contracts'
import { stepStickers } from '../src/game/stickers'

const fail = (msg: string) => { console.error(`contractcheck FAILED: ${msg}`); process.exit(1) }
const at = (day: number, h: number, m = 0) => day * 1440 + h * 60 + m
const X = TOWER_WIDTH / 2 - 60

/** Step whole minutes, with fires and surprises pinned so a random event can't change the tower. */
function run(g: Game, minutes: number) {
  for (let i = 0; i < minutes * 10; i++) {
    for (const f of g.facilities.values()) f.fire = 0
    g.flags.surprise = null
    g.flags.lastSurprise = null
    step(g)
  }
}

function tower(mode: 'family' | 'classic' | 'sandbox') {
  const g = newGame(mode, false)
  g.flags.seed = 7
  paintRun(g, 'lobby', X, X + 119, 0)
  for (let fl = 1; fl <= 6; fl++) paintRun(g, 'floor', X, X + 119, fl)
  if (!placeFacility(g, 'stairs', X + 2, 0)) fail('stairs')
  for (let fl = 1; fl <= 5; fl++) if (!placeFacility(g, 'stairs', X + 2, fl)) fail(`stairs ${fl}`)
  for (let i = 0; i < 4; i++) if (!placeFacility(g, 'office', X + 12 + i * 9, 1)) fail('office')
  for (let i = 0; i < 3; i++) if (!placeFacility(g, 'condo', X + 12 + i * 16, 2)) fail('condo')
  if (!placeFacility(g, 'pizza', X + 12, 3)) fail('pizza')
  afterBuild(g)
  return g
}

const roll = (v: number) => () => v

// ---- a fresh 1★ family tower: the first morning draws one ----
const g = tower('family')
if (g.contracts.open.length || g.contracts.lastDay !== -1) fail('new game starts with a board')
run(g, 61) // 6:00 → 7:01, the first hour tick
if (g.contracts.open.length !== 1 || g.contracts.lastDay !== 0) fail(`first morning drew ${g.contracts.open.length}`)

// ---- 1★ never offers something it can't build, or the star-goal rooms ----
for (let i = 0; i < 40; i++) {
  for (const d of goalDrafts(g, 0, (s) => ((i * 37 + s * 11) % 100) / 100)) {
    if (d.kind && FACILITIES[d.kind].stars > 1) fail(`1★ offered ${d.kind}`)
    if (d.kind === 'metro' || d.kind === 'cathedral') fail(`offered ${d.kind}`)
    if (d.type === 'build' && d.n! > 2) fail(`1★ asked for ${d.n}`)
  }
}

// ---- a week of mornings: one a day, never more than 3, both kinds show up ----
const seen = new Map<number, Contract>()
for (let d = 1; d <= 7; d++) {
  const day = dayOf(g.time)
  run(g, 1440)
  if (dayOf(g.time) !== day + 1) fail('day did not advance')
  for (const c of g.contracts.open) seen.set(c.id, c)
  if (g.contracts.open.length > 3) fail(`${g.contracts.open.length} open`)
  if (g.contracts.lastDay !== dayOf(g.time)) fail(`day ${dayOf(g.time)} skipped its draw`)
}
const kinds = new Set([...seen.values()].map((c) => c.type === 'math' ? 'math' : 'goal'))
if (!kinds.has('math') || !kinds.has('goal')) fail(`only ${[...kinds]} drawn in a week`)

// ---- math answers match the live tower ----
function verifyMath(g: Game, d: Draft) {
  const text = d.text
  const nums = (text.match(/[\d,]+/g) ?? []).map((s) => Number(s.replace(/,/g, ''))).filter((n) => !Number.isNaN(n))
  if (d.emoji === '✖️') {
    const n = facilitiesOf(g, d.kind!).length
    if (d.answer !== n * FACILITIES[d.kind!].pop) fail(`people × ${text} = ${d.answer}`)
  } else if (d.emoji === '🛏️') {
    const rooms = facilitiesOf(g, d.kind!)
    const sum = rooms.reduce((a, f) => a + Math.round(HOTEL_NIGHT[d.kind!]! * RENT_MULT[f.rent] * (g.mode === 'family' ? 1.25 : 1)), 0)
    if (d.answer !== sum) fail(`hotel ${text} = ${d.answer}, rooms pay ${sum}`)
  } else if (d.emoji === '💼') {
    const offices = facilitiesOf(g, 'office').filter((f) => f.occupied)
    const sum = offices.reduce((a, f) => a + Math.round(OFFICE_RENT * RENT_MULT[f.rent] * (g.mode === 'family' ? 1.25 : 1)), 0)
    if (d.answer !== sum) fail(`office ${text} = ${d.answer}, rent is ${sum}`)
  } else if (d.emoji === '⭐') {
    if (d.answer !== starProgress(g)!.pop - g.pop) fail(`star gap ${text} = ${d.answer}`)
  } else if (d.emoji === '➕') {
    if (nums[0] !== g.pop || d.answer !== nums[0] + nums[1]) fail(`add ${text} = ${d.answer}`)
  } else if (d.emoji === '➖') {
    if (nums[0] !== g.pop || d.answer !== nums[0] - nums[1]) fail(`subtract ${text} = ${d.answer}`)
  } else if (d.emoji === '💵') {
    const names = Object.values(FACILITIES).filter((f) => text.includes(` ${f.name} costs $${f.cost.toLocaleString('en-US')}`))
    if (names.length !== 2 || d.answer !== names[0].cost + names[1].cost) fail(`money ${text} = ${d.answer}`)
  } else if (d.emoji === '🕒') {
    // count the open hours on a weekday by asking the sim
    const f = facilitiesOf(g, d.kind!)[0]
    const t0 = g.time
    let hours = 0
    for (let h = 0; h < 24; h++) { g.time = at(3, h, 30); if (isOpen(g, f)) hours++ }
    g.time = t0
    if (d.answer !== hours) fail(`hours ${text} = ${d.answer}, open ${hours}`)
  } else if (d.emoji === '🚇') {
    const m = text.match(/It's (\d+):(\d\d) now/)!
    const now = Number(m[1]) * 60 + Number(m[2])
    const next = Math.ceil((now + 1) / 30) * 30
    const want = ((Math.floor(next / 60) % 12) || 12) * 100 + (next % 60)
    if (d.answer !== want) fail(`metro ${text} = ${d.answer}, want ${want}`)
  } else fail(`unknown template ${d.emoji}`)
  const x = d.answer!
  // stays in the skill range
  if (d.skill === 'mul') {
    const f = text.match(/\$?([\d,]+)/g)!.map((s) => Number(s.replace(/[$,]/g, '')))
    const [a, b] = [f[0], f[1]]
    const strip = (v: number) => { while (v % 10 === 0) v /= 10; return v }
    if (a > 12 || strip(b) > 12) fail(`× out of range: ${text}`)
  }
  if ((d.skill === 'add' || d.skill === 'sub') && x > 9999) fail(`± out of range: ${text}`)
}

// a richer tower so every template has numbers to use
const rich = tower('classic')
rich.stars = 4
rich.money = 50_000_000
for (let i = 0; i < 6; i++) if (!placeFacility(rich, 'hotelSingle', X + 12 + i * 4, 4)) fail('hotel')
for (let i = 0; i < 4; i++) if (!placeFacility(rich, 'hotelTwin', X + 40 + i * 6, 4)) fail('twin')
for (let fl = -1; fl >= -3; fl--) paintRun(rich, 'floor', X, X + 119, fl)
if (!placeFacility(rich, 'metro', X + 30, -3)) fail('metro')
rich.stars = 2 // classic's 4★ goal is 10,000 people, past the ± range
rich.time = at(1, 6)
afterBuild(rich)
run(rich, 60 * 14) // offices rent, people move in
for (const f of facilitiesOf(rich, 'office')) f.occupied = true
const templates = new Set<string>()
for (let i = 0; i < 60; i++) {
  for (const d of mathDrafts(rich, (s) => ((i * 53 + s * 29) % 97) / 97)) { verifyMath(rich, d); templates.add(d.emoji) }
}
for (const e of ['✖️', '🛏️', '💼', '⭐', '➕', '➖', '💵', '🕒', '🚇']) if (!templates.has(e)) fail(`template ${e} never offered`)
// family mode: a $3,750 room isn't a times-table fact, so the hotel question stays out
const fam = tower('family')
fam.stars = 2
for (let i = 0; i < 4; i++) placeFacility(fam, 'hotelSingle', X + 12 + i * 4, 4)
for (let i = 0; i < 30; i++) for (const d of mathDrafts(fam, (s) => ((i * 7 + s) % 31) / 31)) {
  if (d.emoji === '🛏️') fail(`family hotel question: ${d.text}`)
  verifyMath(fam, d)
}

// the hotel question's price is what a room really pays the next morning
{
  const rooms = facilitiesOf(rich, 'hotelSingle')
  const paid = new Map(rooms.map((f) => [f.id, f.incomeTotal]))
  run(rich, 1440 * 2)
  let checked = 0
  for (const f of rooms) {
    const delta = f.incomeTotal - paid.get(f.id)!
    const night = Math.round(HOTEL_NIGHT.hotelSingle! * RENT_MULT[f.rent])
    if (delta > 0) { checked++; if (delta % night !== 0) fail(`room paid ${delta}, a night is ${night}`) }
  }
  if (!checked) fail('no hotel room paid in two nights')
}

// ---- build contract: finishes from a real placeFacility and pays ----
function push(g: Game, d: Draft) {
  const c: Contract = { ...d, id: g.contracts.nextId++, day: dayOf(g.time), reward: rewardFor(g, d.type) }
  g.contracts.open.push(c)
  return c
}
const b = tower('family')
b.time = at(1, 9)
const build = goalDrafts(b, 1, roll(0.01)).find((d) => d.type === 'build')!
if (!build) fail('no build draft')
const bc = push(b, build)
const money0 = b.money
contractsMinute(b)
if (!b.contracts.open.includes(bc)) fail('build contract done before building')
let placed = 0
for (let fl = 4; fl <= 6 && placed < build.n!; fl++) {
  for (let x = X + 10; x < X + 110 && placed < build.n!; x += 2) if (placeFacility(b, build.kind!, x, fl)) placed++
}
if (placed !== build.n) fail(`placed ${placed} of ${build.n} ${build.kind}`)
const spent = money0 - b.money
contractsMinute(b)
if (b.contracts.open.includes(bc)) fail('build contract not done after building')
if (b.money + spent - money0 !== Math.round(bc.reward * 1.25)) fail(`build paid ${b.money + spent - money0}, reward ${bc.reward}`)
if (b.contracts.done !== 1) fail('done count')
if (!stepStickers(b).some((s) => s.id === 'contract-1')) fail('First Contract sticker')

// ---- earn contract: real earnings count, the reward doesn't ----
const e = tower('classic')
e.time = at(2, 8)
e.contracts.earnedYesterday = 40_000
const earnD = goalDrafts(e, 2, roll(0.5)).find((d) => d.type === 'earn')!
if (!earnD || earnD.goal !== 50_000) fail(`earn draft ${JSON.stringify(earnD)}`)
const ec = push(e, earnD)
e.contracts.earnedToday = 0
earn(e, 30_000)
contractsMinute(e)
if (!e.contracts.open.includes(ec)) fail('earn done early')
earn(e, 20_000)
const m0 = e.money
contractsMinute(e)
if (e.contracts.open.includes(ec) || e.money - m0 !== ec.reward) fail('earn contract did not pay')
if (e.contracts.earnedToday !== 50_000) fail(`reward counted as earnings: ${e.contracts.earnedToday}`)
// midnight rolls today into yesterday
e.time = at(2, 23, 59)
run(e, 2)
if (e.contracts.earnedYesterday < 50_000 || e.contracts.earnedToday > 20_000) fail(`day roll ${e.contracts.earnedYesterday}/${e.contracts.earnedToday}`)

// ---- math: wrong pays nothing and gives a hint; right pays; streak builds to Math Whiz ----
const q = tower('classic')
q.time = at(1, 9)
for (let i = 0; i < 5; i++) {
  const d = mathDrafts(q, roll(i / 5))[0]
  const c = push(q, d)
  const before = q.money
  if (i === 0) {
    if (answerContract(q, c.id, String(d.answer! + 1)) !== 'wrong' || q.money !== before) fail('wrong answer paid')
    if (!c.missed || (q.contracts.misses[d.skill!] ?? 0) !== 1) fail('miss not counted')
    if (!d.hint) fail('no hint')
    if (answerContract(q, c.id, answerText(c)) !== 'right' || q.money - before !== c.reward) fail('right answer after a miss')
    if (q.contracts.streak !== 0) fail('a missed question counted for the streak')
    continue
  }
  if (answerContract(q, c.id, answerText(c)) !== 'right') fail(`right answer ${answerText(c)} for ${d.text}`)
}
if (q.contracts.streak !== 4 || (q.contracts.misses.add ?? 0) + (q.contracts.misses.mul ?? 0) + (q.contracts.misses.sub ?? 0) + (q.contracts.misses.money ?? 0) + (q.contracts.misses.time ?? 0) > 1) fail(`streak ${q.contracts.streak}`)
push(q, mathDrafts(q, roll(0.9))[0])
const last = q.contracts.open[q.contracts.open.length - 1]
answerContract(q, last.id, answerText(last))
if (q.contracts.best !== 5 || !stepStickers(q).some((s) => s.id === 'math-whiz')) fail('Math Whiz')
// clock answers: "3:00" and "300" both count
const clockC: Contract = { id: 999, type: 'math', day: 1, reward: 1, emoji: '🚇', text: '', skill: 'time', clock: true, answer: 300 }
q.contracts.open.push(clockC)
if (answerContract(q, 999, '3:00') !== 'right') fail('3:00 not accepted')

// ---- expiry: a missed deadline drops off at the next morning, no charge ----
const x = tower('family')
x.time = at(4, 5)
const pc = push(x, { type: 'pop', until: 3, emoji: '👥', text: 'Get 9,999 people in your tower', goal: 9999 })
x.contracts.lastDay = 3
const mx = x.money
contractsHour(x, 6 * 60)
if (x.contracts.open.includes(pc)) fail('expired contract still open')
if (x.money < mx) fail('expiry cost money')
if (x.contracts.open.length !== 1) fail('no new contract after expiry')
// a full board doesn't grow
x.contracts.open = [0, 1, 2].map((i) => ({ ...pc, id: 100 + i, until: undefined, type: 'math' as const, answer: 1 }))
x.contracts.lastDay = 4
x.time = at(5, 6)
contractsHour(x, 6 * 60)
if (x.contracts.open.length !== 3) fail('a full board grew')

// ---- reload doesn't re-roll the board ----
const r1 = tower('family')
r1.time = at(2, 5, 30)
const r2 = deserialize(serialize(r1))
run(r1, 60); run(r2, 60)
if (JSON.stringify(r1.contracts.open) !== JSON.stringify(r2.contracts.open)) fail('reload re-rolled the board')
if (!r1.contracts.open.length) fail('no draw at 6am')

// ---- old saves: v1 fixture loads with an empty board and draws next morning ----
const v1 = deserialize(gunzipSync(readFileSync(new URL('./fixtures/v1-save.json.gz', import.meta.url))).toString())
if (v1.contracts.open.length || v1.contracts.lastDay !== -1) fail('v1 save has a board')
const start = minuteOfDay(v1.time)
// loaded mid-day, it draws at the next hour tick; before 6am, at 6am
run(v1, Math.max(0, 6 * 60 - start) + 61)
if (v1.contracts.open.length !== 1) fail(`v1 save drew ${v1.contracts.open.length}`)
const v1b = deserialize(serialize(v1))
if (JSON.stringify(v1b.contracts) !== JSON.stringify(v1.contracts)) fail('board lost in save')

console.log(`contractcheck ok: ${seen.size} contracts in a week (${[...kinds]}), ${templates.size} math templates verified`)
