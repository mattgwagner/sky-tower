// Sky Zoo room: three habitats, and the monkey that got out.
import type { Facility, Game } from '../game/state'
import { dayOf, minuteOfDay } from '../game/state'

type Ctx = CanvasRenderingContext2D
const TILE = 8
const FLOOR_PX = 32

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function zooNight(m: number) {
  return m >= 18 * 60 || m < 6 * 60
}

/** Belly of the loose monkey, in world pixels. Shared with the tap target. */
export function looseMonkeyWorld(floor: number, x: number) {
  return { wx: x * TILE, wy: -(floor + 1) * FLOOR_PX - 8 }
}

function penguin(c: Ctx, x: number, y: number, s: number, dir: number, lean: number) {
  c.save()
  c.translate(x, y)
  c.rotate(lean)
  px(c, '#212529', -3 * s, -9 * s, 6 * s, 7 * s)
  px(c, '#f8f9fa', -1.4 * s, -7.2 * s, 3 * s, 4.4 * s)
  px(c, '#ff922b', dir * 2 * s, -6.4 * s, 2 * s, 1.2 * s)
  px(c, '#ffd43b', -2.2 * s, -1.6 * s, 1.4 * s, 1.4 * s)
  px(c, '#ffd43b', 0.8 * s, -1.6 * s, 1.4 * s, 1.4 * s)
  px(c, '#fff', dir > 0 ? 0.4 * s : -1.6 * s, -8.2 * s, 1.1 * s, 1.1 * s)
  c.restore()
}

function giraffe(c: Ctx, x: number, feet: number, head: number, s: number, now: number, asleep: boolean) {
  const sway = Math.sin(now / 900) * 2 * s
  const neckTop = head + 6 * s
  px(c, '#f3d27a', x - 7 * s, feet - 10 * s, 14 * s, 8 * s)
  px(c, '#c92a2a', x - 4 * s, feet - 8 * s, 2 * s, 2 * s)
  px(c, '#c92a2a', x + 2 * s, feet - 6 * s, 2.2 * s, 2 * s)
  px(c, '#f3d27a', x - 5 * s, feet - 2 * s, 2 * s, 2 * s)
  px(c, '#f3d27a', x + 3 * s, feet - 2 * s, 2 * s, 2 * s)
  const nx = x + sway * 0.3
  px(c, '#f3d27a', nx - 2 * s, neckTop, 4 * s, feet - 10 * s - neckTop)
  for (let i = 0; i < 4; i++) px(c, '#c92a2a', nx - 1.2 * s, neckTop + 4 * s + i * 8 * s, 2 * s, 2 * s)
  px(c, '#e8c56b', x - 6 * s + sway, head, 12 * s, 7 * s)
  px(c, '#f3d27a', x + sway, head - 3 * s, 1.2 * s, 3 * s)
  px(c, '#f3d27a', x + 3 * s + sway, head - 2.6 * s, 1.2 * s, 2.6 * s)
  px(c, '#c92a2a', x + 4 * s + sway, head + 2 * s, 3 * s, 2 * s)
  if (asleep) {
    px(c, '#5c4a1a', x - 3 * s + sway, head + 2 * s, 2 * s, 0.6 * s)
    px(c, '#5c4a1a', x + 1 * s + sway, head + 2 * s, 2 * s, 0.6 * s)
  } else {
    px(c, '#212529', x - 3 * s + sway, head + 2 * s, 1.4 * s, 1.6 * s)
    px(c, '#212529', x + 1.2 * s + sway, head + 2 * s, 1.4 * s, 1.6 * s)
  }
  const chew = asleep ? 0 : Math.sin(now / 280)
  px(c, '#f3d27a', x + 6 * s + sway, head + 3 * s, 3 * s, 1.2 * s + Math.max(0, chew) * s)
}

