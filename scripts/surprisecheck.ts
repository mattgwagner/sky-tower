// Headless: a tower that can have every surprise, run 30 days. Prints each day's surprise and checks the budget.
import { newGame } from '../src/game/state'
import type { Game } from '../src/game/state'
import { afterBuild, step } from '../src/game/sim'
import { addCar, paintRun, placeFacility, placeShaft } from '../src/game/world'
import { SURPRISES, surpriseDay } from '../src/game/surprises'
import type { SurpriseId } from '../src/game/surprises'

const DAYS = 30
const TOP = 21

const g = newGame('family', false)
g.mode = 'sandbox'
paintRun(g, 'lobby', 60, 179, 0)
const e = placeShaft(g, 'elevator', 100, 0, TOP)!
addCar(g, e); addCar(g, e)
for (let f = 1; f <= TOP; f++) paintRun(g, 'floor', 60, 179, f)
const must = (kind: Parameters<typeof placeFacility>[1], x: number, f: number) => {
  if (!placeFacility(g, kind, x, f)) throw new Error(`could not place ${kind} at ${x},${f}`)
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
g.flags.seed = Number(process.env.SEED ?? 2)
afterBuild(g)

// The issue's groups: the three giants share one budget, and so do Rush and Seek.
const GROUP: Record<SurpriseId, string> = {
  huggy: 'huggy', monkey: 'monkey', rush: 'rush/seek', seek: 'rush/seek', ufo: 'ufo',
  ape: 'giants', dragon: 'giants', skywriter: 'giants', vip: 'vip', mysteryBand: 'mysteryBand', disco: 'disco',
}

// Draws alone, over many seeds on this same tower: the long-run rate per week for each group.
function rates(seeds: number, days: number) {
  const n: Record<string, number> = { quiet: 0 }
  const flags = structuredClone(g.flags)
  const time = g.time
  for (let seed = 1000; seed < 1000 + seeds; seed++) {
    g.flags.seed = seed
    g.flags.surprise = null
    for (let d = 1; d <= days; d++) {
      g.time = d * 1440
      surpriseDay(g)
      const id = g.flags.surprise!.id
      const k = id ? GROUP[id] : 'quiet'
      n[k] = (n[k] ?? 0) + 1
    }
  }
  g.flags = flags
  g.time = time
  const weeks = (seeds * days) / 7
  return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v / weeks]))
}

// What each surprise leaves behind, so a start that silently did nothing fails the check.
const mark: Record<SurpriseId, (g: Game) => unknown> = {
  huggy: (g) => g.flags.huggy?.x,
  monkey: (g) => g.flags.monkey?.since,
  rush: (g) => g.flags.entity?.start,
  seek: (g) => g.flags.entity?.start,
  ufo: (g) => g.flags.ufoAt,
  ape: (g) => g.flags.giant?.start,
  dragon: (g) => g.flags.giant?.start,
  skywriter: (g) => g.flags.giant?.start,
  vip: (g) => g.flags.vipVisit,
  mysteryBand: (g) => g.flags.concertMystery,
  disco: (g) => g.flags.discoFever,
}
const started: { id: SurpriseId; day: number; t: number }[] = []
const dud: string[] = []
for (const s of SURPRISES) {
  const start = s.start
  s.start = (gg) => {
    const before = mark[s.id](gg)
    start(gg)
    const t = Math.round(gg.time)
    const draw = [gg.flags.surprise, gg.flags.lastSurprise].find((d) => d?.id === s.id && d.day * 1440 + d.at === t)!
    started.push({ id: s.id, day: draw.day, t: gg.time })
    if (mark[s.id](gg) === before) dud.push(`${s.id} on day ${draw.day}`)
  }
}

// Before the run: once a VIP is impressed, VIP days stop for good.
const week = rates(400, 28)

const t0 = performance.now()
const drawn: (SurpriseId | null)[] = []
for (let d = 0; d < DAYS; d++) {
  for (let i = 0; i < 14400; i++) step(g)
  drawn.push(g.flags.surprise?.day === d + 1 ? g.flags.surprise.id : null)
}
// Day 0 is drawn on the first minute, mid-morning; the check counts the full days 1..DAYS.
const ms = performance.now() - t0
const perDay = new Map<number, SurpriseId[]>()
for (const s of started) perDay.set(s.day, [...(perDay.get(s.day) ?? []), s.id])
for (let d = 1; d <= DAYS; d++) {
  const ids = perDay.get(d) ?? []
  const clock = started.filter((s) => s.day === d).map((s) => `${Math.floor((s.t % 1440) / 60)}:${String(Math.round(s.t % 60)).padStart(2, '0')}`)
  console.log(`day ${String(d).padStart(2)} drew ${drawn[d - 1] ?? '-'}${ids.length ? `  started ${ids.join(',')} at ${clock.join(',')}` : ''}`)
}

const fail: string[] = []
for (const [d, ids] of perDay) if (ids.length > 1) fail.push(`day ${d} had ${ids.length} surprises: ${ids.join(', ')}`)
// The last day's night surprise may still be due after the run ends; count draws, not starts, for the total.
const surpriseDays = drawn.filter(Boolean).length
if (surpriseDays < 8 || surpriseDays > 18) fail.push(`${surpriseDays} surprise days in ${DAYS}, want 8..18`)
const missingStarts = drawn.map((id, i) => ({ id, day: i + 1 })).filter((x) => x.id && x.day < DAYS && !perDay.get(x.day)?.includes(x.id))
for (const x of missingStarts) fail.push(`day ${x.day} drew ${x.id} but it never started`)
for (const grp of new Set(Object.values(GROUP))) {
  if (!drawn.some((id) => id && GROUP[id] === grp)) fail.push(`${grp} never drawn in ${DAYS} days`)
}
console.log('per week over 400 towers:', Object.entries(week).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · '))
const near = (k: string, lo: number, hi: number) => {
  if (!(week[k]! >= lo && week[k]! <= hi)) fail.push(`${k} ${week[k]?.toFixed(2)} a week, want ${lo}..${hi}`)
}
near('quiet', 2.5, 3.5)
near('huggy', 0.7, 1.3); near('monkey', 0.7, 1.3); near('rush/seek', 0.7, 1.3)
near('ufo', 0.3, 0.7); near('giants', 0.3, 0.7); near('vip', 0.1, 0.6); near('mysteryBand', 0.15, 0.5)
fail.push(...dud.map((x) => `start did nothing: ${x}`))

console.log(`${surpriseDays} surprise days, ${DAYS - surpriseDays} quiet, in ${(ms / 1000).toFixed(1)}s`)
if (fail.length) {
  console.error('surprisecheck FAILED\n  ' + fail.join('\n  '))
  process.exit(1)
}
console.log('surprisecheck ok')
