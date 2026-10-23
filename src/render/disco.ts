// Disco room. Furniture is cached; the floor, dancers, lasers and sign are drawn live.
import {
  danceOffNow, discoBeat, discoBubbling, discoDancerCount, discoFlashTile, discoFrozen, discoMode,
  discoSpinSlot, moveAt,
} from '../game/disco'
import type { Move } from '../game/disco'
import type { Facility, Game } from '../game/state'

type Ctx = CanvasRenderingContext2D
type Look = 'day' | 'night' | 'vacant' | 'dirty'

const QUIET = new Set(['floor', 'lobby', 'stairs', 'escalator', 'firePole', 'megaSlide', 'parking'])
const SHIRTS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#9c36b5', '#0ca678', '#e64980', '#495057']

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

export function paintDisco(c: Ctx, w: number, h: number, _look: Look) {
  const mid = h / 2
  px(c, '#1a1030', 0, 0, w, h)
  px(c, '#2a1848', 0, mid, w, h - mid)
  px(c, '#0d0718', 0, 0, w, 3)
  px(c, '#120c1c', 0, h - 4, w, 4)
  // speaker stacks, left side, both floors
  for (const y of [8, mid + 6]) {
    px(c, '#212529', 4, y, 14, 18)
    px(c, '#343a40', 6, y + 2, 10, 6)
    px(c, '#868e96', 8, y + 4, 6, 3)
    px(c, '#495057', 6, y + 10, 10, 6)
  }
  // bubble machine
  px(c, '#1864ab', w - 72, mid + 8, 12, 14)
  px(c, '#74c0fc', w - 70, mid + 6, 8, 4)
  px(c, '#a5d8ff', w - 68, mid + 4, 3, 3)
  // fog box on the floor
  px(c, '#495057', 22, h - 12, 16, 8)
  px(c, '#dee2e6', 24, h - 14, 8, 3)
  // DJ booth and turntables
  const bx = w - 50
  px(c, '#111', bx, mid + 10, 44, h - mid - 14)
  px(c, '#2b2b38', bx + 4, mid + 14, 36, 6)
  px(c, '#111', bx + 7, mid + 15, 10, 4)
  px(c, '#111', bx + 24, mid + 15, 10, 4)
  px(c, '#f8f9fa', bx + 10, mid + 16, 4, 2)
  px(c, '#f8f9fa', bx + 27, mid + 16, 4, 2)
  px(c, '#212529', bx + 18, mid + 2, 8, 8)
  px(c, '#e0ac69', bx + 19, mid - 2, 6, 5)
  px(c, '#fa5252', bx + 17, mid - 1, 10, 2)
  px(c, '#fa5252', bx + 17, mid, 2, 3)
  px(c, '#fa5252', bx + 25, mid, 2, 3)
  // mirror ball
  const mx = Math.floor(w / 2)
  px(c, '#868e96', mx, 2, 1, 6)
  px(c, '#e9ecef', mx - 5, 8, 10, 10)
  px(c, '#fff', mx - 3, 10, 2, 2)
  px(c, '#ced4da', mx + 1, 13, 2, 2)
  // marquee
  px(c, '#111', 28, 6, 78, 12)
  px(c, '#3b0764', 30, 8, 74, 8)
}

export function drawFeverLights(
  c: Ctx, kind: string, p: { x: number; y: number }, w: number, h: number, z: number, now: number, id: number,
) {
  if (QUIET.has(kind)) return
  const floors = Math.max(1, Math.round(h / (32 * z)))
  c.save()
  c.globalAlpha = 0.34 + 0.28 * Math.abs(Math.sin(now / 90 + id))
  for (let i = 0; i < floors; i++) {
    c.fillStyle = `hsl(${(now / 6 + id * 37 + i * 48) % 360}, 100%, 62%)`
    c.fillRect(p.x + 4 * z, p.y + i * 32 * z + 5 * z, Math.max(z, w - 8 * z), 8 * z)
  }
  c.restore()
}

