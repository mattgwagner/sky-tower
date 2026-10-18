// Canvas renderer: sky, city, ground, tower cut-away, elevators, people, effects.
import { FACILITIES, TOWER_WIDTH, TRANSPORTS, isCommercial, isHotel, isLobbyFloor } from '../game/defs'
import type { FacilityKind } from '../game/defs'
import { carPos } from '../game/elevators'
import { isOpen } from '../game/sim'
import type { Facility, Game, Person, Shaft } from '../game/state'
import { dayOf, isWeekend, minuteOfDay } from '../game/state'
import { FH, SHIRTS, T, sprite } from './sprites'
import type { Look } from './sprites'

export interface Camera { x: number; y: number; zoom: number }

export interface Overlay {
  ghost?: { kind: FacilityKind; x: number; floor: number; w: number; h: number; ok: boolean; cost: number; reason?: string }
  shaftGhost?: { x: number; lo: number; hi: number; w: number; ok: boolean; cost: number; reason?: string }
  bulldoze?: { id: number }
  selected?: number
  hover?: number
  moodView?: boolean
  mouse?: { sx: number; sy: number }
  person?: number
}

// ---------- transient visual effects ----------
const flashes: { x: number; top: number; w: number; h: number; t: number }[] = []
let fireworksUntil = 0
const rockets: { x: number; y: number; vx: number; vy: number; fuse: number; color: string }[] = []
const sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = []

/** Flash a freshly built area: x/w in tiles, top floor index, h floors. */
export function flashBuild(x: number, top: number, w: number, h: number) {
  flashes.push({ x, top, w, h, t: 0 })
}
export function launchFireworks(now: number, seconds = 6) {
  fireworksUntil = Math.max(fireworksUntil, now + seconds * 1000)
}

export function personPos(g: Game, p: Person): { tile: number; floor: number } | null {
  switch (p.state) {
    case 'walking': return { tile: p.x, floor: p.floor }
    case 'waiting': return { tile: p.x, floor: p.floor }
    case 'climbing': {
      const L = p.legs[p.leg]
      const conn = L && g.facilities.get(L.via)
      if (!conn) return { tile: p.x, floor: p.floor }
      const k = Math.min(1, p.climb / (conn.kind === 'escalator' ? 28 : 55))
      const prog = L.to > L.from ? k : 1 - k
      return { tile: conn.x + 0.5 + prog * (conn.width - 1), floor: conn.floor + prog }
    }
    case 'riding':
      for (const s of g.shafts.values()) for (const c of s.cars) if (c.riders.includes(p.id)) return { tile: s.x + TRANSPORTS[s.kind].width / 2, floor: carPos(s, c) }
      return null
    case 'inside': {
      const f = g.facilities.get(p.at)
      return f ? { tile: f.x + f.width / 2, floor: f.floor } : null
    }
    default: return null
  }
}

const LOT_W = TOWER_WIDTH * T

export function worldToScreen(cam: Camera, W: number, H: number, wx: number, wy: number) {
  return { x: (wx - cam.x) * cam.zoom + W / 2, y: (wy - cam.y) * cam.zoom + H / 2 }
}
export function screenToWorld(cam: Camera, W: number, H: number, sx: number, sy: number) {
  const wx = (sx - W / 2) / cam.zoom + cam.x
  const wy = (sy - H / 2) / cam.zoom + cam.y
  return { wx, wy, tile: wx / T, floor: Math.floor(-wy / FH) }
}
const floorTop = (f: number) => -(f + 1) * FH

