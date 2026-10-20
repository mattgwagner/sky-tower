// Cartoon visitors drawn on the tower: ape, dragon, skywriter.
import { apePlace, dragonLanterns, floorSpan, giantNow, towerName } from '../game/giants'
import type { ApePose } from '../game/giants'
import type { Game } from '../game/state'
import { topFloor } from '../game/world'
import { FH, T } from './sprites'

const floorTop = (f: number) => -(f + 1) * FH

type Pt = { x: number; y: number }

export function drawGiants(
  c: CanvasRenderingContext2D,
  g: Game,
  S: (x: number, y: number) => Pt,
  z: number,
  now: number,
) {
  if (g.floors.size === 0) return
  const n = giantNow(g)
  if (n?.kind === 'dragon') drawDragon(c, g, S, z, n.phase, now)
  if (n?.kind === 'skywriter') drawSkywriter(c, g, S, z, n.phase, now)
  if (dragonLanterns(g)) drawLanterns(c, g, S, z, now)
  if (n?.kind === 'ape') drawApeVisit(c, g, S, z, n.phase, now)
}

function roofBand(g: Game, S: (x: number, y: number) => Pt) {
  const top = topFloor(g)
  const span = floorSpan(g, top)
  if (!span) return null
  const y = S(0, floorTop(top)).y
  return { top, span, y, left: S(span[0] * T, 0).x, right: S((span[1] + 1) * T, 0).x }
}

function drawApeVisit(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, phase: number, now: number) {
  const p = apePlace(g, phase)
  const feet = S(p.tile * T, -p.floor * FH)
  drawApe(c, feet.x, feet.y, z, p.pose, now)
  if (p.pose === 'peek') drawPeekers(c, g, S, z, p.floor)
  if (p.pose === 'roof') drawBiplane(c, feet.x, feet.y, z, (phase - 0.55) / 0.2, now)
}

function drawPeekers(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, floor: number) {
  const u = Math.max(1.6, z * 1.15)
  c.textAlign = 'center'
  for (let i = 0; i < 3; i++) {
    const f = Math.round(floor) - 1 + i
    const span = floorSpan(g, f)
    if (!span) continue
    const at = S((span[1] - 14 - i * 1.4) * T, -f * FH)
    c.fillStyle = '#ffd8a8'
    c.fillRect(at.x - 3 * u, at.y - 20 * u, 6 * u, 6 * u)
    c.fillStyle = '#1a1a1a'
    c.fillRect(at.x + u, at.y - 18 * u, 1.6 * u, 1.6 * u)
    c.fillStyle = i === 1 ? '#ff922b' : '#4dabf7'
    c.fillRect(at.x - 3.5 * u, at.y - 14 * u, 7 * u, 8 * u)
    c.fillStyle = '#ffd8a8'
    c.fillRect(at.x + 3 * u, at.y - 12 * u, 9 * u, 2.2 * u)
    c.fillStyle = '#ff2d2d'
    c.font = `bold ${Math.round(16 * z)}px "Nunito", sans-serif`
    c.fillText('!', at.x, at.y - 22 * u)
  }
  c.textAlign = 'left'
}

function drawApe(c: CanvasRenderingContext2D, x: number, y: number, z: number, pose: ApePose, now: number) {
  const u = z * 4.6
  const swing = Math.sin(now / 160)
  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    c.fillStyle = color
    c.fillRect(x + dx * u, y + dy * u, w * u, h * u)
  }
  c.fillStyle = 'rgba(0,0,0,0.22)'
  c.fillRect(x - 8 * u, y - u, 16 * u, 2 * u)

  const liftL = pose === 'roof' ? 16 + swing * 5 : pose === 'peek' ? 8 : 7 + swing * 6
  const liftR = pose === 'roof' ? 16 - swing * 5 : pose === 'peek' ? 6 : 7 - swing * 6
  px(-16, -8 - liftL, 7, 12, '#5c4033')
  px(9, -8 - liftR, 7, 12, '#5c4033')
  px(-15, -6 - liftL * 0.15, 6, 5, '#3d2918')
  px(9, -6 - liftR * 0.15, 6, 5, '#3d2918')

  px(-7, -12, 5, 12, '#5c4033')
  px(2, -12, 5, 12, '#5c4033')
  px(-8, -14, 5, 4, '#2b2118')
  px(3, -14, 5, 4, '#2b2118')

  px(-12, -28, 24, 18, '#6b4a32')
  px(-8, -24, 16, 12, '#e7c8a4')
  px(-14, -40, 28, 16, '#6b4a32')
  px(-18, -36, 5, 8, '#6b4a32')
  px(13, -36, 5, 8, '#6b4a32')
  px(-9, -38, 18, 12, '#f3d5b5')
  px(-6, -36, 3, 3, '#1a1a1a')
  px(3, -36, 3, 3, '#1a1a1a')
  px(-5, -34, 1.2, 1.2, '#fff')
  px(4, -34, 1.2, 1.2, '#fff')
  px(-4, -30, 8, 2, '#c92a2a')
  px(-3, -29, 2, 2, '#fff')
  px(1, -29, 2, 2, '#fff')

  if (pose === 'roof' && swing > 0.2) {
    px(14, -46, 6, 6, '#f3d5b5')
  }
}

