// Sky Playground: open-air equipment on a roof. The cached sprite is the structure;
// swings, the merry-go-round, the seesaw, kids, kites and weather are drawn live.
import type { Facility, Game } from '../game/state'
import { playgroundCart, playgroundKids, playgroundSwing } from '../game/playground'
import { weatherFor } from './sky-fx'

type Ctx = CanvasRenderingContext2D

const SHIRTS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#9c36b5', '#0ca678']

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

/** Scenery for the cached room sprite. Moving parts are drawn in drawPlayground. */
export function paintPlayground(c: Ctx, w: number, h: number, look: 'day' | 'night' | 'vacant' | 'dirty') {
  const night = look === 'night'
  c.fillStyle = night ? '#1b2a4a' : '#d0ebff'
  c.fillRect(0, 0, w, h)
  if (!night) {
    px(c, '#fff', 6, 4, 12, 3)
    px(c, '#fff', w - 30, 6, 16, 3)
  }
  const mats = ['#e8590c', '#f76707', '#ffd43b', '#fa5252']
  for (let x = 0; x < w; x += 8) px(c, night ? '#5c3d2e' : mats[(x / 8) % 4], x, h - 8, 8, 8)
  px(c, night ? '#3d2914' : '#c92a2a', 0, h - 2, w, 2)

  // swing frames
  for (const x of [16, 36]) {
    px(c, '#495057', x, 8, 2, 16)
    px(c, '#495057', x + 12, 8, 2, 16)
    px(c, '#495057', x, 8, 14, 2)
  }
  // merry-go-round platform and pole
  c.fillStyle = night ? '#862e9c' : '#ff8787'
  c.beginPath()
  c.ellipse(64, 22, 12, 4, 0, 0, Math.PI * 2)
  c.fill()
  px(c, '#fff', 63, 11, 2, 11)
  // seesaw fulcrum
  c.fillStyle = '#495057'
  c.beginPath()
  c.moveTo(96, 18)
  c.lineTo(100, 26)
  c.lineTo(92, 26)
  c.fill()
  // twisty slide
  px(c, '#868e96', 108, 8, 1.4, 16)
  px(c, '#868e96', 114, 8, 1.4, 16)
  for (let y = 10; y < 22; y += 4) px(c, '#868e96', 108, y, 7, 1)
  px(c, '#4dabf7', 112, 7, 12, 4)
  px(c, '#ffd43b', 116, 11, 12, 4)
  px(c, '#ff6b6b', 112, 15, 12, 4)
  px(c, '#4dabf7', 116, 19, 10, 4)
  // monkey bars
  px(c, '#495057', 130, 10, 2, 14)
  px(c, '#495057', 144, 10, 2, 14)
  for (let y = 10; y <= 16; y += 3) px(c, '#868e96', 130, y, 16, 1.2)
  // sandbox and bucket
  px(c, night ? '#8d6e4f' : '#e6c07b', 150, 21, 10, 7)
  px(c, '#c4a35a', 150, 20, 10, 1.6)
  px(c, '#1c7ed6', 155, 16, 4, 5)
  px(c, '#74c0fc', 155, 15, 4, 1.4)

  px(c, '#2f9e44', w / 2 - 14, 1, 28, 6)
  c.fillStyle = '#fff'
  c.font = 'bold 5px monospace'
  c.textAlign = 'center'
  c.fillText('PLAY', w / 2, 6)
  c.textAlign = 'left'
  if (night) {
    c.fillStyle = 'rgba(5,10,28,0.28)'
    c.fillRect(0, 0, w, h)
  }
}

function kid(c: Ctx, x: number, ySeat: number, z: number, shirt: string) {
  const s = z
  px(c, '#364fc7', x - 2 * s, ySeat, 1.3 * s, 3 * s)
  px(c, '#364fc7', x + 0.7 * s, ySeat, 1.3 * s, 3 * s)
  px(c, shirt, x - 2.2 * s, ySeat - 4 * s, 4.4 * s, 4 * s)
  px(c, '#f1c27d', x - 1.6 * s, ySeat - 6.6 * s, 3.2 * s, 2.8 * s)
  px(c, '#3b2a1a', x - 1.8 * s, ySeat - 7.2 * s, 3.6 * s, 1.2 * s)
}

function drawSwing(c: Ctx, pivotX: number, pivotY: number, z: number, ang: number, withKid: boolean, shirt: string) {
  const len = 13 * z
  const x = pivotX + Math.sin(ang) * len
  const y = pivotY + Math.cos(ang) * len
  c.strokeStyle = '#868e96'
  c.lineWidth = Math.max(1, z)
  c.beginPath()
  c.moveTo(pivotX, pivotY)
  c.lineTo(x, y)
  c.stroke()
  px(c, '#e8590c', x - 3.2 * z, y - 0.6 * z, 6.4 * z, 1.6 * z)
  if (withKid) kid(c, x, y, z * 0.85, shirt)
}