function monkeyBody(c: Ctx, x: number, y: number, s: number, dir: number, sleep: boolean) {
  px(c, '#8d5524', x - 3 * s, y - 8 * s, 6 * s, 5 * s)
  px(c, '#f1c27d', x + dir * 1.2 * s, y - 12 * s, 5 * s, 5 * s)
  px(c, '#8d5524', x + dir * 4 * s, y - 10 * s, 2 * s, 2 * s)
  px(c, '#8d5524', x - dir * 4 * s, y - 6 * s, 3 * s, 1.2 * s)
  const tail = Math.sin(x + y) > 0 ? -1 : 1
  px(c, '#8d5524', x - dir * 3 * s, y - 7 * s, 1.2 * s, 4 * s)
  px(c, '#8d5524', x - dir * 3 * s + tail * s, y - 4 * s, 2 * s, 1.2 * s)
  if (sleep) {
    px(c, '#5c3a16', x + dir * 2 * s, y - 10.2 * s, 1.6 * s, 0.5 * s)
  } else {
    px(c, '#212529', x + dir * 2.2 * s, y - 10.4 * s, 1.1 * s, 1.1 * s)
    px(c, '#fff', x + dir * 2.4 * s, y - 10.6 * s, 0.5 * s, 0.5 * s)
  }
}

function keeper(c: Ctx, x: number, y: number, s: number, dir: number, bucket: boolean) {
  px(c, '#e9c46a', x - 2 * s, y - 12 * s, 4 * s, 4 * s)
  px(c, '#2f9e44', x - 2.4 * s, y - 14 * s, 5 * s, 2 * s)
  px(c, '#d8f3dc', x - 2.2 * s, y - 8 * s, 4.4 * s, 5 * s)
  px(c, '#6b4f3a', x - 2 * s, y - 3 * s, 1.4 * s, 3 * s)
  px(c, '#6b4f3a', x + 0.6 * s, y - 3 * s, 1.4 * s, 3 * s)
  px(c, '#f1c27d', x + dir * 2 * s, y - 8 * s, 1.4 * s, 4 * s)
  if (bucket) {
    px(c, '#868e96', x + dir * 3.2 * s, y - 5 * s, 3 * s, 2.4 * s)
    px(c, '#ffd43b', x + dir * 3.6 * s, y - 6.2 * s, 2 * s, 1.2 * s)
  }
}

