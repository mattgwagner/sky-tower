// Giant visitors, on the days surprises.ts draws one. Drawing lives in render/giants.ts.
import type { Game } from './state'
import { dayOf, minuteOfDay } from './state'
import { fx, log, topFloor } from './world'
import { weatherFor } from '../render/sky-fx'

export type GiantKind = 'ape' | 'dragon' | 'skywriter'
export type ApePose = 'climb' | 'peek' | 'roof' | 'down'

/** How long each visit lasts, in sim minutes. When it starts is up to surprises.ts. */
const VISIT: Record<GiantKind, { len: number }> = {
  ape: { len: 60 },
  dragon: { len: 12 },
  skywriter: { len: 30 },
}

const SAYS = ['👋 Hi!', '*thump thump*', 'Nice tower!']

let seen = 0
const noted = new WeakMap<Game, string>()
let pokeN = 0

/** How many giant visits have started. Headless checks read this off window.api. */
export function giantCount() {
  return seen
}

/** Clear at noon, which is when weatherFor is actually raining or snowing. */
export function dayIsClear(day: number) {
  const w = weatherFor({ time: day * 1440 + 12 * 60 } as Game)
  return !w.rain && !w.snow && !w.storm
}

/** Built tiles on a floor, inclusive. Copied from sim.floorExtent so the ape can hug the real wall. */
export function floorSpan(g: Game, floor: number): [number, number] | null {
  const r = g.floors.get(floor)
  if (!r) return null
  let a = 0
  while (a < r.length && r[a] === -1) a++
  if (a >= r.length) return null
  let b = r.length - 1
  while (b > 0 && r[b] === -1) b--
  return [a, b]
}

function edgeTile(g: Game, floor: number) {
  const f = Math.round(floor)
  for (let d = 0; d < 12; d++) {
    const s = floorSpan(g, f - d) ?? (d ? floorSpan(g, f + d) : null)
    if (s) return s[1] + 1.4
  }
  return 120
}

export function apePlace(g: Game, phase: number): { floor: number; tile: number; pose: ApePose } {
  const top = topFloor(g)
  let floor = 0
  let pose: ApePose = 'climb'
  if (phase < 0.4) floor = top * (phase / 0.4)
  else if (phase < 0.55) { floor = top * 0.62; pose = 'peek' }
  else if (phase < 0.75) { floor = top; pose = 'roof' }
  else { floor = top * (1 - (phase - 0.75) / 0.25); pose = 'down' }
  return { floor, tile: edgeTile(g, floor), pose }
}

/** The visitor in progress, or null. Phase runs 0..1 across that visitor's window. */
export function giantNow(g: Game): { kind: GiantKind; phase: number } | null {
  const v = g.flags.giant
  if (!v || v.day !== dayOf(g.time)) return null
  const spec = VISIT[v.kind]
  const t = g.time - v.start
  if (t < 0 || t >= spec.len) return null
  return { kind: v.kind, phase: t / spec.len }
}

/** Roof lanterns stay lit from the dragon's flame until dawn. */
export function dragonLanterns(g: Game) {
  const v = g.flags.giant
  if (!v || v.kind !== 'dragon' || v.day !== dayOf(g.time)) return false
  return g.time >= v.start + VISIT.dragon.len * 0.45 && minuteOfDay(g.time) < 6 * 60
}

/** A visitor starts now. surprises.ts picks which one and when. */
export function startGiant(g: Game, kind: GiantKind) {
  g.flags.giant = { kind, day: dayOf(g.time), start: Math.round(g.time) }
}

const NEWS: Record<GiantKind, string> = {
  ape: '🎉 A giant ape is climbing the outside of the tower!',
  dragon: '🎉 A dragon is flying to the roof!',
  skywriter: '🎉 A plane is writing your tower\'s name in the sky!',
}
const ROOF: Record<GiantKind, string> = {
  ape: '🦍 Hi!',
  dragon: '🐉 Rooftop!',
  skywriter: '✈️ Look up!',
}

/** News plus a roof caption, the minute a visit actually starts. */
export function giantsArrive(g: Game) {
  const n = giantNow(g)
  const v = g.flags.giant
  if (!n || !v) return
  const key = `${v.start}:${n.kind}`
  if (noted.get(g) === key) return
  if (n.phase > 0.04) { noted.set(g, key); return }
  noted.set(g, key)
  seen++
  const span = floorSpan(g, topFloor(g))
  const x = span ? (span[0] + span[1]) / 2 : 120
  log(g, NEWS[n.kind], 'event', topFloor(g), x)
  fx(g, x, topFloor(g) + 1, ROOF[n.kind], '#ffd43b')
}

/** Tap the ape. A rect around his body is enough; he is not a room. */
export function apeHit(g: Game, tile: number, floor: number) {
  const n = giantNow(g)
  if (n?.kind !== 'ape') return false
  const p = apePlace(g, n.phase)
  return Math.abs(tile - p.tile) <= 3.5 && floor >= p.floor - 0.6 && floor <= p.floor + 6
}

export function pokeGiant(g: Game) {
  const n = giantNow(g)
  if (n?.kind !== 'ape') return false
  const p = apePlace(g, n.phase)
  fx(g, p.tile, Math.round(p.floor) + 2, SAYS[pokeN % SAYS.length]!, '#ffd43b')
  pokeN++
  return true
}

export function towerName(g: Game) {
  const name = (g.name ?? '').trim()
  return (name || 'SKY TOWER').toUpperCase().slice(0, 18)
}