function drawBiplane(c: CanvasRenderingContext2D, apeX: number, apeY: number, z: number, k: number, now: number) {
  const u = Math.max(1.4, z * 1.3)
  const along = Math.min(1, Math.max(0, k))
  const x = apeX - 210 * u + along * 250 * u
  const y = apeY - 78 * u + Math.sin(now / 200) * 4
  c.fillStyle = '#fff3bf'
  c.fillRect(x - 78 * u, y - 9 * u, 62 * u, 16 * u)
  c.strokeStyle = '#f08c00'
  c.lineWidth = Math.max(1, u)
  c.strokeRect(x - 78 * u, y - 9 * u, 62 * u, 16 * u)
  c.fillStyle = '#1b1b1b'
  c.font = `900 ${Math.round(11 * z)}px "Nunito", sans-serif`
  c.textAlign = 'center'
  c.fillText('BE NICE', x - 47 * u, y + 3 * u)
  c.textAlign = 'left'
  c.strokeStyle = '#495057'
  c.beginPath()
  c.moveTo(x - 16 * u, y - u)
  c.lineTo(x + 8 * u, y - u)
  c.stroke()
  c.fillStyle = '#e03131'
  c.fillRect(x + 6 * u, y - 6 * u, 28 * u, 8 * u)
  c.fillStyle = '#ffd43b'
  c.fillRect(x + 10 * u, y - 16 * u, 20 * u, 4 * u)
  c.fillRect(x + 10 * u, y + 4 * u, 20 * u, 4 * u)
  c.fillStyle = '#f8f9fa'
  c.fillRect(x + 30 * u, y - 8 * u, 10 * u, 8 * u)
  c.fillStyle = '#1864ab'
  c.fillRect(x + 33 * u, y - 6 * u, 5 * u, 4 * u)
  c.fillStyle = '#868e96'
  c.fillRect(x + 18 * u, y - 18 * u, 3 * u, 6 * u)
}

function dragonHead(phase: number, left: number, right: number, roofY: number, z: number): Pt {
  const sky = roofY - 78 * z
  if (phase < 0.4) {
    const k = phase / 0.4
    return { x: left + (right - left) * k, y: sky + Math.sin(k * Math.PI * 2) * 54 * z }
  }
  if (phase < 0.5) {
    const k = (phase - 0.4) / 0.1
    const mid = (left + right) / 2
    return { x: right + (mid - right) * k, y: sky + (roofY - 6 * z - sky) * k }
  }
  const k = (phase - 0.5) / 0.5
  const mid = (left + right) / 2
  return { x: mid + (right - mid + 80 * z) * k, y: roofY - 6 * z - k * k * 140 * z }
}

function drawDragon(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, phase: number, now: number) {
  const band = roofBand(g, S)
  if (!band) return
  const pad = 40 * z
  const left = band.left - pad
  const right = band.right + pad
  const flying = phase < 0.42
  const pts: Pt[] = []
  const n = flying ? 16 : 8
  const step = flying ? 0.012 : 0.004
  for (let i = n; i >= 0; i--) pts.push(dragonHead(Math.max(0, phase - i * step), left, right, band.y, z))
  const u = Math.max(2.4, z * 2.6)
  pts.forEach((p, i) => {
    const w = (6 + i * 0.55) * u
    const h = (4 + i * 0.35) * u
    c.fillStyle = i % 2 ? '#2f9e44' : '#40c057'
    c.fillRect(p.x - w / 2, p.y - h / 2, w, h)
    c.fillStyle = '#b2f2bb'
    c.fillRect(p.x - w / 5, p.y - h / 8, w / 2.5, h / 3)
  })
  const wing = pts[Math.floor(pts.length / 2)]!
  c.fillStyle = '#8ce99a'
  c.fillRect(wing.x - 4 * u, wing.y - 10 * u, 16 * u, 6 * u)
  c.fillRect(wing.x - 2 * u, wing.y + 4 * u, 14 * u, 5 * u)
  const head = pts[pts.length - 1]!
  c.fillStyle = '#2b8a3e'
  c.fillRect(head.x - 2 * u, head.y - 10 * u, 18 * u, 14 * u)
  c.fillRect(head.x + 12 * u, head.y - 6 * u, 12 * u, 10 * u)
  c.fillStyle = '#d8f5a2'
  c.fillRect(head.x - 6 * u, head.y - 16 * u, 5 * u, 7 * u)
  c.fillRect(head.x + 4 * u, head.y - 16 * u, 5 * u, 7 * u)
  c.fillStyle = '#d3f9d8'
  c.fillRect(head.x + 14 * u, head.y - 3 * u, 8 * u, 6 * u)
  c.fillStyle = '#1a1a1a'
  c.fillRect(head.x + 2 * u, head.y - 6 * u, 3 * u, 3 * u)
  c.fillRect(head.x + 8 * u, head.y - 6 * u, 3 * u, 3 * u)
  c.fillStyle = '#fff'
  c.fillRect(head.x + 2.6 * u, head.y - 5.4 * u, 1.2 * u, 1.2 * u)
  c.fillRect(head.x + 8.6 * u, head.y - 5.4 * u, 1.2 * u, 1.2 * u)
  c.fillStyle = '#e03131'
  c.fillRect(head.x + 4 * u, head.y + u, 6 * u, 2 * u)
  if (phase >= 0.42 && phase < 0.58) {
    const flick = Math.sin(now / 70) * 6 * u
    c.fillStyle = '#ff6b6b'
    c.fillRect(head.x + 24 * u, head.y - 4 * u, 10 * u, 8 * u)
    c.fillStyle = '#ff922b'
    c.fillRect(head.x + 30 * u, head.y - 8 * u, 18 * u + flick, 12 * u)
    c.fillStyle = '#ffd43b'
    c.fillRect(head.x + 36 * u, head.y - 4 * u, 12 * u, 6 * u)
    c.fillStyle = '#fff3bf'
    c.fillRect(head.x + 42 * u, head.y - 2 * u, 6 * u, 3 * u)
  }
}

