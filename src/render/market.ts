// Indoor food market: four stands under striped awnings, queues, and a sign that follows the clock.
import type { Facility, Game, Person } from '../game/state'
import { grillLit, marketPhase, marketSign, standFor } from '../game/market'

type Ctx = CanvasRenderingContext2D

const STAND_X = [8, 66, 124, 182] as const
const STAND_W = 50
const SHIRTS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#9c36b5', '#0ca678', '#e64980', '#495057']
const AWNING: [string, string][] = [
  ['#e03131', '#fff'],
  ['#f76707', '#fff4e6'],
  ['#c92a2a', '#ffd43b'],
  ['#fab005', '#fff'],
]
const APRON = ['#2f9e44', '#e03131', '#1c7ed6', '#f08c00']

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function awning(c: Ctx, x: number, a: string, b: string) {
  for (let i = 0; i < STAND_W; i += 4) px(c, (i / 4) % 2 ? a : b, x + i, 12, 4, 4)
  px(c, '#343a40', x, 16, STAND_W, 1)
}

function counter(c: Ctx, x: number, h: number) {
  px(c, '#8d6e4f', x + 2, h - 14, STAND_W - 4, 10)
  px(c, '#5c4632', x + 2, h - 14, STAND_W - 4, 2)
}

function vendor(c: Ctx, x: number, h: number, apron: string) {
  px(c, '#f1c27d', x + 6, h - 19, 5, 4)
  px(c, apron, x + 5, h - 15, 7, 3)
  px(c, '#212529', x + 7, h - 18, 1, 1)
  px(c, '#212529', x + 9, h - 18, 1, 1)
}

function fruit(c: Ctx, x: number, h: number) {
  const cols = ['#fa5252', '#ffd43b', '#51cf66', '#ff922b', '#e64980']
  const base = h - 16
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3 - row; i++) px(c, cols[(i + row) % cols.length], x + 14 + i * 4 + row * 2, base - row * 3, 3, 3)
  }
  px(c, '#2f9e44', x + 28, base - 4, 8, 5)
  px(c, '#fa5252', x + 29, base - 3, 6, 3)
  px(c, '#212529', x + 30, base - 2, 1, 1)
  px(c, '#212529', x + 33, base - 2, 1, 1)
}

function grill(c: Ctx, x: number, h: number) {
  px(c, '#343a40', x + 14, h - 15, 28, 4)
  px(c, '#212529', x + 14, h - 16, 28, 2)
  for (let i = 0; i < 6; i++) px(c, '#868e96', x + 16 + i * 4, h - 17, 1, 2)
}

function baskets(c: Ctx, x: number, h: number) {
  for (let i = 0; i < 2; i++) {
    const y = h - 15 - i * 4
    px(c, '#e6c07b', x + 16, y, 18, 4)
    px(c, '#8d6e4f', x + 16, y, 18, 1)
    px(c, '#fff6e0', x + 18, y + 1, 14, 2)
  }
}

function lemonade(c: Ctx, x: number, h: number) {
  px(c, '#fff3bf', x + 14, h - 21, 10, 8)
  px(c, '#ffe066', x + 16, h - 23, 6, 3)
  px(c, '#fff', x + 15, h - 19, 2, 5)
  px(c, '#fab005', x + 26, h - 16, 4, 3)
  px(c, '#fab005', x + 30, h - 18, 4, 3)
  px(c, '#fff', x + 36, h - 20, 7, 6)
  px(c, '#ffd43b', x + 37, h - 19, 5, 4)
  px(c, '#74c0fc', x + 39, h - 23, 1, 4)
}

function cloth(c: Ctx, x: number, h: number) {
  for (let i = 0; i < STAND_W - 8; i += 4) px(c, (i / 4) % 2 ? '#d0ebff' : '#fff', x + 6, h - 17, 4, 5)
}

const STAND_GOODS = [fruit, grill, baskets, lemonade]

export function paintMarket(c: Ctx, w: number, h: number, look: 'day' | 'night' | 'vacant' | 'dirty') {
  const dark = look === 'night'
  px(c, dark ? '#2a241c' : '#fff6e8', 0, 0, w, h)
  px(c, dark ? '#3a3228' : '#f3e0c4', 0, h - 12, w, 9)
  px(c, '#3a3a46', 0, 0, w, 2)
  for (let x = 0; x < w; x += 8) px(c, (x / 8) % 2 ? (dark ? '#5c4632' : '#e6d3b0') : (dark ? '#4a3828' : '#f6e6cc'), x, h - 4, 8, 4)
  c.strokeStyle = '#495057'
  c.lineWidth = 0.6
  c.beginPath()
  c.moveTo(4, 4)
  for (let i = 0; i < 12; i++) c.lineTo(12 + i * 19, 4 + (i % 2 ? 3 : 0))
  c.stroke()
  for (let i = 0; i < 12; i++) px(c, dark ? '#6b5a30' : '#ffe066', 11 + i * 19, 4 + (i % 2 ? 3 : 0), 2, 2)
  px(c, '#222', w / 2 - 48, 3, 96, 8)
  for (let s = 0; s < STAND_X.length; s++) {
    const x = STAND_X[s]
    awning(c, x, AWNING[s][0], AWNING[s][1])
    vendor(c, x, h, APRON[s])
    counter(c, x, h)
    if (dark) cloth(c, x, h)
    else STAND_GOODS[s](c, x, h)
  }
}