// ---------- sky ----------
type RGB = [number, number, number]
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const KEYS: [number, string, string][] = [
  [0, '#070b1f', '#1a2150'],
  [5, '#0b1030', '#25306a'],
  [6, '#3b3a7a', '#ff9a76'],
  [7, '#5aa9f0', '#ffd9a8'],
  [9, '#3d9cf5', '#b9e3ff'],
  [16.5, '#3d9cf5', '#c6e8ff'],
  [18, '#5d4ba0', '#ffa66b'],
  [19.3, '#1d1a4a', '#7a3f74'],
  [20.5, '#0a0e28', '#202860'],
  [24, '#070b1f', '#1a2150'],
]
function skyColors(hour: number): [string, string, number] {
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= hour) i++
  const [h0, t0, b0] = KEYS[i]
  const [h1, t1, b1] = KEYS[i + 1]
  const k = Math.max(0, Math.min(1, (hour - h0) / (h1 - h0)))
  const mix = (a: string, b: string) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, j) => Math.round(v + (B[j] - v) * k)).join(',')})` }
  const night = hour < 5.5 || hour > 20 ? 1 : hour < 7 ? (7 - hour) / 1.5 : hour > 18.5 ? (hour - 18.5) / 1.5 : 0
  return [mix(t0, t1), mix(b0, b1), Math.max(0, Math.min(1, night))]
}

const STARS = Array.from({ length: 140 }, (_, i) => ({ x: (i * 7919) % 1000 / 1000, y: ((i * 104729) % 1000) / 1000 * 0.7, s: (i % 3) + 1 }))
const SKYLINE = Array.from({ length: 70 }, (_, i) => ({
  x: i * 70 + ((i * 37) % 30), w: 40 + ((i * 53) % 40), h: 60 + ((i * 97) % 220), c: (i * 13) % 3,
}))
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: i * 420 + (i * 131) % 200, y: 60 + ((i * 71) % 160), s: 0.7 + ((i * 17) % 10) / 12 }))

function drawSky(c: CanvasRenderingContext2D, W: number, H: number, g: Game, cam: Camera, now: number) {
  const hour = minuteOfDay(g.time) / 60
  const [top, bot, night] = skyColors(hour)
  const grd = c.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, top)
  grd.addColorStop(1, bot)
  c.fillStyle = grd
  c.fillRect(0, 0, W, H)
  if (night > 0) {
    for (const s of STARS) {
      c.globalAlpha = night * (0.5 + 0.5 * Math.sin(now / 600 + s.x * 50))
      c.fillStyle = '#fff'
      c.fillRect(s.x * W, s.y * H, s.s, s.s)
    }
    c.globalAlpha = 1
  }
  // sun / moon arc
  const arc = (frac: number) => ({ x: W * (0.1 + 0.8 * frac), y: H * 0.75 - Math.sin(frac * Math.PI) * H * 0.6 })
  if (hour > 5.5 && hour < 19.5) {
    const p = arc((hour - 5.5) / 14)
    const glow = c.createRadialGradient(p.x, p.y, 4, p.x, p.y, 70)
    glow.addColorStop(0, 'rgba(255,240,180,0.9)')
    glow.addColorStop(1, 'rgba(255,240,180,0)')
    c.fillStyle = glow
    c.fillRect(p.x - 70, p.y - 70, 140, 140)
    c.fillStyle = '#fff4c2'
    c.beginPath(); c.arc(p.x, p.y, 18, 0, Math.PI * 2); c.fill()
  } else {
    const hh = hour < 12 ? hour + 24 : hour
    const p = arc((hh - 19.5) / 10.5)
    c.fillStyle = '#f1f3f5'
    c.beginPath(); c.arc(p.x, p.y, 14, 0, Math.PI * 2); c.fill()
    c.fillStyle = top
    c.beginPath(); c.arc(p.x + 6, p.y - 3, 12, 0, Math.PI * 2); c.fill()
  }
  // clouds (parallax)
  const drift = (g.time * 0.8) % 4000
  c.fillStyle = night > 0.5 ? 'rgba(80,90,130,0.35)' : 'rgba(255,255,255,0.85)'
  for (const cl of CLOUDS) {
    let x = ((cl.x + drift - cam.x * 0.15) % (W + 400)) - 200
    if (x < -200) x += W + 400
    const y = cl.y - (cam.y * 0.05) % 50
    const s = cl.s * 1.2
    c.beginPath()
    c.ellipse(x, y, 40 * s, 12 * s, 0, 0, Math.PI * 2)
    c.ellipse(x + 25 * s, y - 8 * s, 26 * s, 14 * s, 0, 0, Math.PI * 2)
    c.ellipse(x - 22 * s, y - 4 * s, 20 * s, 10 * s, 0, 0, Math.PI * 2)
    c.fill()
  }
  return night
}

function drawSkyline(c: CanvasRenderingContext2D, W: number, H: number, cam: Camera, night: number) {
  const groundY = (0 - cam.y) * cam.zoom + H / 2
  if (groundY < 0) return
  const z = Math.max(0.5, cam.zoom * 0.6)
  const offset = cam.x * cam.zoom * 0.35
  const span = 70 * SKYLINE.length * z
  for (const b of SKYLINE) {
    let x = (b.x * z - offset) % span
    if (x < -200) x += span
    if (x > W + 100) continue
    const w = b.w * z, h = b.h * z
    const col = night > 0.5 ? ['#1a1f3d', '#202650', '#151a33'][b.c] : ['#9fb4cc', '#8aa3bf', '#b0c2d6'][b.c]
    c.fillStyle = col
    c.fillRect(x, groundY - h, w, h)
    if (night > 0.3) {
      c.fillStyle = `rgba(255,214,120,${0.6 * night})`
      for (let wy = groundY - h + 6 * z; wy < groundY - 6 * z; wy += 9 * z)
        for (let wx = x + 4 * z; wx < x + w - 4 * z; wx += 8 * z)
          if (((wx * 13 + wy * 7) | 0) % 5 === 0) c.fillRect(wx, wy, 3 * z, 4 * z)
    }
  }
}

// ---------- ground ----------
function drawGround(c: CanvasRenderingContext2D, W: number, H: number, cam: Camera, g: Game, night: number) {
  const gy = (0 - cam.y) * cam.zoom + H / 2
  if (gy > H) return
  const grd = c.createLinearGradient(0, gy, 0, gy + 700 * cam.zoom)
  grd.addColorStop(0, '#7a5230')
  grd.addColorStop(0.3, '#5e3d22')
  grd.addColorStop(1, '#3a2614')
  c.fillStyle = grd
  c.fillRect(0, gy, W, H - gy)
  // strata + rocks
  c.fillStyle = 'rgba(0,0,0,0.12)'
  for (let i = 1; i < 12; i++) c.fillRect(0, gy + i * FH * cam.zoom - 1, W, Math.max(1, cam.zoom))
  c.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 60; i++) {
    const wx = ((i * 7919) % 4000) - 1000
    const wy = ((i * 6007) % (FH * 10)) + 6
    const p = worldToScreen(cam, W, H, wx, wy)
    c.fillRect(p.x, p.y, 6 * cam.zoom, 3 * cam.zoom)
  }
  // grass + sidewalk
  c.fillStyle = '#2f9e44'
  c.fillRect(0, gy - 1, W, Math.max(2, 3 * cam.zoom))
  c.fillStyle = '#868e96'
  const l = worldToScreen(cam, W, H, -60, 0)
  const rr = worldToScreen(cam, W, H, LOT_W + 60, 0)
  c.fillRect(l.x, gy - 1, rr.x - l.x, Math.max(2, 3 * cam.zoom))
  // trees + lamps outside the lot
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1
    const wx = side < 0 ? -40 - (i >> 1) * 70 : LOT_W + 40 + (i >> 1) * 70
    const p = worldToScreen(cam, W, H, wx, 0)
    if (p.x < -60 || p.x > W + 60) continue
    const z = cam.zoom
    if (i % 4 < 2) {
      c.fillStyle = '#6b4f3a'; c.fillRect(p.x - 2 * z, p.y - 16 * z, 4 * z, 16 * z)
      c.fillStyle = night > 0.5 ? '#1f4d2c' : '#37b24d'
      c.beginPath(); c.arc(p.x, p.y - 22 * z, 11 * z, 0, Math.PI * 2); c.fill()
      c.fillStyle = night > 0.5 ? '#2b6b3c' : '#51cf66'
      c.beginPath(); c.arc(p.x - 4 * z, p.y - 25 * z, 6 * z, 0, Math.PI * 2); c.fill()
    } else {
      c.fillStyle = '#343a40'; c.fillRect(p.x - z, p.y - 26 * z, 2 * z, 26 * z)
      c.fillStyle = night > 0.3 ? '#fff3bf' : '#ced4da'; c.fillRect(p.x - 3 * z, p.y - 28 * z, 6 * z, 3 * z)
      if (night > 0.3) {
        const gl = c.createRadialGradient(p.x, p.y - 26 * z, 1, p.x, p.y - 26 * z, 30 * z)
        gl.addColorStop(0, 'rgba(255,240,180,0.35)'); gl.addColorStop(1, 'rgba(255,240,180,0)')
        c.fillStyle = gl; c.fillRect(p.x - 30 * z, p.y - 56 * z, 60 * z, 60 * z)
      }
    }
  }
  // lot markers when tower is empty
  if (g.facilities.size === 0) {
    c.setLineDash([6, 6])
    c.strokeStyle = 'rgba(255,255,255,0.5)'
    const a = worldToScreen(cam, W, H, 0, -FH)
    c.strokeRect(a.x, a.y, LOT_W * cam.zoom, FH * cam.zoom)
    c.setLineDash([])
  }
}

// ---------- facility look ----------
function lookFor(g: Game, f: Facility, m: number): Look {
  const day = m >= 7 * 60 && m < 18.5 * 60
  switch (f.kind) {
    case 'office':
      if (!f.occupied) return 'vacant'
      return day || f.inside > 0 ? 'day' : 'night'
    case 'condo':
      if (!f.occupied) return 'vacant'
      return day || (f.inside > 0 && m >= 6 * 60) ? 'day' : 'night'
    case 'hotelSingle': case 'hotelTwin': case 'hotelSuite':
      if (f.dirty || f.roaches) return 'dirty'
      return day || (f.booked && m >= 17 * 60) ? 'day' : 'night'
    default:
      if (isCommercial(f.kind)) return day || isOpen(g, f) ? 'day' : 'night'
      return 'day'
  }
}

function drawPersonAt(c: CanvasRenderingContext2D, x: number, yBottom: number, z: number, color: string, frame: number, mood: number, special = 0) {
  const body = mood > 55 ? '#ff2d2d' : mood > 30 ? '#ff9f43' : color
  if (z < 0.6) {
    c.fillStyle = body
    c.fillRect(x, yBottom - 7 * z, Math.max(1, 2 * z), 7 * z)
    return
  }
  const u = z
  c.fillStyle = '#2b2b38'
  if (frame) { c.fillRect(x - u, yBottom - 3 * u, u, 3 * u); c.fillRect(x + u, yBottom - 3 * u, u, 3 * u) }
  else c.fillRect(x, yBottom - 3 * u, u * 1.4, 3 * u)
  c.fillStyle = body
  c.fillRect(x - u, yBottom - 7 * u, 3 * u, 4 * u)
  c.fillStyle = '#f1c27d'
  c.fillRect(x - 0.5 * u, yBottom - 9.5 * u, 2.2 * u, 2.4 * u)
  if (special === 99) { c.fillStyle = '#212529'; c.fillRect(x - 1.2 * u, yBottom - 10.5 * u, 3.4 * u, 1 * u); c.fillRect(x - 0.4 * u, yBottom - 12.5 * u, 2 * u, 2 * u) }
  if (special === 60) { c.fillStyle = '#1c3d6e'; c.fillRect(x - 0.8 * u, yBottom - 10.3 * u, 2.8 * u, 1 * u) }
  if (special === 50) { c.fillStyle = '#fff'; c.fillRect(x - 0.6 * u, yBottom - 10.1 * u, 2.4 * u, 0.8 * u) }
  if (mood > 70 && z >= 1.5) {
    c.fillStyle = '#ff2d2d'
    c.font = `bold ${Math.round(6 * z)}px sans-serif`
    c.fillText('!', x, yBottom - 11 * u)
  }
}

function personColor(shirt: number) {
  if (shirt === 99) return '#fab005'
  if (shirt === 60) return '#1c3d6e'
  if (shirt === 50) return '#0b7285'
  return SHIRTS[shirt % SHIRTS.length]
}

// ---------- main draw ----------
export function render(c: CanvasRenderingContext2D, W: number, H: number, g: Game, cam: Camera, ov: Overlay, now: number, dt: number) {
  c.imageSmoothingEnabled = false
  const night = drawSky(c, W, H, g, cam, now)
  drawSkyline(c, W, H, cam, night)
  drawBirds(c, W, H, g, now, night)
  drawFireworks(c, W, H, now, dt)
  drawWeather(c, W, H, g, now)
  drawSanta(c, W, H, g)
  drawGround(c, W, H, cam, g, night)

  const z = cam.zoom
  const m = minuteOfDay(g.time)
  const tl = screenToWorld(cam, W, H, 0, 0)
  const br = screenToWorld(cam, W, H, W, H)
  const fTop = tl.floor + 1
  const fBot = br.floor - 1
  const x0 = Math.max(0, Math.floor(tl.tile) - 1)
  const x1 = Math.min(TOWER_WIDTH - 1, Math.ceil(br.tile) + 1)
  const S = (wx: number, wy: number) => worldToScreen(cam, W, H, wx, wy)

  const drawn = new Set<number>()
  const visibleFacs: Facility[] = []
  const visibleShafts: Shaft[] = []

  // floors back-to-front
  for (let f = fBot; f <= fTop; f++) {
    const row = g.floors.get(f)
    if (!row) continue
    const yTop = floorTop(f)
    let i = x0
    while (i <= x1) {
      const v = row[i]
      if (v === -1) { i++; continue }
      if (v === 0) {
        let j = i
        while (j <= x1 && row[j] === 0) j++
        drawBareFloor(c, S(i * T, yTop), (j - i) * T * z, FH * z, z, f)
        i = j
        continue
      }
      if (!drawn.has(v)) {
        drawn.add(v)
        const fac = g.facilities.get(v)
        if (fac) visibleFacs.push(fac)
        else { const s = g.shafts.get(v); if (s) visibleShafts.push(s) }
      }
      i++
    }
  }

  for (const f of visibleFacs) drawFacility(c, g, f, S, z, m, now, ov)
  // roof caps + floor labels
  drawRoofs(c, g, S, z, fBot, fTop, x0, x1)
  for (const s of visibleShafts) drawShaft(c, g, s, S, z, fBot, fTop, now)
  drawPeople(c, g, S, z, fBot, fTop, now)
  drawFires(c, g, visibleFacs, S, z, now)
  drawFlashes(c, S, z, dt)
  drawSelectedPerson(c, g, ov, S, z, now)
  drawFx(c, g, S, z, dt)
  drawOverlay(c, g, ov, S, z, W, H)
  drawRuler(c, g, cam, W, H)
}

function drawBareFloor(c: CanvasRenderingContext2D, p: { x: number; y: number }, w: number, h: number, z: number, f: number) {
  c.fillStyle = f < 0 ? '#3a2c1e' : '#4a4e60'
  c.fillRect(p.x, p.y, w, h)
  c.fillStyle = f < 0 ? '#2e2216' : '#40445a'
  c.fillRect(p.x, p.y + h * 0.55, w, h * 0.45 - 3 * z)
  c.fillStyle = '#55596a'
  c.fillRect(p.x, p.y + h - 3 * z, w, 3 * z)
  c.fillRect(p.x, p.y, w, 2 * z)
  // girders
  c.strokeStyle = 'rgba(230,120,60,0.55)'
  c.lineWidth = Math.max(1, z)
  c.beginPath()
  const step = 32 * z
  for (let x = p.x; x < p.x + w; x += step) {
    c.moveTo(x, p.y + h - 3 * z); c.lineTo(Math.min(x + step, p.x + w), p.y + 2 * z)
  }
  c.stroke()
}

function drawFacility(c: CanvasRenderingContext2D, g: Game, f: Facility, S: (x: number, y: number) => { x: number; y: number }, z: number, m: number, now: number, ov: Overlay) {
  const def = FACILITIES[f.kind]
  const top = floorTop(f.floor + f.height - 1)
  const p = S(f.x * T, top)
  const w = f.width * T * z
  const h = f.height * FH * z
  const look = lookFor(g, f, m)
  if (f.kind === 'lobby') {
    const sky = f.floor > 0 ? 1 : 0
    const chunk = sprite('lobby', 8, 1, look, sky)
    for (let i = 0; i < f.width; i += 8) {
      const cw = Math.min(8, f.width - i)
      c.drawImage(chunk, 0, 0, cw * T, FH, p.x + i * T * z, p.y, cw * T * z, h)
    }
    if (f.floor === 0) {
      // entrance doors at both ends
      for (const ex of [p.x, p.x + w - 4 * z]) {
        c.fillStyle = '#495057'; c.fillRect(ex, p.y + 8 * z, 4 * z, h - 11 * z)
        c.fillStyle = 'rgba(165,216,255,0.8)'; c.fillRect(ex + z, p.y + 9 * z, 2 * z, h - 13 * z)
      }
    }
  } else {
    const variant = f.kind === 'office' || f.kind === 'condo' || f.kind === 'shop' ? f.id % 4 : 0
    const spr = sprite(f.kind, def.width, def.height, look, variant)
    if (f.kind === 'stairs' || f.kind === 'escalator') {
      // stairs rise into the floor above
      c.drawImage(spr, p.x, p.y, w, h)
    } else c.drawImage(spr, p.x, p.y, w, h)
  }
  if (f.kind === 'parking' && f.reachable) drawCar(c, p.x + 10 * z, p.y + h - 3 * z, z, f.id)
  if (f.kind === 'cathedral') drawSpire(c, p.x + w / 2, p.y, z)
  // people inside
  if (z >= 0.75 && f.inside > 0 && f.kind !== 'lobby' && f.kind !== 'parking') {
    const n = Math.min(f.inside, Math.max(1, Math.floor(f.width / 3)))
    const slot = (f.width * T) / (n + 1)
    for (let i = 0; i < n; i++) {
      const bob = Math.sin(now / 300 + i * 1.7 + f.id) > 0.6 ? 1 : 0
      drawPersonAt(c, p.x + slot * (i + 1) * z, p.y + h - 3 * z, z, personColor((f.id + i) % 8), bob, 0)
    }
  }
  // roaches
  if (f.roaches) {
    c.fillStyle = '#3b2314'
    for (let i = 0; i < 6; i++) {
      const t = now / 400 + i * 2.1
      const rx = p.x + ((Math.sin(t) * 0.5 + 0.5) * (w - 4 * z))
      const ry = p.y + h - 5 * z - (i % 3) * 5 * z
      c.fillRect(rx, ry, 2.2 * z, 1.4 * z)
    }
  }
  // mood view tint
  if (ov.moodView && f.kind !== 'lobby' && f.kind !== 'stairs' && f.kind !== 'escalator') {
    c.fillStyle = f.happiness >= 60 ? 'rgba(64,192,87,0.45)' : f.happiness >= 35 ? 'rgba(250,176,5,0.5)' : 'rgba(240,62,62,0.55)'
    c.fillRect(p.x, p.y, w, h)
  }
  if (!f.reachable && f.kind !== 'lobby' && f.kind !== 'stairs' && f.kind !== 'escalator' && f.kind !== 'parking' && Math.floor(now / 600) % 2 === 0) {
    c.fillStyle = 'rgba(255,60,60,0.25)'
    c.fillRect(p.x, p.y, w, h)
    if (z >= 0.75) {
      c.font = `${Math.round(11 * z)}px sans-serif`
      c.fillText('🚫', p.x + w / 2 - 6 * z, p.y + h / 2 + 4 * z)
    }
  }
  if (isHotel(f.kind) && f.booked && z >= 1 && m > 22 * 60) {
    c.fillStyle = '#fff'
    c.font = `${Math.round(7 * z)}px sans-serif`
    c.fillText('z', p.x + w - 12 * z + Math.sin(now / 500) * 2 * z, p.y + 10 * z)
  }
  if (ov.selected === f.id || ov.hover === f.id) {
    c.strokeStyle = ov.selected === f.id ? `rgba(255,212,59,${0.7 + 0.3 * Math.sin(now / 150)})` : 'rgba(255,255,255,0.8)'
    c.lineWidth = 2
    c.strokeRect(p.x + 1, p.y + 1, w - 2, h - 2)
  }
}

function drawSpire(c: CanvasRenderingContext2D, cx: number, y: number, z: number) {
  c.fillStyle = '#bfae94'
  c.beginPath(); c.moveTo(cx - 30 * z, y); c.lineTo(cx, y - 70 * z); c.lineTo(cx + 30 * z, y); c.fill()
  c.fillStyle = '#ffd43b'
  c.fillRect(cx - z, y - 86 * z, 2 * z, 16 * z)
  c.fillRect(cx - 5 * z, y - 80 * z, 10 * z, 2 * z)
}

function drawCar(c: CanvasRenderingContext2D, x: number, yb: number, z: number, seed: number) {
  const cols = ['#e03131', '#1c7ed6', '#f8f9fa', '#fab005', '#2f9e44']
  c.fillStyle = cols[seed % cols.length]
  c.fillRect(x, yb - 9 * z, 40 * z, 6 * z)
  c.fillRect(x + 8 * z, yb - 14 * z, 22 * z, 5 * z)
  c.fillStyle = '#a5d8ff'; c.fillRect(x + 10 * z, yb - 13 * z, 8 * z, 3 * z); c.fillRect(x + 20 * z, yb - 13 * z, 8 * z, 3 * z)
  c.fillStyle = '#212529'; c.fillRect(x + 5 * z, yb - 4 * z, 6 * z, 4 * z); c.fillRect(x + 29 * z, yb - 4 * z, 6 * z, 4 * z)
}

function drawRoofs(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => { x: number; y: number }, z: number, fBot: number, fTop: number, x0: number, x1: number) {
  for (let f = Math.max(0, fBot); f <= fTop; f++) {
    const row = g.floors.get(f)
    if (!row) continue
    const above = g.floors.get(f + 1)
    let i = x0
    while (i <= x1) {
      if (row[i] !== -1 && (!above || above[i] === -1)) {
        let j = i
        while (j <= x1 && row[j] !== -1 && (!above || above[j] === -1)) j++
        const p = S(i * T - 2, floorTop(f))
        const w = ((j - i) * T + 4) * z
        c.fillStyle = '#495057'
        c.fillRect(p.x, p.y - 3 * z, w, 3 * z)
        c.fillStyle = '#868e96'
        c.fillRect(p.x, p.y - 3 * z, w, z)
        i = j
      } else i++
    }
    // side walls
    let i2 = x0
    while (i2 <= x1) {
      if (row[i2] !== -1 && (i2 === 0 || row[i2 - 1] === -1)) {
        const p = S(i2 * T, floorTop(f))
        c.fillStyle = '#343a40'; c.fillRect(p.x - 2 * z, p.y, 2 * z, FH * z)
      }
      if (row[i2] !== -1 && (i2 === TOWER_WIDTH - 1 || row[i2 + 1] === -1)) {
        const p = S((i2 + 1) * T, floorTop(f))
        c.fillStyle = '#343a40'; c.fillRect(p.x, p.y, 2 * z, FH * z)
      }
      i2++
    }
  }
}

const CAR_COLORS: Record<string, [string, string]> = {
  elevator: ['#f2c14e', '#b8860b'],
  serviceElevator: ['#94d82d', '#5c940d'],
  expressElevator: ['#ff6b6b', '#c92a2a'],
}

function drawShaft(c: CanvasRenderingContext2D, _g: Game, s: Shaft, S: (x: number, y: number) => { x: number; y: number }, z: number, fBot: number, fTop: number, now: number) {
  const def = TRANSPORTS[s.kind]
  const w = def.width * T * z
  for (let f = Math.max(s.lo, fBot); f <= Math.min(s.hi, fTop); f++) {
    const p = S(s.x * T, floorTop(f))
    c.fillStyle = '#23252e'
    c.fillRect(p.x, p.y, w, FH * z)
    c.fillStyle = '#3a3d4a'
    c.fillRect(p.x + 2 * z, p.y, z, FH * z)
    c.fillRect(p.x + w - 3 * z, p.y, z, FH * z)
    if (s.stops[f]) {
      c.fillStyle = s.kind === 'expressElevator' ? '#c92a2a' : s.kind === 'serviceElevator' ? '#5c940d' : '#868e96'
      c.fillRect(p.x, p.y + FH * z - 3 * z, w, 3 * z)
      c.fillRect(p.x, p.y + 4 * z, 2 * z, FH * z - 7 * z)
      c.fillRect(p.x + w - 2 * z, p.y + 4 * z, 2 * z, FH * z - 7 * z)
    } else {
      c.fillStyle = '#2f323d'
      c.fillRect(p.x, p.y + FH * z - 3 * z, w, 3 * z)
    }
    // floor indicator light when people wait
    const q = s.q[f]
    if (q && (q.up.length || q.down.length)) {
      c.fillStyle = '#ffd43b'
      if (q.up.length) c.fillRect(p.x + w / 2 - 3 * z, p.y + 3 * z, 2 * z, 2 * z)
      if (q.down.length) c.fillRect(p.x + w / 2 + z, p.y + 3 * z, 2 * z, 2 * z)
    }
  }
  // cars
  const [body, trim] = CAR_COLORS[s.kind]
  for (const car of s.cars) {
    const pos = carPos(s, car)
    if (pos < fBot - 1 || pos > fTop + 1) continue
    const p = S(s.x * T, -(pos + 1) * FH)
    const cx = p.x + 3 * z
    const cw = w - 6 * z
    const cy = p.y + 4 * z
    const ch = FH * z - 7 * z
    c.fillStyle = trim
    c.fillRect(cx - z, cy - z, cw + 2 * z, ch + 2 * z)
    c.fillStyle = car.state === 'doors' ? '#fff9db' : body
    c.fillRect(cx, cy, cw, ch)
    // riders as heads
    const n = car.riders.length
    if (n > 0) {
      const per = Math.max(1, Math.floor(cw / (2.5 * z)))
      for (let i = 0; i < Math.min(n, per * 3); i++) {
        const rx = cx + (i % per) * 2.5 * z + 0.5 * z
        const ry = cy + ch - 3 * z - Math.floor(i / per) * 3 * z
        c.fillStyle = SHIRTS[(car.riders[i] ?? 0) % SHIRTS.length]
        c.fillRect(rx, ry, 2 * z, 3 * z)
        c.fillStyle = '#f1c27d'
        c.fillRect(rx, ry - 1.5 * z, 2 * z, 1.5 * z)
      }
    }
    if (car.state === 'doors') {
      // doors sliding
      const open = Math.min(1, (22 - car.timer) / 5)
      c.fillStyle = trim
      c.fillRect(cx, cy, (cw / 2) * (1 - open), ch)
      c.fillRect(cx + cw - (cw / 2) * (1 - open), cy, (cw / 2) * (1 - open), ch)
    }
    void now
  }
}

function drawPeople(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => { x: number; y: number }, z: number, fBot: number, fTop: number, now: number) {
  for (const p of g.people.values()) {
    if (p.state === 'walking') {
      if (p.floor < fBot || p.floor > fTop) continue
      const s = S(p.x * T, floorTop(p.floor) + FH - 3)
      drawPersonAt(c, s.x, s.y, z, personColor(p.shirt), Math.floor(p.x * 1.5) % 2, p.mood, p.shirt)
    } else if (p.state === 'climbing') {
      const L = p.legs[p.leg]
      const conn = g.facilities.get(L?.via ?? 0)
      if (!conn) continue
      const dur = conn.kind === 'escalator' ? 28 : 55
      const k = Math.min(1, p.climb / dur)
      const up = L.to > L.from
      const prog = up ? k : 1 - k
      const wx = (conn.x + 0.5 + prog * (conn.width - 1)) * T
      const wy = floorTop(conn.floor) + FH - 3 - prog * FH
      const s = S(wx, wy)
      drawPersonAt(c, s.x, s.y, z, personColor(p.shirt), Math.floor(now / 150) % 2, p.mood, p.shirt)
    }
  }
  // queues at shafts
  for (const s of g.shafts.values()) {
    const def = TRANSPORTS[s.kind]
    for (const k in s.q) {
      const f = +k
      if (f < fBot || f > fTop) continue
      const q = s.q[f]
      const yb = floorTop(f) + FH - 3
      const sides: [number[], number][] = [[q.up, -1], [q.down, 1]]
      for (const [list, side] of sides) {
        const shown = Math.min(list.length, 14)
        for (let i = 0; i < shown; i++) {
          const p = g.people.get(list[i])
          if (!p) continue
          const wx = side < 0 ? s.x * T - 3 - i * 3.2 : (s.x + def.width) * T + 3 + i * 3.2
          const sp = S(wx, yb)
          drawPersonAt(c, sp.x, sp.y, z, personColor(p.shirt), 0, p.mood, p.shirt)
        }
        if (list.length > 14 && z >= 0.6) {
          const wx = side < 0 ? s.x * T - 3 - 15 * 3.2 : (s.x + def.width) * T + 3 + 15 * 3.2
          const sp = S(wx, yb - 14)
          c.fillStyle = '#ff2d2d'
          c.font = `bold ${Math.max(9, Math.round(7 * z))}px sans-serif`
          c.fillText(`+${list.length - 14}`, sp.x - 6 * z, sp.y)
        }
      }
    }
  }
}

function drawFires(c: CanvasRenderingContext2D, g: Game, facs: Facility[], S: (x: number, y: number) => { x: number; y: number }, z: number, now: number) {
  for (const f of facs) {
    if (f.fire <= 0) continue
    const p = S(f.x * T, floorTop(f.floor + f.height - 1))
    const w = f.width * T * z
    const h = f.height * FH * z
    c.fillStyle = `rgba(30,0,0,${0.3 + f.fire * 0.4})`
    c.fillRect(p.x, p.y, w, h)
    const n = Math.ceil(f.width * 0.8)
    for (let i = 0; i < n; i++) {
      const fx = p.x + (i + 0.5) * (w / n)
      const fl = (8 + 14 * f.fire) * z * (0.7 + 0.3 * Math.sin(now / 80 + i * 1.3))
      c.fillStyle = i % 2 ? '#ff922b' : '#ffd43b'
      c.beginPath()
      c.moveTo(fx - 3 * z, p.y + h - 3 * z)
      c.quadraticCurveTo(fx - 4 * z, p.y + h - fl * 0.6, fx + Math.sin(now / 120 + i) * 2 * z, p.y + h - fl - 3 * z)
      c.quadraticCurveTo(fx + 4 * z, p.y + h - fl * 0.6, fx + 3 * z, p.y + h - 3 * z)
      c.fill()
    }
    // smoke
    c.fillStyle = 'rgba(80,80,80,0.35)'
    for (let i = 0; i < 3; i++) {
      const t = (now / 900 + i / 3) % 1
      c.beginPath()
      c.arc(p.x + w * (0.3 + 0.2 * i), p.y - t * 30 * z, (4 + t * 8) * z, 0, Math.PI * 2)
      c.fill()
    }
  }
  void g
}

function drawFx(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => { x: number; y: number }, z: number, dt: number) {
  c.textAlign = 'center'
  for (let i = g.fx.length - 1; i >= 0; i--) {
    const e = g.fx[i]
    e.age += dt
    if (e.age > 1.8) { g.fx.splice(i, 1); continue }
    if (z < 0.6) continue
    const p = S(e.x * T, floorTop(e.floor) + 8 - e.age * 22)
    c.globalAlpha = Math.max(0, 1 - e.age / 1.8)
    c.font = `bold ${Math.max(11, Math.round(8 * z))}px "Nunito", sans-serif`
    c.fillStyle = 'rgba(0,0,0,0.6)'
    c.fillText(e.text, p.x + 1, p.y + 1)
    c.fillStyle = e.color
    c.fillText(e.text, p.x, p.y)
  }
  c.globalAlpha = 1
  c.textAlign = 'left'
}

function drawOverlay(c: CanvasRenderingContext2D, g: Game, ov: Overlay, S: (x: number, y: number) => { x: number; y: number }, z: number, W: number, H: number) {
  let tip: { ok: boolean; cost: number; reason?: string } | null = null
  if (ov.ghost) {
    const gh = ov.ghost
    const p = S(gh.x * T, floorTop(gh.floor + gh.h - 1))
    const w = gh.w * T * z
    const h = gh.h * FH * z
    c.globalAlpha = 0.7
    if (gh.kind === 'lobby' || gh.kind === 'floor') {
      c.fillStyle = gh.kind === 'lobby' ? '#ffe8cc' : '#868e96'
      c.fillRect(p.x, p.y, w, h)
    } else {
      const def = FACILITIES[gh.kind]
      c.drawImage(sprite(gh.kind, def.width, def.height, 'day', 0), p.x, p.y, w, h)
    }
    c.globalAlpha = 1
    c.strokeStyle = gh.ok ? '#40c057' : '#fa5252'
    c.lineWidth = 2
    c.strokeRect(p.x, p.y, w, h)
    if (!gh.ok) { c.fillStyle = 'rgba(250,82,82,0.25)'; c.fillRect(p.x, p.y, w, h) }
    tip = gh
  }
  if (ov.shaftGhost) {
    const sg = ov.shaftGhost
    const p = S(sg.x * T, floorTop(sg.hi))
    const w = sg.w * T * z
    const h = (sg.hi - sg.lo + 1) * FH * z
    c.fillStyle = sg.ok ? 'rgba(64,192,87,0.35)' : 'rgba(250,82,82,0.35)'
    c.fillRect(p.x, p.y, w, h)
    c.strokeStyle = sg.ok ? '#40c057' : '#fa5252'
    c.lineWidth = 2
    c.strokeRect(p.x, p.y, w, h)
    tip = sg
    c.fillStyle = '#fff'
    c.font = `bold ${Math.max(10, Math.round(7 * z))}px sans-serif`
    c.fillText(`${sg.hi - sg.lo + 1} floors`, p.x + w + 6, p.y + 12)
  }
  if (ov.bulldoze) {
    const f = g.facilities.get(ov.bulldoze.id)
    const s = g.shafts.get(ov.bulldoze.id)
    let x = 0, top = 0, w = 0, h = 0
    if (f) { x = f.x; top = f.floor + f.height - 1; w = f.width; h = f.height }
    if (s) { x = s.x; top = s.hi; w = TRANSPORTS[s.kind].width; h = s.hi - s.lo + 1 }
    if (w) {
      const p = S(x * T, floorTop(top))
      c.fillStyle = 'rgba(250,82,82,0.45)'
      c.fillRect(p.x, p.y, w * T * z, h * FH * z)
      c.strokeStyle = '#fa5252'; c.lineWidth = 2
      c.strokeRect(p.x, p.y, w * T * z, h * FH * z)
    }
  }
  if (tip && ov.mouse) {
    const text = tip.ok ? `$${tip.cost.toLocaleString()}` : tip.reason ?? 'Can\'t build here'
    c.font = 'bold 13px "Nunito", sans-serif'
    const tw = c.measureText(text).width + 14
    let x = ov.mouse.sx + 16, y = ov.mouse.sy + 22
    if (x + tw > W) x = W - tw - 4
    if (y + 24 > H) y = H - 28
    c.fillStyle = tip.ok ? 'rgba(20,40,25,0.9)' : 'rgba(60,15,15,0.92)'
    roundRect(c, x, y, tw, 22, 6)
    c.fill()
    c.fillStyle = tip.ok ? '#8ce99a' : '#ffa8a8'
    c.fillText(text, x + 7, y + 15)
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function drawRuler(c: CanvasRenderingContext2D, g: Game, cam: Camera, W: number, H: number) {
  const z = cam.zoom
  if (z < 0.45) return
  const tl = screenToWorld(cam, W, H, 0, 0)
  const br = screenToWorld(cam, W, H, W, H)
  c.font = `900 ${Math.min(13, Math.max(9, Math.round(8 * z)))}px "Nunito", sans-serif`
  c.textAlign = 'right'
  for (let f = br.floor; f <= tl.floor; f++) {
    const row = g.floors.get(f)
    if (!row) continue
    const step = z < 0.8 ? 5 : 1
    if (f % step !== 0 && !isLobbyFloor(f)) continue
    let left = 0
    while (left < TOWER_WIDTH && row[left] === -1) left++
    const p = worldToScreen(cam, W, H, left * T - 6, floorTop(f) + FH / 2 + 4)
    const label = f === 0 ? 'L' : f < 0 ? `B${-f}` : `${f}`
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.fillText(label, p.x + 1, p.y + 1)
    c.fillStyle = f === 0 ? '#ffd43b' : isLobbyFloor(f) ? '#74c0fc' : '#f1f3f5'
    c.fillText(label, p.x, p.y)
  }
  c.textAlign = 'left'
}

function drawSanta(c: CanvasRenderingContext2D, W: number, H: number, g: Game) {
  if (g.flags.santaDay !== dayOf(g.time)) return
  const m = minuteOfDay(g.time)
  if (m < 19 * 60 || m > 21 * 60) return
  const k = (m - 19 * 60) / 120
  const x = W * (1.1 - k * 1.3)
  const y = H * 0.18 + Math.sin(k * 20) * 8
  c.font = '28px sans-serif'
  c.fillText('🛷🎅', x, y)
  c.font = '22px sans-serif'
  c.fillText('🦌🦌', x - 60, y - 4)
  void isWeekend
}

// ---------- extras ----------
function drawFlashes(c: CanvasRenderingContext2D, S: (x: number, y: number) => { x: number; y: number }, z: number, dt: number) {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]
    f.t += dt
    if (f.t > 0.6) { flashes.splice(i, 1); continue }
    const p = S(f.x * T, floorTop(f.top))
    const w = f.w * T * z, h = f.h * FH * z
    c.fillStyle = `rgba(255,255,255,${0.7 * (1 - f.t / 0.6)})`
    c.fillRect(p.x, p.y, w, h)
    // dust puffs
    c.fillStyle = `rgba(200,190,170,${0.6 * (1 - f.t / 0.6)})`
    for (let k = 0; k < 5; k++) {
      const px = p.x + (k / 4) * w
      c.beginPath()
      c.arc(px, p.y + h - f.t * 10 * z, (3 + f.t * 14) * z, 0, Math.PI * 2)
      c.fill()
    }
  }
}

function drawSelectedPerson(c: CanvasRenderingContext2D, g: Game, ov: Overlay, S: (x: number, y: number) => { x: number; y: number }, z: number, now: number) {
  if (!ov.person) return
  const p = g.people.get(ov.person)
  if (!p) return
  const pos = personPos(g, p)
  if (!pos) return
  const s = S(pos.tile * T, -(pos.floor) * FH - 3)
  const bob = Math.sin(now / 200) * 2
  c.fillStyle = '#ffd43b'
  c.beginPath()
  const y = s.y - 16 * z - 6 + bob
  c.moveTo(s.x - 5, y - 8); c.lineTo(s.x + 5, y - 8); c.lineTo(s.x, y)
  c.fill()
  c.strokeStyle = 'rgba(255,212,59,0.8)'
  c.lineWidth = 2
  c.beginPath()
  c.ellipse(s.x + z / 2, s.y, 6 * z, 2.5 * z, 0, 0, Math.PI * 2)
  c.stroke()
}

function dayHash(d: number) {
  let x = (d + 1) * 2654435761
  x ^= x >>> 13
  return (x >>> 0) % 100
}

const DROPS = Array.from({ length: 160 }, (_, i) => ({ x: (i * 7919) % 1000 / 1000, y: (i * 3571) % 1000 / 1000, v: 0.6 + ((i * 13) % 10) / 20 }))

function drawWeather(c: CanvasRenderingContext2D, W: number, H: number, g: Game, now: number) {
  const d = dayOf(g.time)
  const h = dayHash(d)
  const q = Math.floor(d / 3) % 4
  const m = minuteOfDay(g.time)
  const snow = q === 3 && h < 55
  const rain = !snow && h < 18 && m > 600 && m < 1080
  if (!snow && !rain) return
  if (rain) {
    c.fillStyle = 'rgba(40,50,70,0.18)'
    c.fillRect(0, 0, W, H)
    c.strokeStyle = 'rgba(190,210,255,0.45)'
    c.lineWidth = 1
    c.beginPath()
    for (const r of DROPS) {
      const y = ((r.y + now / 900 * r.v) % 1) * H
      const x = ((r.x + now / 9000) % 1) * W
      c.moveTo(x, y); c.lineTo(x - 3, y + 12)
    }
    c.stroke()
  } else {
    c.fillStyle = 'rgba(255,255,255,0.85)'
    for (const r of DROPS) {
      const y = ((r.y + now / 9000 * r.v) % 1) * H
      const x = ((r.x + Math.sin(now / 1500 + r.y * 20) * 0.01) % 1) * W
      c.fillRect(x, y, 2 + (r.v > 0.9 ? 1 : 0), 2 + (r.v > 0.9 ? 1 : 0))
    }
  }
}

function drawBirds(c: CanvasRenderingContext2D, W: number, H: number, g: Game, now: number, night: number) {
  if (night > 0.4) return
  const cycle = (now / 1000) % 40
  if (cycle > 14) return
  const k = cycle / 14
  c.strokeStyle = 'rgba(30,30,50,0.7)'
  c.lineWidth = 1.5
  for (let i = 0; i < 5; i++) {
    const x = -50 + k * (W + 100) + i * 18 - (i % 2) * 10
    const y = H * 0.22 + i * 7 + Math.sin(now / 300 + i) * 3
    const flap = Math.sin(now / 90 + i) * 3
    c.beginPath()
    c.moveTo(x - 5, y - flap); c.lineTo(x, y); c.lineTo(x + 5, y - flap)
    c.stroke()
  }
  void g
}

const FW_COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#b197fc', '#ffa94d']
function drawFireworks(c: CanvasRenderingContext2D, W: number, H: number, now: number, dt: number) {
  if (now < fireworksUntil && Math.random() < dt * 3) {
    rockets.push({ x: W * (0.15 + Math.random() * 0.7), y: H, vx: (Math.random() - 0.5) * 60, vy: -(H * 0.9 + Math.random() * H * 0.4), fuse: 0.7 + Math.random() * 0.5, color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)] })
  }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]
    r.x += r.vx * dt; r.y += r.vy * dt; r.vy += H * 0.6 * dt; r.fuse -= dt
    c.fillStyle = '#fff3bf'
    c.fillRect(r.x, r.y, 2, 5)
    if (r.fuse <= 0) {
      rockets.splice(i, 1)
      for (let k = 0; k < 46; k++) {
        const a = (k / 46) * Math.PI * 2
        const sp = 90 + Math.random() * 90
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.3, color: r.color })
      }
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 70 * dt; s.vx *= 0.985; s.life -= dt
    if (s.life <= 0) { sparks.splice(i, 1); continue }
    c.globalAlpha = Math.min(1, s.life)
    c.fillStyle = s.color
    c.fillRect(s.x, s.y, 2.5, 2.5)
  }
  c.globalAlpha = 1
}