function drawLanterns(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, now: number) {
  const band = roofBand(g, S)
  if (!band) return
  const u = Math.max(1.8, z * 1.7)
  const glow = 0.55 + Math.sin(now / 280) * 0.2
  const tiles = band.span[1] - band.span[0]
  const n = Math.max(4, Math.min(7, Math.floor(tiles / 8)))
  for (let i = 0; i < n; i++) {
    const tile = band.span[0] + ((i + 0.5) / n) * (band.span[1] - band.span[0])
    const p = S(tile * T, floorTop(band.top) - 2)
    c.fillStyle = `rgba(255, 146, 43, ${glow})`
    c.fillRect(p.x - 8 * u, p.y - 22 * u, 16 * u, 18 * u)
    c.fillStyle = '#ffd43b'
    c.fillRect(p.x - 5 * u, p.y - 18 * u, 10 * u, 12 * u)
    c.fillStyle = '#fff3bf'
    c.fillRect(p.x - 2 * u, p.y - 15 * u, 4 * u, 6 * u)
    c.fillStyle = '#868e96'
    c.fillRect(p.x - u, p.y - 28 * u, 2 * u, 7 * u)
  }
}

function drawSkywriter(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, phase: number, now: number) {
  const band = roofBand(g, S)
  if (!band) return
  const name = towerName(g)
  const u = Math.max(1.3, z * 1.25)
  const write = 0.34
  const y0 = band.y - 130 * u
  const gap = Math.min(36 * u, (band.right - band.left) / Math.max(4, name.length))
  const x0 = (band.left + band.right) / 2 - (name.length - 1) * gap / 2
  const fade = phase <= write ? 1 : Math.max(0, 1 - (phase - write) / (1 - write))
  const drift = phase <= write ? 0 : ((phase - write) / (1 - write)) * 28 * u
  c.textAlign = 'center'
  c.font = `900 ${Math.round(22 * z)}px "Nunito", sans-serif`
  for (let i = 0; i < name.length; i++) {
    const born = ((i + 0.6) / name.length) * write
    if (phase < born) continue
    const ch = name[i]!
    if (ch === ' ') continue
    const x = x0 + i * gap + Math.sin(now / 400 + i) * 2
    const y = y0 - drift - (phase - born) * 12 * u
    c.fillStyle = `rgba(255,255,255,${0.95 * fade})`
    c.fillRect(x - 12 * u, y - 16 * u, 24 * u, 18 * u)
    c.fillStyle = `rgba(210, 230, 255, ${0.8 * fade})`
    c.fillRect(x - 16 * u, y - 10 * u, 8 * u, 10 * u)
    c.fillRect(x + 8 * u, y - 12 * u, 8 * u, 10 * u)
    c.fillStyle = `rgba(73, 80, 87, ${fade})`
    c.fillText(ch, x, y - 2 * u)
  }
  const tip = Math.min(name.length, Math.floor((phase / write) * name.length + 1))
  const px = phase < write ? x0 + Math.min(name.length - 1, tip) * gap + 24 * u : band.right + (phase - write) * 240 * u
  const py = y0 - 16 * u + Math.sin(now / 180) * 3
  c.fillStyle = '#dee2e6'
  c.fillRect(px, py, 18 * u, 4 * u)
  c.fillStyle = '#4dabf7'
  c.fillRect(px + 4 * u, py - 6 * u, 12 * u, 2 * u)
  c.fillRect(px + 4 * u, py + 4 * u, 12 * u, 2 * u)
  c.fillStyle = '#ffd43b'
  c.fillRect(px + 14 * u, py - u, 6 * u, 6 * u)
  c.textAlign = 'left'
}