function shopper(c: Ctx, x: number, yBottom: number, u: number, shirt: number, frame: number) {
  c.fillStyle = '#2b2b38'
  if (frame) {
    c.fillRect(x - u, yBottom - 3 * u, u, 3 * u)
    c.fillRect(x + u, yBottom - 3 * u, u, 3 * u)
  } else c.fillRect(x, yBottom - 3 * u, u * 1.4, 3 * u)
  c.fillStyle = SHIRTS[Math.abs(shirt) % SHIRTS.length]
  c.fillRect(x - u, yBottom - 7 * u, 3 * u, 4 * u)
  c.fillStyle = '#f1c27d'
  c.fillRect(x - 0.5 * u, yBottom - 9.5 * u, 2.2 * u, 2.4 * u)
}

function puff(c: Ctx, x: number, y: number, z: number, now: number, n: number, color: string) {
  c.fillStyle = color
  for (let i = 0; i < n; i++) {
    const k = (now / 1400 + i / n) % 1
    c.beginPath()
    c.arc(x + Math.sin(now / 320 + i) * 3 * z, y - k * 8 * z, (1.6 + k * 2.2) * z, 0, Math.PI * 2)
    c.fill()
  }
}

export function drawMarket(
  c: Ctx, g: Game, f: Facility,
  p: { x: number; y: number }, w: number, h: number, z: number, now: number, m: number,
) {
  const phase = marketPhase(m)
  const open = phase !== 'closed'
  const X = (sx: number) => p.x + sx * z
  const Y = (sy: number) => p.y + sy * z
  const H = h / z

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `bold ${Math.round(6 * z)}px monospace`
  c.fillStyle = phase === 'night' ? '#ffe066' : '#fff'
  c.fillText(marketSign(phase), X(w / z / 2), Y(7))
  c.textAlign = 'left'
  c.textBaseline = 'alphabetic'

  if (phase === 'night') {
    for (let i = 0; i < 11; i++) {
      const bx = 16 + i * 20
      const by = 5 + (i % 2 ? 2 : 0)
      const on = 0.55 + 0.45 * Math.abs(Math.sin(now / 260 + i))
      c.fillStyle = `rgba(255, 214, 120, ${0.22 * on})`
      c.beginPath()
      c.arc(X(bx), Y(by + 3), 5 * z, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = `rgba(255, 244, 190, ${on})`
      c.fillRect(X(bx - 1), Y(by), 2 * z, 2 * z)
    }
    for (const lx of [59, 117, 175]) {
      const sway = Math.sin(now / 700 + lx) * z
      c.fillStyle = '#868e96'
      c.fillRect(X(lx + 2) + sway, Y(4), z, 4 * z)
      c.fillStyle = '#ff6b6b'
      c.fillRect(X(lx) + sway, Y(8), 6 * z, 7 * z)
      c.fillStyle = '#ffd43b'
      c.fillRect(X(lx) + sway, Y(10), 6 * z, 1.4 * z)
      c.fillStyle = 'rgba(255, 180, 80, 0.28)'
      c.beginPath()
      c.arc(X(lx + 3) + sway, Y(12), 6 * z, 0, Math.PI * 2)
      c.fill()
    }
  }

  const grillX = STAND_X[1]
  if (grillLit(phase)) {
    const bite = ['#e8590c', '#ffd43b', '#c92a2a', '#51cf66']
    for (let i = 0; i < 4; i++) {
      px(c, '#8d6e4f', X(grillX + 18 + i * 6), Y(H - 21), z, 6 * z)
      px(c, bite[i], X(grillX + 17 + i * 6), Y(H - 23), 3 * z, 3 * z)
    }
    for (let i = 0; i < 4; i++) {
      const fh = (3 + Math.sin(now / 80 + i * 1.7) * 1.5) * z
      c.fillStyle = i % 2 ? '#ff922b' : '#ffd43b'
      c.beginPath()
      c.moveTo(X(grillX + 18 + i * 5), Y(H - 17))
      c.lineTo(X(grillX + 19.5 + i * 5), Y(H - 17) - fh)
      c.lineTo(X(grillX + 21 + i * 5), Y(H - 17))
      c.fill()
    }
    puff(c, X(grillX + 28), Y(H - 22), z, now, 3, 'rgba(90,90,90,0.4)')
  } else if (open) {
    for (let i = 0; i < 8; i++) px(c, i % 2 ? '#d0ebff' : '#fff', X(grillX + 14 + i * 3), Y(H - 18), 3 * z, 4 * z)
  }

  if (open) puff(c, X(STAND_X[2] + 22), Y(H - 20), z, now + 400, 3, 'rgba(255,255,255,0.8)')

  const lines: Person[][] = [[], [], [], []]
  for (const visitor of g.people.values()) {
    if (visitor.state === 'inside' && visitor.at === f.id) lines[standFor(visitor.id, phase)].push(visitor)
  }
  for (let s = 0; s < lines.length; s++) {
    const cap = phase === 'morning' ? (s === 0 || s === 3 ? 5 : 2) : phase === 'night' ? (s === 1 ? 5 : 3) : 4
    const line = lines[s].sort((a, b) => a.id - b.id).slice(0, cap)
    for (let i = 0; i < line.length; i++) {
      const bob = Math.sin(now / 300 + line[i].id) > 0.65 ? 1 : 0
      shopper(c, X(STAND_X[s] + 20 + i * 6), p.y + h - z, z, line[i].shirt, bob)
    }
  }
}