/** Scenery for the cached room sprite. Animals are drawn live in drawZoo. */
export function paintZoo(c: Ctx, w: number, h: number, look: 'day' | 'night' | 'vacant' | 'dirty') {
  const night = look === 'night'
  const pen = w / 3
  c.fillStyle = night ? '#1b2a4a' : '#d0ebff'
  c.fillRect(0, 0, w, h)
  px(c, night ? '#243656' : '#a5d8ff', 0, h / 2 - 8, pen, 8)
  px(c, night ? '#16324f' : '#e7f5ff', 2, 18, pen - 16, 8)
  c.fillStyle = night ? '#4dabf7' : '#b6e3ff'
  c.beginPath()
  c.moveTo(8, 22)
  c.lineTo(pen - 14, h - 20)
  c.lineTo(pen - 6, h - 14)
  c.lineTo(16, 26)
  c.fill()
  c.fillStyle = night ? '#1864ab' : '#1c7ed6'
  c.beginPath()
  c.ellipse(pen - 16, h - 12, 16, 7, 0, 0, Math.PI * 2)
  c.fill()
  px(c, 'rgba(255,255,255,0.55)', pen - 26, h - 14, 8, 1.4)
  px(c, night ? '#8a6a32' : '#ffe8a3', pen, h / 2, pen, h / 2 - 3)
  px(c, '#2f9e44', pen + 8, h - 8, 3, 2)
  px(c, '#2f9e44', pen + 16, h - 9, 4, 2)
  px(c, '#8d6e4f', pen * 2 - 16, h / 2 + 6, 3, h / 2 - 10)
  c.fillStyle = '#2b8a3e'
  c.beginPath()
  c.ellipse(pen * 2 - 14, h / 2 + 4, 12, 5, 0, 0, Math.PI * 2)
  c.fill()
  px(c, night ? '#1b4332' : '#2b8a3e', pen * 2, h / 2, pen, h / 2 - 3)
  px(c, '#2f9e44', pen * 2 + 6, 10, 2, h / 2)
  px(c, '#69db7c', pen * 2 + 2, 16, 8, 2)
  px(c, '#ffd43b', pen * 2 + 10, 14, 3, 1.2)
  px(c, '#ffd43b', pen * 2 + 12, 17, 3, 1.2)
  px(c, '#fab005', pen * 2 + 11, 20, 3, 1.2)
  const tx = pen * 2 + pen * 0.55
  c.strokeStyle = '#868e96'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(tx, 8)
  c.lineTo(tx, h - 28)
  c.stroke()
  for (const x of [pen, pen * 2]) px(c, '#6b4f3a', x - 2, 8, 4, h - 11)
  px(c, '#868e96', 0, h / 2 - 1, w, 2)
  const railX = pen + 4
  px(c, '#dee2e6', railX, h / 2 - 10, pen - 8, 2)
  for (let x = railX + 2; x < pen * 2 - 6; x += 6) px(c, '#adb5bd', x, h / 2 - 10, 1.2, 8)
  px(c, '#5c4a32', 0, h - 3, w, 3)
  if (night) {
    c.fillStyle = 'rgba(5,10,28,0.38)'
    c.fillRect(0, 0, w, h)
  }
  px(c, '#2b8a3e', pen / 2 - 26, 3, 52, 8)
  c.fillStyle = '#fff'
  c.font = 'bold 6px monospace'
  c.textAlign = 'center'
  c.fillText('SKY ZOO', pen / 2, 9)
  c.textAlign = 'left'
}

export function drawZoo(c: Ctx, _g: Game, _f: Facility, p: { x: number; y: number }, w: number, h: number, z: number, now: number, m: number) {
  const pen = w / 3
  const night = zooNight(m)
  const ramp0 = { x: p.x + 12 * z, y: p.y + 24 * z }
  const ramp1 = { x: p.x + pen - 18 * z, y: p.y + h - 18 * z }
  if (!night) {
    for (let i = 0; i < 4; i++) {
      const phase = ((now + i * 700) % 2800) / 2800
      if (phase < 0.72) {
        const k = phase / 0.72
        penguin(c, ramp0.x + (ramp1.x - ramp0.x) * k, ramp0.y + (ramp1.y - ramp0.y) * k, z * 1.35, 1, 0.6)
      } else {
        const bob = Math.sin(now / 180 + i) * z
        penguin(c, p.x + pen - 22 * z + (i % 2) * 6 * z, p.y + h - 12 * z + bob, z * 0.85, i % 2 ? 1 : -1, 0)
        if (i === 0) {
          c.fillStyle = 'rgba(255,255,255,0.7)'
          c.fillRect(p.x + pen - 10 * z, p.y + h - 20 * z - ((now / 40) % 8) * z, z, z)
        }
      }
    }
  } else {
    for (let i = 0; i < 5; i++) {
      penguin(c, p.x + 10 * z + i * 4.2 * z, p.y + h - 14 * z - (i % 2) * 2 * z, z * 0.9, i < 2 ? -1 : 1, 0)
    }
  }
  const gx = p.x + pen + pen * 0.42
  giraffe(c, gx, p.y + h - 4 * z, p.y + 8 * z, z, now, night)
  const tx = p.x + pen * 2 + pen * 0.55
  const tyreY = p.y + h - 22 * z
  if (!night) {
    const ang = Math.sin(now / 520) * 0.7
    const sx = tx + Math.sin(ang) * 10 * z
    const sy = tyreY + (1 - Math.cos(ang)) * 4 * z
    c.strokeStyle = '#868e96'
    c.lineWidth = Math.max(1, z)
    c.beginPath()
    c.moveTo(tx, p.y + 8 * z)
    c.lineTo(sx, sy - 6 * z)
    c.stroke()
    c.strokeStyle = '#212529'
    c.lineWidth = Math.max(2, 2.4 * z)
    c.beginPath()
    c.arc(sx, sy, 6 * z, 0, Math.PI * 2)
    c.stroke()
    monkeyBody(c, sx, sy + 2 * z, z, ang > 0 ? 1 : -1, false)
    monkeyBody(c, p.x + pen * 2 + 12 * z, p.y + h - 8 * z, z * 0.9, 1, false)
    px(c, '#ffd43b', p.x + pen * 2 + 16 * z, p.y + h - 14 * z, 3 * z, 1.2 * z)
  } else {
    for (let i = 0; i < 4; i++) {
      monkeyBody(c, p.x + pen * 2 + 10 * z + (i % 3) * 6 * z, p.y + h - 8 * z - (i > 2 ? 4 : 0) * z, z * 0.85, 1, true)
    }
    c.fillStyle = '#fff'
    c.font = `${Math.round(5 * z)}px sans-serif`
    c.fillText('z', p.x + pen * 2 + 28 * z, p.y + h - 18 * z - ((now / 80) % 6) * z)
  }
  if (!night) {
    const span = w - 24 * z
    const t = (now % 14000) / 14000
    const tri = t < 0.5 ? t * 2 : (1 - t) * 2
    const dir = t < 0.5 ? 1 : -1
    keeper(c, p.x + 12 * z + tri * span, p.y + h - 6 * z, z, dir, true)
  }
}