function dancer(c: Ctx, x: number, y: number, z: number, shirt: string, move: Move, now: number, i: number) {
  const s = z
  if (move === 'worm') {
    const wiggle = Math.sin(now / 120 + i) * 2 * s
    px(c, shirt, x + wiggle, y - 4 * s, 10 * s, 3 * s)
    px(c, '#f1c27d', x + 8 * s + wiggle, y - 6 * s, 3 * s, 3 * s)
    return
  }
  const hop = move === 'jump' ? Math.abs(Math.sin(now / 160 + i)) * 8 * s : 0
  const squash = move === 'spin' ? Math.sin(now / 140 + i) : 1
  c.save()
  c.translate(x, y - hop)
  c.scale(squash || 0.15, 1)
  px(c, '#2b2b38', -2 * s, -3 * s, 1.3 * s, 3 * s)
  px(c, '#2b2b38', 0.8 * s, -3 * s, 1.3 * s, 3 * s)
  px(c, shirt, -2.2 * s, -8 * s, 4.6 * s, 5 * s)
  px(c, '#f1c27d', -1.5 * s, -11 * s, 3 * s, 3 * s)
  if (move === 'wave') {
    const ay = Math.sin(now / 90 + i) * 3 * s
    px(c, shirt, -5.2 * s, -9 * s + ay, 3 * s, 1.3 * s)
    px(c, shirt, 2.2 * s, -9 * s - ay, 3 * s, 1.3 * s)
  } else if (move === 'robot') {
    const up = Math.floor(now / 180 + i) % 2
    px(c, shirt, -5 * s, (-8 - up) * s, 2.6 * s, 1.2 * s)
    px(c, shirt, 2.4 * s, (-7 + up) * s, 2.6 * s, 1.2 * s)
  } else {
    px(c, shirt, -4 * s, -7 * s, 1.4 * s, 3 * s)
    px(c, shirt, 2.6 * s, -7 * s, 1.4 * s, 3 * s)
  }
  c.restore()
}

function trophy(c: Ctx, x: number, y: number, z: number) {
  const s = z
  px(c, '#ffd43b', x - 4 * s, y - 22 * s, 8 * s, 6 * s)
  px(c, '#fab005', x - 6 * s, y - 21 * s, 2.4 * s, 4 * s)
  px(c, '#fab005', x + 3.6 * s, y - 21 * s, 2.4 * s, 4 * s)
  px(c, '#fff3bf', x - 2.4 * s, y - 20.5 * s, 2.2 * s, 2 * s)
  px(c, '#ffd43b', x - 1.2 * s, y - 16 * s, 2.4 * s, 4 * s)
  px(c, '#e67700', x - 3 * s, y - 12 * s, 6 * s, 1.6 * s)
}

