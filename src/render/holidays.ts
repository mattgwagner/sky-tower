// Holiday decorations: pumpkins, cobwebs and bats; snowmen, icicles and snowballs; floating hearts;
// birthday confetti and bunting; costumes for trick-or-treaters and hats for a snow day; the New Year splash.
import { isCommercial, isHotel } from '../game/defs'
import { COSTUMES, holidayFor, newYearSplash } from '../game/holidays'
import type { Facility, Game, Person } from '../game/state'
import { dayOf, minuteOfDay } from '../game/state'
import { topFloor } from '../game/world'
import { FH, T } from './sprites'

type Pt = { x: number; y: number }
type ToScreen = (x: number, y: number) => Pt

const floorTop = (f: number) => -(f + 1) * FH
const hash = (n: number) => { let x = (n + 7) * 2654435761; x ^= x >>> 15; return ((x >>> 0) % 1000) / 1000 }
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

// ---------- sky ----------

const rgb = (s: string): number[] => s.startsWith('#') ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : s.slice(4, -1).split(',').map(Number)
const mix = (a: string, b: string, k: number) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})` }

/** Spooky Week sunsets go purple on top and pumpkin-orange at the horizon. */
export function holidaySky(g: Game, sky: [string, string, number], hour: number): [string, string, number] {
  if (holidayFor(g)?.id !== 'spooky') return sky
  const k = hour < 17 ? 0 : hour < 18.5 ? (hour - 17) / 1.5 : hour < 20 ? 1 : clamp01((21 - hour) / 1)
  if (k <= 0) return sky
  return [mix(sky[0], '#4b1d7a', k * 0.75), mix(sky[1], '#ff7b1c', k * 0.7), sky[2]]
}

// ---------- per-room decorations ----------

function pumpkin(c: CanvasRenderingContext2D, x: number, yb: number, u: number, lit: boolean) {
  c.fillStyle = '#e8590c'
  c.beginPath(); c.ellipse(x, yb - 2.6 * u, 3.4 * u, 2.6 * u, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#fd7e14'
  c.beginPath(); c.ellipse(x, yb - 2.6 * u, 1.4 * u, 2.6 * u, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#2b8a3e'; c.fillRect(x - 0.4 * u, yb - 6 * u, 0.9 * u, 1.3 * u)
  c.fillStyle = lit ? '#ffe066' : '#5c2b00'
  c.fillRect(x - 2 * u, yb - 3.6 * u, 1 * u, 1 * u); c.fillRect(x + 1 * u, yb - 3.6 * u, 1 * u, 1 * u)
  c.fillRect(x - 1.6 * u, yb - 1.8 * u, 3.2 * u, 0.7 * u)
}

function cobweb(c: CanvasRenderingContext2D, x: number, y: number, u: number) {
  const r = 7 * u
  c.strokeStyle = 'rgba(240,240,255,0.75)'
  c.lineWidth = Math.max(0.5, 0.4 * u)
  c.beginPath()
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) }
  for (const k of [0.4, 0.7, 1]) {
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k; if (i) c.lineTo(px, py); else c.moveTo(px, py) }
  }
  c.stroke()
  c.fillStyle = '#212529'; c.fillRect(x + r * 0.55, y + r * 0.5, 1.4 * u, 1.4 * u)
}

function snowman(c: CanvasRenderingContext2D, x: number, yb: number, u: number, k: number) {
  if (k <= 0) return
  const ball = (cy: number, r: number) => { c.beginPath(); c.arc(x, cy, r, 0, Math.PI * 2); c.fill(); c.stroke() }
  c.fillStyle = '#f8f9fa'; c.strokeStyle = '#ced4da'; c.lineWidth = Math.max(0.5, 0.4 * u)
  const r1 = 3.6 * u * clamp01(k / 0.4)
  ball(yb - r1, r1)
  if (k < 0.4) return
  const r2 = 2.6 * u * clamp01((k - 0.4) / 0.3)
  ball(yb - 2 * r1 - r2 + 0.6 * u, r2)
  if (k < 0.7) return
  const r3 = 1.9 * u * clamp01((k - 0.7) / 0.2)
  const hy = yb - 2 * r1 - 2 * r2 - r3 + 1.2 * u
  ball(hy, r3)
  if (k < 0.9) return
  c.fillStyle = '#212529'
  c.fillRect(x - 0.9 * u, hy - 0.5 * u, 0.6 * u, 0.6 * u); c.fillRect(x + 0.4 * u, hy - 0.5 * u, 0.6 * u, 0.6 * u)
  c.fillRect(x - 2 * u, hy - r3 - 0.2 * u, 4 * u, 0.7 * u); c.fillRect(x - 1.2 * u, hy - r3 - 2.6 * u, 2.4 * u, 2.4 * u)
  c.fillStyle = '#fd7e14'; c.beginPath(); c.moveTo(x, hy); c.lineTo(x + 2.4 * u, hy + 0.4 * u); c.lineTo(x, hy + 0.8 * u); c.fill()
  c.fillStyle = '#c92a2a'; c.fillRect(x - 2 * u, yb - 2 * r1 + 0.2 * u, 4 * u, 0.9 * u)
}

function candle(c: CanvasRenderingContext2D, x: number, yb: number, u: number, now: number) {
  c.fillStyle = '#f783ac'; c.fillRect(x - 3 * u, yb - 4 * u, 6 * u, 0.8 * u)
  c.fillStyle = '#fff4e6'; c.fillRect(x - 0.5 * u, yb - 7.5 * u, 1.2 * u, 3.5 * u)
  const fl = 1 + Math.sin(now / 90) * 0.15
  c.fillStyle = 'rgba(255,212,59,0.35)'; c.beginPath(); c.arc(x, yb - 8.6 * u, 3 * u * fl, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#ffa94d'; c.beginPath(); c.ellipse(x + 0.1 * u, yb - 8.6 * u, 0.7 * u, 1.2 * u * fl, 0, 0, Math.PI * 2); c.fill()
}

function cake(c: CanvasRenderingContext2D, x: number, yb: number, u: number, now: number) {
  c.fillStyle = '#ffdeeb'; c.fillRect(x - 6 * u, yb - 5 * u, 12 * u, 5 * u)
  c.fillStyle = '#f783ac'; c.fillRect(x - 6 * u, yb - 5 * u, 12 * u, 1.2 * u)
  c.fillStyle = '#fff'; c.fillRect(x - 4 * u, yb - 9 * u, 8 * u, 4 * u)
  c.fillStyle = '#74c0fc'; c.fillRect(x - 4 * u, yb - 9 * u, 8 * u, 1 * u)
  for (const dx of [-2.5, 0, 2.5]) {
    c.fillStyle = '#ffd43b'; c.fillRect(x + (dx - 0.3) * u, yb - 11.5 * u, 0.7 * u, 2.5 * u)
    c.fillStyle = Math.sin(now / 80 + dx) > 0 ? '#ff922b' : '#ffd43b'; c.fillRect(x + (dx - 0.3) * u, yb - 12.6 * u, 0.8 * u, 1 * u)
  }
}

/** Decorations painted on top of one room. Called from drawFacility. */
export function drawHolidayDecor(c: CanvasRenderingContext2D, g: Game, f: Facility, p: Pt, w: number, h: number, z: number, now: number, m: number) {
  const hol = holidayFor(g)
  if (!hol) return
  const yb = p.y + h - 3 * z
  switch (hol.id) {
    case 'spooky':
      if (f.kind === 'lobby') {
        const lit = m < 7 * 60 || m >= 18 * 60
        for (let i = 3; i < f.width - 2; i += 12) pumpkin(c, p.x + i * T * z, yb, z, lit)
      } else if (isCommercial(f.kind)) cobweb(c, p.x + z, p.y + z, z)
      return
    case 'snow':
      if (f.kind === 'park') snowman(c, p.x + w * 0.72, yb, z, clamp01((m - 7 * 60) / (9 * 60)))
      return
    case 'heart':
      if (f.kind === 'restaurant') candle(c, p.x + w / 2, yb, z, now)
      return
    case 'birthday':
      if (f.kind === 'partyHall') {
        cake(c, p.x + w / 2, yb, z, now)
        const cols = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2']
        for (let i = 0; i < 5; i++) {
          const bx = p.x + w * (0.12 + i * 0.19), by = p.y + 10 * z + Math.sin(now / 500 + i) * 1.5 * z
          c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = Math.max(0.5, 0.3 * z)
          c.beginPath(); c.moveTo(bx, by + 3 * z); c.lineTo(bx, by + 12 * z); c.stroke()
          c.fillStyle = cols[i]; c.beginPath(); c.ellipse(bx, by, 2.4 * z, 3 * z, 0, 0, Math.PI * 2); c.fill()
        }
      }
      return
  }
}

// ---------- costumes and winter wear ----------

/** Paint a costume (trick-or-treaters) or a hat and scarf (snow day) over a person drawn at x, yBottom. */
export function drawHolidayWear(c: CanvasRenderingContext2D, g: Game, p: Person, x: number, yb: number, z: number) {
  const u = z
  if (p.costume !== undefined) {
    const kind = COSTUMES[p.costume % COSTUMES.length]
    if (z < 0.6) { c.fillStyle = kind === 'dino' ? '#40c057' : '#f1f3f5'; c.fillRect(x, yb - 7 * z, Math.max(1, 2 * z), 7 * z); return }
    if (kind === 'ghost') {
      c.fillStyle = '#f8f9fa'
      c.beginPath(); c.moveTo(x - 1.6 * u, yb); c.lineTo(x - 1.6 * u, yb - 8 * u); c.arc(x + 0.5 * u, yb - 8 * u, 2.1 * u, Math.PI, 0); c.lineTo(x + 2.6 * u, yb)
      for (let i = 0; i < 3; i++) c.lineTo(x + (2.6 - (i + 0.5) * 1.4) * u, yb - (i % 2 ? 0 : 1) * u)
      c.fill()
      c.fillStyle = '#212529'; c.fillRect(x - 0.4 * u, yb - 8.6 * u, 0.7 * u, 0.9 * u); c.fillRect(x + 0.9 * u, yb - 8.6 * u, 0.7 * u, 0.9 * u)
    } else if (kind === 'dino') {
      c.fillStyle = '#40c057'
      c.fillRect(x - u, yb - 7 * u, 3 * u, 4 * u)
      c.fillRect(x - 0.8 * u, yb - 10 * u, 2.8 * u, 3 * u)
      c.fillRect(x - 2.6 * u, yb - 4 * u, 1.8 * u, 1 * u)
      c.fillStyle = '#ffd43b'
      for (let i = 0; i < 3; i++) c.fillRect(x - 1.4 * u, yb - (9.5 - i * 2) * u, 0.8 * u, 0.8 * u)
      c.fillStyle = '#212529'; c.fillRect(x + 1.2 * u, yb - 9.2 * u, 0.6 * u, 0.6 * u)
    } else {
      c.fillStyle = '#e9ecef'
      c.fillRect(x - u, yb - 7 * u, 3 * u, 4.2 * u)
      c.fillStyle = '#adb5bd'; c.fillRect(x - 1.8 * u, yb - 6.6 * u, 0.9 * u, 3 * u)
      c.fillStyle = '#e9ecef'; c.beginPath(); c.arc(x + 0.6 * u, yb - 8.6 * u, 1.9 * u, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#4dabf7'; c.fillRect(x + 0.1 * u, yb - 9.3 * u, 1.8 * u, 1.2 * u)
      c.fillStyle = '#ff6b6b'; c.fillRect(x - 0.2 * u, yb - 6.2 * u, 0.8 * u, 0.8 * u)
    }
    // the candy bag
    c.fillStyle = '#fd7e14'; c.fillRect(x + 2.2 * u, yb - 4.4 * u, 1.6 * u, 1.8 * u)
    return
  }
  if (z < 0.6 || holidayFor(g)?.id !== 'snow') return
  const col = ['#e03131', '#1971c2', '#2f9e44', '#f08c00'][p.id % 4]
  c.fillStyle = col
  c.fillRect(x - 0.7 * u, yb - 10.6 * u, 2.6 * u, 1.3 * u)
  c.fillStyle = '#fff'; c.fillRect(x + 0.2 * u, yb - 11.4 * u, 0.9 * u, 0.9 * u)
  c.fillStyle = col
  c.fillRect(x - u, yb - 7.4 * u, 3 * u, 0.9 * u); c.fillRect(x + 1.2 * u, yb - 6.6 * u, 0.8 * u, 1.8 * u)
}

// ---------- ambient bits ----------

function towerSpan(g: Game, floor: number): [number, number] | null {
  const r = g.floors.get(floor)
  if (!r) return null
  const a = r.findIndex((v) => v !== -1)
  return a < 0 ? null : [a, r.findLastIndex((v) => v !== -1) + 1]
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath()
  c.moveTo(x, y + s * 0.9)
  c.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s * 0.9, x, y - s * 0.2)
  c.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.4, y, x, y + s * 0.9)
  c.fill()
}

function bats(c: CanvasRenderingContext2D, W: number, H: number, now: number, k: number) {
  c.fillStyle = `rgba(20,10,30,${0.85 * k})`
  for (let i = 0; i < 8; i++) {
    const t = (now / (9000 + i * 1300) + hash(i)) % 1
    const x = -40 + t * (W + 80)
    const y = H * (0.08 + hash(i + 50) * 0.3) + Math.sin(now / 400 + i) * 10
    const flap = Math.sin(now / 70 + i * 2) * 4
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x - 9, y - 3 - flap); c.lineTo(x - 5, y + 1); c.lineTo(x - 2, y - 1)
    c.lineTo(x, y + 2)
    c.lineTo(x + 2, y - 1); c.lineTo(x + 5, y + 1); c.lineTo(x + 9, y - 3 - flap)
    c.closePath(); c.fill()
  }
}

function icicles(c: CanvasRenderingContext2D, g: Game, S: ToScreen, z: number) {
  const tops = new Map<number, number>()
  for (const [f, r] of g.floors) {
    if (f < 0) continue
    for (let x = 0; x < r.length; x++) if (r[x] !== -1 && (tops.get(x) ?? -1) < f) tops.set(x, f)
  }
  c.fillStyle = 'rgba(208,235,255,0.9)'
  for (const [x, f] of tops) {
    if (x % 2) continue
    const len = (3 + hash(x) * 6) * z
    const p = S(x * T + T / 2, floorTop(f))
    c.beginPath(); c.moveTo(p.x - 1.2 * z, p.y); c.lineTo(p.x + 1.2 * z, p.y); c.lineTo(p.x, p.y + len); c.fill()
  }
}

function snowballFight(c: CanvasRenderingContext2D, g: Game, S: ToScreen, z: number, now: number) {
  const span = towerSpan(g, 0)
  if (!span) return
  const u = z
  const kid = (x: number, yb: number, col: string, dir: number) => {
    c.fillStyle = '#2b2b38'; c.fillRect(x, yb - 2 * u, u, 2 * u)
    c.fillStyle = col; c.fillRect(x - 0.7 * u, yb - 5 * u, 2.4 * u, 3 * u)
    c.fillStyle = '#f1c27d'; c.fillRect(x - 0.3 * u, yb - 6.8 * u, 1.8 * u, 1.8 * u)
    c.fillStyle = col; c.fillRect(x - 0.4 * u, yb - 7.6 * u, 2 * u, 0.9 * u)
    c.fillStyle = '#f1c27d'; c.fillRect(x + (dir > 0 ? 1.7 : -1.2) * u, yb - 4.8 * u, 0.9 * u, 0.9 * u)
  }
  for (const [side, x0] of [[-1, span[0] - 14], [1, span[1] + 4]] as const) {
    const a = S(x0 * T, -3), b = S((x0 + 9) * T, -3)
    // a little snow on the ground
    c.fillStyle = 'rgba(248,249,250,0.9)'; c.fillRect(a.x - 8 * u, a.y, b.x - a.x + 16 * u, 3 * u)
    kid(a.x, a.y, '#e03131', 1); kid(b.x, b.y, '#1971c2', -1)
    const t = ((now + (side > 0 ? 700 : 0)) / 1400) % 1
    const there = Math.floor((now + (side > 0 ? 700 : 0)) / 1400) % 2 === 0
    const sx = there ? a.x + (b.x - a.x) * t : b.x - (b.x - a.x) * t
    const sy = a.y - 6 * u - Math.sin(t * Math.PI) * 10 * u
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 1.1 * u, 0, Math.PI * 2); c.fill()
  }
}

const CONFETTI = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2', '#ff922b']

function confetti(c: CanvasRenderingContext2D, g: Game, S: ToScreen, z: number, now: number) {
  const top = topFloor(g)
  const span = towerSpan(g, top)
  if (!span) return
  const roof = floorTop(top)
  for (let i = 0; i < 70; i++) {
    const t = (now / (5000 + hash(i) * 3000) + hash(i + 9)) % 1
    const wx = (span[0] + hash(i + 3) * (span[1] - span[0])) * T + Math.sin(now / 300 + i) * 4
    const wy = roof - 30 + t * FH * 4
    const p = S(wx, wy)
    c.globalAlpha = 1 - t
    c.fillStyle = CONFETTI[i % CONFETTI.length]
    c.fillRect(p.x, p.y, 1.6 * z, (Math.sin(now / 120 + i) > 0 ? 1 : 2.2) * z)
  }
  c.globalAlpha = 1
}

function bunting(c: CanvasRenderingContext2D, g: Game, S: ToScreen, z: number) {
  const top = topFloor(g)
  const span = towerSpan(g, top)
  if (!span) return
  const roof = floorTop(top) + 2
  const a = S(span[0] * T, roof), b = S(span[1] * T, roof)
  const n = Math.max(4, Math.floor((b.x - a.x) / (7 * z)))
  const sag = 4 * z
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(0.5, 0.4 * z)
  c.beginPath(); c.moveTo(a.x, a.y)
  for (let i = 1; i <= n; i++) { const k = i / n; c.lineTo(a.x + (b.x - a.x) * k, a.y + Math.sin(k * Math.PI) * sag) }
  c.stroke()
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n
    const x = a.x + (b.x - a.x) * k, y = a.y + Math.sin(k * Math.PI) * sag
    c.fillStyle = CONFETTI[i % CONFETTI.length]
    c.beginPath(); c.moveTo(x - 2.4 * z, y); c.lineTo(x + 2.4 * z, y); c.lineTo(x, y + 4.5 * z); c.fill()
  }
  // a birthday banner hanging off the top floor
  const mid = S(((span[0] + span[1]) / 2) * T, roof + 6)
  c.font = `900 ${Math.max(8, Math.round(7 * z))}px "Nunito", sans-serif`
  const label = '🎂 HAPPY BIRTHDAY! 🎂'
  const tw = c.measureText(label).width + 8 * z
  c.fillStyle = '#c2255c'; c.fillRect(mid.x - tw / 2, mid.y, tw, 10 * z)
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(label, mid.x, mid.y + 7.6 * z); c.textAlign = 'left'
}

function floatingHearts(c: CanvasRenderingContext2D, g: Game, S: ToScreen, z: number, now: number, W: number, H: number) {
  c.fillStyle = '#ff6b9a'
  for (const f of g.facilities.values()) {
    if (!(f.kind === 'condo' ? f.occupied : isHotel(f.kind) && f.booked)) continue
    for (let i = 0; i < 2; i++) {
      const t = (now / 3200 + hash(f.id * 3 + i)) % 1
      const wx = (f.x + f.width * (0.25 + 0.5 * hash(f.id + i * 11))) * T + Math.sin(now / 500 + i + f.id) * 3
      const p = S(wx, floorTop(f.floor + f.height - 1) + 6 - t * 28)
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue
      c.globalAlpha = Math.sin(t * Math.PI)
      heart(c, p.x, p.y, (1.6 + t) * z)
    }
  }
  c.globalAlpha = 1
}

function splash(c: CanvasRenderingContext2D, W: number, H: number, g: Game, now: number) {
  const m = minuteOfDay(g.time)
  const k = m < 10 ? m / 10 : m > 75 ? (90 - m) / 15 : 1
  const s = 1 + Math.sin(now / 200) * 0.04
  c.save()
  c.globalAlpha = clamp01(k)
  c.translate(W / 2, H * 0.32); c.scale(s, s)
  c.textAlign = 'center'
  c.font = `${Math.round(Math.min(W / 14, 56))}px "Press Start 2P", monospace`
  c.lineWidth = 8; c.strokeStyle = '#1b1033'; c.strokeText('HAPPY NEW YEAR!', 0, 0)
  c.fillStyle = `hsl(${(now / 8) % 360},90%,65%)`; c.fillText('HAPPY NEW YEAR!', 0, 0)
  c.restore()
}

let birthdayFireworks = -1

/** Ambient holiday bits over the whole scene. Returns true when it's time for birthday fireworks. */
export function drawHolidayAmbient(c: CanvasRenderingContext2D, W: number, H: number, g: Game, S: ToScreen, z: number, now: number): boolean {
  if (newYearSplash(g)) splash(c, W, H, g, now)
  const hol = holidayFor(g)
  if (!hol) return false
  const m = minuteOfDay(g.time)
  switch (hol.id) {
    case 'spooky': {
      const k = m < 18 * 60 ? 0 : m < 18.5 * 60 ? (m - 18 * 60) / 30 : m < 21 * 60 ? 1 : clamp01((21.5 * 60 - m) / 30)
      if (k > 0) bats(c, W, H, now, k)
      return false
    }
    case 'snow':
      icicles(c, g, S, z)
      if (m >= 8 * 60 && m < 17 * 60 && z >= 0.6) snowballFight(c, g, S, z, now)
      return false
    case 'heart':
      if (z >= 0.6) floatingHearts(c, g, S, z, now, W, H)
      return false
    case 'birthday': {
      if (m >= 7 * 60) confetti(c, g, S, z, now)
      bunting(c, g, S, z)
      const d = dayOf(g.time)
      if (m >= 20 * 60 && m < 21 * 60 && birthdayFireworks !== d) { birthdayFireworks = d; return true }
      return false
    }
  }
}