export function drawLooseMonkey(c: Ctx, g: Game, S: (x: number, y: number) => { x: number; y: number }, z: number, now: number) {
  if (z < 0.5) return
  const day = dayOf(g.time)
  const m = minuteOfDay(g.time)
  for (const peel of g.flags.peels ?? []) {
    if (peel.day !== day && !(peel.day === day - 1 && m < 6 * 60)) continue
    const p = S(peel.x * TILE, -(peel.floor + 1) * FLOOR_PX + FLOOR_PX - 10)
    px(c, '#f08c00', p.x, p.y, 5 * z, 2.2 * z)
    px(c, '#ffd43b', p.x + 0.6 * z, p.y - 0.6 * z, 3.2 * z, 1.6 * z)
    px(c, '#fab005', p.x + 3.2 * z, p.y - 2.4 * z, 2.2 * z, 2.2 * z)
  }
  const carry = g.flags.monkeyCarry
  if (carry && g.time < carry.until) {
    const k = Math.min(1, (g.time - carry.start) / Math.max(1, carry.until - carry.start))
    const x = carry.x + (carry.zooX - carry.x) * k
    const y0 = -(carry.floor + 1) * FLOOR_PX
    const y1 = -(carry.zooFloor + 1) * FLOOR_PX
    const p = S(x * TILE, y0 + (y1 - y0) * k)
    const dir = carry.zooX >= carry.x ? 1 : -1
    keeper(c, p.x, p.y, z * 1.3, dir, false)
    monkeyBody(c, p.x + dir * 7 * z, p.y - 6 * z, z, dir, false)
  }
  const mk = g.flags.monkey
  if (!mk) return
  const spot = looseMonkeyWorld(mk.floor, mk.x)
  const p = S(spot.wx, spot.wy + 10)
  const bob = Math.sin(now / 400) * z
  const s = z * 1.65
  monkeyBody(c, p.x, p.y + bob, s, 1, false)
  px(c, '#ffe066', p.x + 5 * s, p.y - 6 * s + bob, 3.4 * s, 1.5 * s)
  px(c, '#fab005', p.x + 7 * s, p.y - 7.2 * s + bob, 1.5 * s, 1.5 * s)
  px(c, '#fff', p.x + 8 * s, p.y - 14 * s + bob, 1.8 * s, 1.8 * s)
}