export function drawDisco(
  c: Ctx, g: Game, f: Facility, p: { x: number; y: number }, w: number, h: number, z: number, now: number,
) {
  const mode = discoMode(g)
  const X = (sx: number) => p.x + sx * z
  const Y = (sy: number) => p.y + sy * z
  const sw = w / z
  const sh = h / z
  const label = mode === 'kids' ? "KIDS' DISCO" : mode === 'club' ? 'NIGHT CLUB' : 'CLOSED'
  px(c, '#111', X(28), Y(6), 78 * z, 12 * z)
  px(c, mode === 'kids' ? '#e67700' : mode === 'club' ? '#5f3dc4' : '#24143d', X(30), Y(8), 74 * z, 8 * z)
  c.fillStyle = mode === 'closed' ? '#6741d9' : '#fff'
  c.font = `bold ${Math.max(6, Math.round(6.5 * z))}px monospace`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, X(67), Y(12))
  c.textAlign = 'left'
  c.textBaseline = 'alphabetic'
  if (mode === 'closed') return

  const beat = discoBeat(now)
  const pattern = g.flags.discoPattern ?? 0
  const floorTop = sh / 2 + 8
  const floorBot = sh - 4
  const floorL = 20
  const floorR = sw - 56
  const cols = Math.ceil((floorR - floorL) / 8)
  const rows = Math.max(2, Math.ceil((floorBot - floorTop) / 6))
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const hue = mode === 'kids'
        ? (i * 36 + j * 20 + beat * 40 + pattern * 70) % 360
        : 250 + ((i + j + beat + pattern) % 4) * 16
      const lit = (i + j + beat) % 2 === 0
      c.fillStyle = `hsl(${hue}, ${mode === 'kids' ? 92 : 78}%, ${lit ? 64 : 42}%)`
      c.fillRect(X(floorL + i * 8), Y(floorTop + j * 6), 7.5 * z, 5.5 * z)
    }
  }
  const flash = discoFlashTile(f.id, now)
  if (flash != null) {
    c.fillStyle = 'rgba(255,255,255,0.9)'
    c.fillRect(X((flash - f.x) * 8), Y(floorTop), 8 * z, (floorBot - floorTop) * z)
  }

  const bx = sw / 2
  const by = 14
  c.fillStyle = '#868e96'
  c.fillRect(X(bx) - 0.4 * z, Y(2), 0.8 * z, 6 * z)
  c.fillStyle = '#dee2e6'
  c.beginPath()
  c.arc(X(bx), Y(by), 5.5 * z, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#adb5bd'
  c.fillRect(X(bx + 1), Y(by + 1), 2 * z, 2 * z)
  const spots = mode === 'club' ? 9 : 6
  for (let i = 0; i < spots; i++) {
    const a = now / (mode === 'club' ? 420 : 900) + i * 0.9 + pattern
    c.globalAlpha = 0.75
    c.fillStyle = `hsl(${(beat * 40 + i * 50 + pattern * 30) % 360}, 100%, 72%)`
    c.fillRect(X(bx + Math.cos(a) * sw * 0.28), Y(by + 10 + Math.sin(a * 1.3) * 16), 2 * z, 2 * z)
  }
  c.globalAlpha = 1
  c.fillStyle = '#fff'
  c.fillRect(X(bx - 3 + (Math.floor(now / 120) % 3) * 2), Y(by - 2), 2 * z, 2 * z)

  if (mode === 'club') {
    c.save()
    c.strokeStyle = `hsla(${280 + (beat % 3) * 20}, 100%, 70%, 0.55)`
    c.lineWidth = Math.max(1, z)
    for (let i = 0; i < 3; i++) {
      const a = now / 500 + i * 2.1 + pattern
      c.beginPath()
      c.moveTo(X(bx), Y(by))
      c.lineTo(X(bx + Math.cos(a) * (sw * 0.4)), Y(sh - 8))
      c.stroke()
    }
    c.restore()
    c.fillStyle = 'rgba(210, 220, 255, 0.38)'
    const drift = (Math.sin(now / 700) * 0.5 + 0.5) * 30
    c.fillRect(X(18 + drift), Y(sh - 14), (sw - 80) * z, 8 * z)
  }

  if (mode === 'kids' || discoBubbling(g, f.id)) {
    const n = mode === 'kids' ? 7 : 4
    for (let i = 0; i < n; i++) {
      const life = ((now / 40 + i * 17) % 50) / 50
      const x = 20 + ((i * 23) % (sw - 80))
      c.strokeStyle = `hsla(${(i * 40 + beat * 20) % 360}, 90%, 75%, ${0.8 - life * 0.7})`
      c.beginPath()
      c.arc(X(x), Y(sh - 16 - life * 28), (1.2 + life) * z, 0, Math.PI * 2)
      c.stroke()
    }
  }

  const show = danceOffNow(g)
  const onShow = show?.id === f.id
  if (onShow && show) {
    c.fillStyle = 'rgba(0,0,0,0.45)'
    c.fillRect(p.x, p.y, w, h)
    const spotsX = [sw * 0.32, sw * 0.58]
    for (let i = 0; i < 2; i++) {
      const on = show.phase === 'cut' || (show.phase === 'a' && i === 0) || (show.phase === 'b' && i === 1) || show.phase === 'winner'
      if (!on) continue
      const grd = c.createRadialGradient(X(spotsX[i]), Y(sh - 18), 2 * z, X(spotsX[i]), Y(sh - 10), 26 * z)
      grd.addColorStop(0, 'rgba(255,255,255,0.55)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = grd
      c.fillRect(X(spotsX[i] - 26), Y(sh / 2), 52 * z, (sh / 2) * z)
    }
    const moveFor = (i: 0 | 1): Move => {
      if (discoFrozen(g, f.id)) return 'robot'
      if (show.phase === 'a' && i === 0) return 'spin'
      if (show.phase === 'b' && i === 1) return 'worm'
      if (show.phase === 'winner' && i === show.winner) return 'jump'
      return 'wave'
    }
    for (const i of [0, 1] as const) {
      dancer(c, X(spotsX[i]), Y(sh - 6), z, SHIRTS[(f.id + i) % SHIRTS.length], moveFor(i), now, i)
      if (show.phase === 'winner' && i === show.winner) trophy(c, X(spotsX[i]), Y(sh - 6), z)
    }
  }

  const n = discoDancerCount(f.inside)
  const frozen = discoFrozen(g, f.id)
  const spinning = discoSpinSlot(f.id, now)
  for (let i = 0; i < n; i++) {
    if (onShow && (i === 0 || i === 1)) continue
    const x = floorL + 8 + ((i + 0.5) / n) * (floorR - floorL - 16)
    const move: Move = frozen ? 'robot' : spinning === i ? 'spin' : moveAt(f.id * 3 + i, now)
    dancer(c, X(x), Y(sh - 6), z, SHIRTS[(f.id + i) % SHIRTS.length], move, now, i)
  }
  if (onShow) {
    px(c, '#111', X(28), Y(6), 78 * z, 12 * z)
    px(c, mode === 'kids' ? '#e67700' : '#5f3dc4', X(30), Y(8), 74 * z, 8 * z)
    c.fillStyle = '#fff'
    c.font = `bold ${Math.max(6, Math.round(6.5 * z))}px monospace`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(label, X(67), Y(12))
    c.textAlign = 'left'
    c.textBaseline = 'alphabetic'
  }
}