function drawCarousel(c: Ctx, cx: number, cy: number, z: number, spin: number, withKid: boolean, shirt: string) {
  c.fillStyle = '#ffd43b'
  c.beginPath()
  c.ellipse(cx, cy + 4 * z, 12 * z, 4 * z, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#f783ac'
  c.beginPath()
  c.ellipse(cx, cy + 4 * z, 12 * z, 4 * z, spin, 0, Math.PI)
  c.fill()
  const colors = ['#e03131', '#1c7ed6', '#fff', '#2f9e44']
  for (let i = 0; i < 4; i++) {
    const a = spin + (i * Math.PI) / 2
    const hx = cx + Math.cos(a) * 8 * z
    const hy = cy + Math.sin(a) * 2.2 * z
    const bob = Math.sin(spin * 3 + i) * 1.4 * z
    px(c, '#fff', hx - 0.4 * z, hy - 8 * z + bob, z, 10 * z)
    px(c, colors[i], hx - 2.6 * z, hy - 3 * z + bob, 5.2 * z, 2.4 * z)
    px(c, colors[i], hx + 1.6 * z, hy - 4.2 * z + bob, 1.6 * z, 1.4 * z)
    if (withKid && i === 0) kid(c, hx, hy - 3 * z + bob, z * 0.72, shirt)
  }
}

function drawSeesaw(c: Ctx, ox: number, oy: number, z: number, tilt: number, withKids: boolean) {
  c.save()
  c.translate(ox, oy)
  c.rotate(tilt)
  px(c, '#e03131', -12 * z, -1.2 * z, 24 * z, 2.4 * z)
  px(c, '#ffd43b', -12 * z, -1.2 * z, 3 * z, 2.4 * z)
  px(c, '#ffd43b', 9 * z, -1.2 * z, 3 * z, 2.4 * z)
  if (withKids) {
    kid(c, -8 * z, -1.2 * z, z * 0.72, SHIRTS[1])
    kid(c, 8 * z, -1.2 * z, z * 0.72, SHIRTS[3])
  }
  c.restore()
}

function drawKite(c: Ctx, x: number, y: number, z: number, color: string, now: number, phase: number, anchorX: number, anchorY: number) {
  const kx = x + Math.sin(now / 900 + phase) * 8 * z
  const ky = y + Math.sin(now / 700 + phase) * 5 * z
  c.strokeStyle = 'rgba(255,255,255,0.75)'
  c.lineWidth = Math.max(1, z * 0.5)
  c.beginPath()
  c.moveTo(kx, ky + 4 * z)
  c.lineTo(anchorX, anchorY)
  c.stroke()
  c.fillStyle = color
  c.beginPath()
  c.moveTo(kx, ky - 4 * z)
  c.lineTo(kx + 3.2 * z, ky)
  c.lineTo(kx, ky + 4 * z)
  c.lineTo(kx - 3.2 * z, ky)
  c.fill()
  px(c, '#fff', kx - 0.4 * z, ky - 3 * z, 0.8 * z, 6 * z)
  for (let i = 1; i <= 3; i++) px(c, color, kx - 0.7 * z + Math.sin(now / 200 + i) * z, ky + (4 + i * 2.2) * z, 1.4 * z, 1.4 * z)
}

function drawNet(c: Ctx, x: number, y: number, w: number, h: number, z: number) {
  c.save()
  c.beginPath()
  c.rect(x, y, w, h)
  const edge = 7 * z
  c.rect(x + edge, y + 2 * z, w - edge * 2, h)
  c.clip('evenodd')
  c.strokeStyle = 'rgba(73,80,87,0.55)'
  c.lineWidth = Math.max(1, z * 0.6)
  for (let i = x; i < x + w; i += 4 * z) {
    c.beginPath()
    c.moveTo(i, y)
    c.lineTo(i + 8 * z, y + h)
    c.moveTo(i, y + h)
    c.lineTo(i + 8 * z, y)
    c.stroke()
  }
  c.restore()
  px(c, '#868e96', x, y + 2 * z, 1.4 * z, h - 2 * z)
  px(c, '#868e96', x + w - 1.4 * z, y + 2 * z, 1.4 * z, h - 2 * z)
  px(c, '#868e96', x, y + 2 * z, w, 1.2 * z)
}

export function drawPlayground(
  c: Ctx, g: Game, f: Facility, p: { x: number; y: number }, w: number, h: number, z: number, now: number, m: number,
) {
  const weather = weatherFor(g)
  const closed = m >= 19 * 60 || m < 8 * 60
  const dark = m >= 19 * 60 || m < 6 * 60
  const kids = !weather.rain && !closed ? playgroundKids(f.inside) : 0
  const still = closed || weather.rain

  drawSwing(c, p.x + 23 * z, p.y + 8 * z, z, playgroundSwing(now, 0), kids >= 1, SHIRTS[0])
  drawSwing(c, p.x + 43 * z, p.y + 8 * z, z, playgroundSwing(now, 1.4), kids >= 2, SHIRTS[4])

  const spin = still ? 0.4 : now / 420
  drawCarousel(c, p.x + 64 * z, p.y + 18 * z, z, spin, kids >= 3, SHIRTS[2])

  const tilt = still ? 0 : Math.sin(now / 520) * (kids >= 4 ? 0.42 : 0.22)
  drawSeesaw(c, p.x + 96 * z, p.y + 22 * z, z, tilt, kids >= 4)

  if (kids >= 5) {
    const t = (now % 2200) / 2200
    const sy = p.y + (8 + t * 14) * z
    const sx = p.x + (118 + Math.sin(t * Math.PI * 3) * 3) * z
    kid(c, sx, sy, z * 0.7, SHIRTS[5])
  }
  if (kids >= 6) {
    const t = (now % 1800) / 1800
    const along = t < 0.5 ? t * 2 : (1 - t) * 2
    const bx = p.x + (132 + along * 12) * z
    const by = p.y + 12 * z
    px(c, SHIRTS[3], bx - z, by, 2 * z, 3.2 * z)
    px(c, '#f1c27d', bx - 0.7 * z, by + 3 * z, 1.6 * z, 1.6 * z)
    px(c, '#3b2a1a', bx - 0.8 * z, by + 2.6 * z, 1.8 * z, 0.7 * z)
  }

  if (weather.rain) {
    c.fillStyle = 'rgba(116,192,252,0.9)'
    for (const [dx, rw] of [[28, 14], [72, 18], [120, 12]] as const) {
      c.beginPath()
      c.ellipse(p.x + dx * z, p.y + h - 5 * z, rw * z, 2.4 * z, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgba(255,255,255,0.7)'
      c.fillRect(p.x + (dx - rw * 0.4) * z, p.y + h - 6 * z, rw * 0.5 * z, 0.8 * z)
      c.fillStyle = 'rgba(116,192,252,0.9)'
    }
  }

  if (weather.snow) {
    const sx = p.x + 155 * z
    const sy = p.y + h - 7 * z
    c.fillStyle = '#fff'
    c.beginPath(); c.arc(sx, sy, 2.8 * z, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(sx, sy - 4.2 * z, 2 * z, 0, Math.PI * 2); c.fill()
    px(c, '#212529', sx - 2.2 * z, sy - 6.6 * z, 4.4 * z, 1.1 * z)
    px(c, '#212529', sx - 1.3 * z, sy - 8.4 * z, 2.6 * z, 2 * z)
    px(c, '#e8590c', sx + 0.6 * z, sy - 4.6 * z, 2.2 * z, 0.7 * z)
  }

  if (playgroundCart(g)) {
    const span = Math.max(8 * z, w - 22 * z)
    const cx = p.x + 6 * z + ((now / 40) % span)
    const cy = p.y + h - 14 * z
    px(c, '#fff', cx, cy, 14 * z, 8 * z)
    px(c, '#ff922b', cx, cy, 14 * z, 2.4 * z)
    px(c, '#212529', cx + z, cy + 5 * z, 2 * z, 2 * z)
    px(c, '#212529', cx + 7 * z, cy + 5 * z, 2 * z, 2 * z)
    c.fillStyle = '#f783ac'
    c.beginPath()
    c.arc(cx + 5 * z, cy - 1.6 * z, 2 * z, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#e8a85c'
    c.beginPath()
    c.moveTo(cx + 3.4 * z, cy - 0.2 * z)
    c.lineTo(cx + 6.6 * z, cy - 0.2 * z)
    c.lineTo(cx + 5 * z, cy + 2.4 * z)
    c.fill()
  }

  // No wind field on weatherFor, so the kites fly whenever the playground is up.
  drawKite(c, p.x + w * 0.28, p.y - 16 * z, z, '#ff6b6b', now, 0, p.x + 23 * z, p.y + 8 * z)
  drawKite(c, p.x + w * 0.62, p.y - 26 * z, z, '#4dabf7', now, 2, p.x + 96 * z, p.y + 10 * z)

  if (dark && !weather.rain) {
    for (let i = 0; i < 3; i++) {
      const fx = p.x + w * (0.22 + 0.22 * i) + Math.sin(now / 640 + i * 2) * 8 * z
      const fy = p.y + 6 * z + Math.sin(now / 380 + i) * 4 * z
      c.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 180 + i * 1.7))
      px(c, '#fff3bf', fx - z, fy - z, 3.2 * z, 3.2 * z)
      px(c, '#ffe066', fx, fy, 1.6 * z, 1.6 * z)
    }
    c.globalAlpha = 1
  }

  drawNet(c, p.x, p.y, w, h, z)
}
