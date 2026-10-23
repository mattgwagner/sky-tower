// Canvas renderer: sky, city, ground, tower cut-away, elevators, people, effects.
import { FACILITIES, TOWER_WIDTH, TRANSPORTS, isCommercial, isConnector, isHotel, isLobbyFloor } from '../game/defs'
import type { FacilityKind } from '../game/defs'
import { carPos } from '../game/elevators'
import { TRAIN_EVERY, TRAIN_IN, climbSteps, entityNow, hidingOn, isOpen, launchClock, trainPhase, ufoTime, ufoX } from '../game/sim'
import type { Facility, Game, Person, Shaft } from '../game/state'
import { dayOf, isWeekend, minuteOfDay } from '../game/state'
import { hasPet } from '../game/people-info'
import { SLIDE_LOOKS, slidePos, slideProgress } from '../game/slide'
import { hasSpire, needsOpenSky } from '../game/roof'
import { topFloor } from '../game/world'
import { CLIMB_TOP, ZIP, INDIGO_LOOP, INDIGO_SCREEN, TOY_BELT, TOY_CASE, FAZ_COVE, FAZ_OFFICE, FAZ_STAGE, FAZ_TABLES, METRO_BOARD, METRO_TUNNEL, AQ_PAD, ARCADE_CABS, ARCADE_X, BOWL_PINS, CANDY_POPS, FH, GOLF_HOLE, GOLF_MILL, TRAMPS, ROCKET_X, SHIRTS, T, sprite } from './sprites'
import type { Look } from './sprites'
import { drawLightning, drawRainbow, drawShootingStars, weatherFor } from './sky-fx'
import { drawLooseMonkey, drawZoo } from './zoo'
import { drawRainforest } from './frogs'
import { drawMarket } from './market'
import { drawPlayground } from './playground'
import { drawConcertHall } from './concert'
import { pokeWobble } from './poke-fx'
import { drawHolidayAmbient, drawHolidayDecor, drawHolidayWear, holidaySky } from './holidays'
import { holidayBanner } from '../game/holidays'
import { drawSlide } from './slide'
import { drawGiants } from './giants'
import { drawRoofTopper } from './roof'
import { drawPartyCar, drawPartyDoors, drawPartyShaft } from './party'

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
      if (conn.kind === 'megaSlide') return slidePos(conn, slideProgress(p, conn))
      const k = Math.min(1, p.climb / climbSteps(conn.kind))
      const prog = L.to > L.from ? k : 1 - k
      return { tile: conn.kind === 'firePole' ? conn.x + conn.width / 2 : conn.x + 0.5 + prog * (conn.width - 1), floor: conn.floor + prog }
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
  const [top, bot, night] = holidaySky(g, skyColors(hour), hour)
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
  drawShootingStars(c, W, H, g, now, night)
  drawRainbow(c, W, H, g)
  drawBalloons(c, W, H, now, night)
  drawBlimp(c, W, H, g, now, night)
  drawSkyline(c, W, H, cam, night)
  drawBirds(c, W, H, g, now, night)
  drawFireworks(c, W, H, now, dt)
  drawWeather(c, W, H, g, now)
  drawLightning(c, W, H, g, now)
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
  drawTowerSign(c, g, S, z, night)
  for (const s of visibleShafts) drawShaft(c, g, s, S, z, fBot, fTop, now)
  drawPeople(c, g, S, z, fBot, fTop, now)
  if (drawHolidayAmbient(c, W, H, g, S, z, now)) launchFireworks(now, 10)
  drawGiants(c, g, S, z, now)
  for (const f of g.facilities.values()) if (f.kind === 'rocketPad') drawRocket(c, g, f, S, z, now)
  drawUfo(c, g, S, z, now)
  drawEntity(c, g, S, z, now)
  drawHuggyVent(c, g, S, z, now)
  drawLooseMonkey(c, g, S, z, now)
  drawFires(c, g, visibleFacs, S, z, now)
  drawFlashes(c, S, z, dt)
  drawSelectedPerson(c, g, ov, S, z, now)
  drawFx(c, g, S, z, dt)
  drawOverlay(c, g, ov, S, z, W, H)
  drawRuler(c, g, cam, W, H)
  drawJumpscare(c, W, H, now)
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
  const wob = pokeWobble(f.id, now)
  if (wob) { c.save(); c.translate(p.x + w / 2, p.y + h); c.scale(1 + wob.sx, 1 + wob.sy); c.rotate(wob.rot); c.translate(-(p.x + w / 2), -(p.y + h)) }
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
    const variant = f.kind === 'office' || f.kind === 'condo' || f.kind === 'shop' ? f.id % 4 : f.kind === 'megaSlide' ? f.id % SLIDE_LOOKS.length : 0
    const spr = sprite(f.kind, def.width, f.height, look, variant)
    if (f.kind === 'stairs' || f.kind === 'escalator') {
      // stairs rise into the floor above
      c.drawImage(spr, p.x, p.y, w, h)
    } else c.drawImage(spr, p.x, p.y, w, h)
  }
  drawRoofTopper(c, g, f, p, w, h, z, now, m)
  if (f.kind === 'parking' && f.reachable) drawCar(c, p.x + 10 * z, p.y + h - 3 * z, z, f.id)
  if (f.kind === 'cathedral' && !hasSpire(g)) drawSpire(c, p.x + w / 2, p.y, z)
  if (z >= 0.6) drawFun(c, g, f, p, w, h, z, now, m)
  drawHolidayDecor(c, g, f, p, w, h, z, now, m)
  if (isHotel(f.kind) && z >= 1.2) drawDoorPlate(c, g, f, p, w, h, z)
  const ent = entityNow(g)
  if (ent && ent.kind === 'rush' && ent.floor === f.floor && f.height === 1) {
    // the lights flicker before Rush comes, and stay dark while it passes
    const dark = ent.warning ? (Math.sin(now / 47) + Math.sin(now / 131) > 0.6 ? 0.75 : 0.15 + ent.k * 0.3) : 0.8
    c.fillStyle = `rgba(0,0,0,${dark})`
    c.fillRect(p.x, p.y, w, h)
  }
  if (wob) c.restore()
  // people inside
  if (z >= 0.75 && f.inside > 0 && f.kind !== 'lobby' && f.kind !== 'parking' && f.kind !== 'market' && f.kind !== 'playground' && !hidingOn(g, f.floor)) {
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
  if (ov.moodView && f.kind !== 'lobby' && !isConnector(f.kind)) {
    c.fillStyle = f.happiness >= 60 ? 'rgba(64,192,87,0.45)' : f.happiness >= 35 ? 'rgba(250,176,5,0.5)' : 'rgba(240,62,62,0.55)'
    c.fillRect(p.x, p.y, w, h)
  }
  if (!f.reachable && f.kind !== 'lobby' && !isConnector(f.kind) && f.kind !== 'parking' && Math.floor(now / 600) % 2 === 0) {
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
  const open = (v: number) => {
    if (v === -1) return true
    const k = v > 0 ? g.facilities.get(v)?.kind : undefined
    return !!k && needsOpenSky(k)
  }
  for (let f = Math.max(0, fBot); f <= fTop; f++) {
    const row = g.floors.get(f)
    if (!row) continue
    const above = g.floors.get(f + 1)
    let i = x0
    while (i <= x1) {
      if (!open(row[i]) && (!above || open(above[i]))) {
        let j = i
        while (j <= x1 && !open(row[j]) && (!above || open(above[j]))) j++
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
      if (!open(row[i2]) && (i2 === 0 || open(row[i2 - 1]))) {
        const p = S(i2 * T, floorTop(f))
        c.fillStyle = '#343a40'; c.fillRect(p.x - 2 * z, p.y, 2 * z, FH * z)
      }
      if (!open(row[i2]) && (i2 === TOWER_WIDTH - 1 || open(row[i2 + 1]))) {
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
  partyElevator: ['#da77f2', '#862e9c'],
}

function drawShaft(c: CanvasRenderingContext2D, g: Game, s: Shaft, S: (x: number, y: number) => { x: number; y: number }, z: number, fBot: number, fTop: number, now: number) {
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
    if (s.kind === 'partyElevator') drawPartyShaft(c, g, p.x, p.y, w, z, now)
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
    if (s.kind === 'partyElevator') drawPartyCar(c, g, car, cx, cy, cw, ch, z, now, S(0, floorTop(s.hi)).y, S(0, floorTop(s.lo) + FH).y)
    if (car.state === 'doors') {
      // doors sliding
      const open = Math.min(1, (22 - car.timer) / 5)
      c.fillStyle = trim
      c.fillRect(cx, cy, (cw / 2) * (1 - open), ch)
      c.fillRect(cx + cw - (cw / 2) * (1 - open), cy, (cw / 2) * (1 - open), ch)
      if (s.kind === 'partyElevator') drawPartyDoors(c, g, car, p.x, cy, w, ch, z, now, open)
    }
  }
}

function drawPeople(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => { x: number; y: number }, z: number, fBot: number, fTop: number, now: number) {
  for (const p of g.people.values()) {
    if (p.state === 'walking') {
      if (p.floor < fBot || p.floor > fTop) continue
      if (hidingOn(g, p.floor)) continue
      const s = S(p.x * T, floorTop(p.floor) + FH - 3)
      drawPersonAt(c, s.x, s.y, z, personColor(p.shirt), Math.floor(p.x * 1.5) % 2, p.mood, p.shirt)
      drawHolidayWear(c, g, p, s.x, s.y, z)
      const pet = hasPet(p)
      if (pet && z >= 0.6) {
        const tx = p.leg < p.legs.length ? p.legs[p.leg].x : p.goalX
        const dir = tx >= p.x ? 1 : -1
        drawPet(c, s.x - dir * 6 * z, s.y, z, pet, Math.floor(p.x * 2) % 2, dir)
      }
    } else if (p.state === 'climbing') {
      const L = p.legs[p.leg]
      const conn = g.facilities.get(L?.via ?? 0)
      if (!conn) continue
      if (conn.kind === 'megaSlide') {
        // zoomed in, drawSlide puts riders inside the tube; zoomed out, draw them here
        if (z >= 0.6) continue
        const q = slidePos(conn, slideProgress(p, conn))
        const s = S(q.tile * T, floorTop(q.floor) + FH - 3)
        drawPersonAt(c, s.x, s.y, z, personColor(p.shirt), 0, p.mood, p.shirt)
        continue
      }
      const k = Math.min(1, p.climb / climbSteps(conn.kind))
      const up = L.to > L.from
      const prog = up ? k : 1 - k
      const wx = (conn.kind === 'firePole' ? conn.x + conn.width / 2 - 0.15 : conn.x + 0.5 + prog * (conn.width - 1)) * T
      const wy = floorTop(conn.floor) + FH - 3 - prog * FH
      const s = S(wx, wy)
      drawPersonAt(c, s.x, s.y, z, personColor(p.shirt), Math.floor(now / 150) % 2, p.mood, p.shirt)
      drawHolidayWear(c, g, p, s.x, s.y, z)
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
      c.drawImage(sprite(gh.kind, def.width, gh.h, 'day', 0), p.x, p.y, w, h)
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

const DROPS = Array.from({ length: 160 }, (_, i) => ({ x: (i * 7919) % 1000 / 1000, y: (i * 3571) % 1000 / 1000, v: 0.6 + ((i * 13) % 10) / 20 }))

function drawWeather(c: CanvasRenderingContext2D, W: number, H: number, g: Game, now: number) {
  const { rain, snow } = weatherFor(g)
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

// ---------- whimsy ----------
type Pt = { x: number; y: number }

function drawPet(c: CanvasRenderingContext2D, x: number, yb: number, z: number, kind: 'dog' | 'cat', frame: number, dir: number) {
  const col = kind === 'dog' ? '#b07a45' : '#495057'
  c.fillStyle = col
  c.fillRect(x - 2 * z, yb - 3 * z, 4 * z, 2 * z) // body
  c.fillRect(x + dir * 2 * z - (dir < 0 ? 2 * z : 0), yb - 4.5 * z, 2 * z, 2 * z) // head
  if (kind === 'cat') { c.fillRect(x + dir * 2.2 * z - (dir < 0 ? 1.6 * z : 0), yb - 5.3 * z, 0.6 * z, 0.8 * z) }
  else { c.fillStyle = '#7a4f2a'; c.fillRect(x + dir * 2.4 * z - (dir < 0 ? 1.2 * z : 0), yb - 4.5 * z, 0.8 * z, 1.4 * z) }
  c.fillStyle = col
  const tail = frame ? -0.6 : 0.6
  c.fillRect(x - dir * 2.6 * z - (dir > 0 ? 0 : -0.4 * z), yb - (3.8 + tail) * z, 0.8 * z, 1.6 * z) // wagging tail
  c.fillStyle = '#2b2b38'
  c.fillRect(x - 1.6 * z, yb - 1 * z, 0.7 * z, (frame ? 1 : 0.6) * z)
  c.fillRect(x + 1 * z, yb - 1 * z, 0.7 * z, (frame ? 0.6 : 1) * z)
}

/** Animated details for the Fun Zone rooms (drawn on top of the cached sprite). */
function drawFun(c: CanvasRenderingContext2D, g: Game, f: Facility, p: Pt, w: number, h: number, z: number, now: number, m: number) {
  switch (f.kind) {
    case 'megaSlide': return drawSlide(c, g, f, p, z, now)
    case 'arcade': {
      if (!isOpen(g, f) && f.inside === 0) return
      for (let i = 0; i < ARCADE_CABS; i++) {
        const hue = (now / 8 + i * 70) % 360
        c.fillStyle = `hsl(${hue},90%,${55 + 15 * Math.sin(now / 120 + i)}%)`
        c.fillRect(p.x + (ARCADE_X[i] + 2) * z, p.y + h - 21 * z, 6 * z, 6 * z)
        c.fillStyle = '#fff'
        c.fillRect(p.x + (ARCADE_X[i] + 3 + ((now / 90 + i * 2) % 4)) * z, p.y + h - 18 * z, z, z)
      }
      return
    }
    case 'aquarium': {
      const x0 = p.x + AQ_PAD * z, x1 = p.x + w - AQ_PAD * z
      const top = p.y + 18 * z, bot = p.y + h - 14 * z
      c.save()
      c.beginPath(); c.rect(x0, p.y + 4 * z, x1 - x0, h - 10 * z); c.clip()
      const span = x1 - x0 + 40 * z
      for (let i = 0; i < 7; i++) {
        const sp = (0.012 + (i % 3) * 0.006) * z
        const dir = i % 2 ? 1 : -1
        const k = (now * sp + i * 97 * z) % span
        const fx = dir > 0 ? x0 - 20 * z + k : x1 + 20 * z - k
        const fy = top + ((i * 37) % 100) / 100 * (bot - top) + Math.sin(now / 400 + i) * 2 * z
        const col = ['#ff922b', '#ffd43b', '#f06595', '#20c997', '#cc5de8', '#ff6b6b', '#fff'][i]
        fish(c, fx, fy, 3 * z, dir, col)
      }
      // the shark
      const sk = (now * 0.008 * z) % (span + 80 * z)
      const sx = x1 + 40 * z - sk
      const sy = top + (bot - top) * 0.35 + Math.sin(now / 900) * 4 * z
      c.fillStyle = '#868e96'
      c.beginPath(); c.ellipse(sx, sy, 14 * z, 4 * z, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.moveTo(sx - 2 * z, sy - 3 * z); c.lineTo(sx + 3 * z, sy - 10 * z); c.lineTo(sx + 5 * z, sy - 3 * z); c.fill()
      c.beginPath(); c.moveTo(sx + 12 * z, sy); c.lineTo(sx + 19 * z, sy - 6 * z); c.lineTo(sx + 19 * z, sy + 5 * z); c.fill()
      c.fillStyle = '#e9ecef'; c.beginPath(); c.ellipse(sx - 2 * z, sy + 2 * z, 9 * z, 1.6 * z, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#111'; c.fillRect(sx - 10 * z, sy - 1.5 * z, 1.2 * z, 1.2 * z)
      c.fillStyle = '#fff'; for (let t = 0; t < 4; t++) c.fillRect(sx - 12 * z + t * 1.5 * z, sy + 1 * z, 0.8 * z, 0.8 * z)
      // jellyfish
      const jx = x0 + (x1 - x0) * 0.72, jy = top + 6 * z + Math.sin(now / 700) * 6 * z
      c.fillStyle = 'rgba(255,170,220,0.8)'
      c.beginPath(); c.arc(jx, jy, 4 * z, Math.PI, 0); c.fill()
      for (let t = 0; t < 4; t++) c.fillRect(jx - 3 * z + t * 2 * z, jy, 0.6 * z, (4 + Math.sin(now / 200 + t) * 1.5) * z)
      // bubbles
      c.fillStyle = 'rgba(255,255,255,0.6)'
      for (let i = 0; i < 8; i++) {
        const k2 = ((now / 2200 + i / 8) % 1)
        c.fillRect(x0 + ((i * 53) % 100) / 100 * (x1 - x0), bot + 6 * z - k2 * (bot - p.y), 1.4 * z, 1.4 * z)
      }
      c.restore()
      return
    }
    case 'hauntedHouse': {
      for (let i = 0; i < 3; i++) {
        const gx = p.x + w * (0.25 + i * 0.25) + Math.sin(now / 900 + i * 2) * 12 * z
        const gy = p.y + h * 0.42 + Math.sin(now / 500 + i) * 6 * z
        c.globalAlpha = 0.55 + 0.35 * Math.sin(now / 700 + i * 1.3)
        c.fillStyle = '#f8f9fa'
        c.beginPath()
        c.arc(gx, gy, 5 * z, Math.PI, 0)
        c.lineTo(gx + 5 * z, gy + 7 * z)
        for (let k = 0; k < 3; k++) c.lineTo(gx + (3 - k * 3.3) * z, gy + (k % 2 ? 7 : 5) * z)
        c.lineTo(gx - 5 * z, gy + 7 * z)
        c.fill()
        c.globalAlpha = 1
        c.fillStyle = '#212529'
        c.fillRect(gx - 2.5 * z, gy - 1 * z, 1.4 * z, 2 * z); c.fillRect(gx + 1 * z, gy - 1 * z, 1.4 * z, 2 * z)
        c.fillRect(gx - 0.8 * z, gy + 2.5 * z, 1.6 * z, 1.6 * z)
      }
      c.strokeStyle = '#111'; c.lineWidth = Math.max(1, z)
      for (let i = 0; i < 2; i++) {
        const bx = p.x + ((now / 30 * z + i * 60 * z) % w)
        const by = p.y + 12 * z + Math.sin(now / 200 + i * 3) * 4 * z
        const flap = Math.sin(now / 60 + i) * 2 * z
        c.beginPath(); c.moveTo(bx - 4 * z, by - flap); c.lineTo(bx, by); c.lineTo(bx + 4 * z, by - flap); c.stroke()
      }
      return
    }
    case 'pool': {
      const x0 = p.x + 16 * z, x1 = p.x + w - 16 * z, wy = p.y + h - 14 * z
      c.fillStyle = 'rgba(28,126,214,0.55)'
      c.fillRect(x0, wy + 3 * z, x1 - x0, 8 * z)
      c.fillStyle = 'rgba(255,255,255,0.7)'
      for (let x = x0; x < x1; x += 10 * z) c.fillRect(x + ((now / 60) % 10) * z * 0.5, wy + 3 * z + Math.sin(now / 300 + x) * z, 4 * z, 0.8 * z)
      const open = isOpen(g, f) || f.inside > 0
      if (!open) return
      for (let i = 0; i < Math.min(5, 2 + f.inside); i++) {
        const sx = x0 + ((now / (40 + i * 13) * z + i * 40 * z) % (x1 - x0 - 4 * z))
        const sy = wy + 3 * z + Math.sin(now / 250 + i) * 0.8 * z
        c.fillStyle = '#f1c27d'; c.fillRect(sx, sy - 2 * z, 2.2 * z, 2.2 * z)
        c.fillStyle = SHIRTS[i % SHIRTS.length]; c.fillRect(sx - 0.2 * z, sy - 2.6 * z, 2.6 * z, 0.8 * z)
      }
      // beach ball
      const bx = x0 + (x1 - x0) * 0.5 + Math.sin(now / 1300) * 20 * z
      const by = wy - Math.abs(Math.sin(now / 350)) * 9 * z
      c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 2.5 * z, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#e03131'; c.beginPath(); c.arc(bx, by, 2.5 * z, 0, Math.PI / 1.5); c.lineTo(bx, by); c.fill()
      c.fillStyle = '#1c7ed6'; c.beginPath(); c.arc(bx, by, 2.5 * z, Math.PI, Math.PI * 1.66); c.lineTo(bx, by); c.fill()
      return
    }
    case 'pizza': {
      // oven fire, and dough spinning up into the air
      for (let i = 0; i < 3; i++) {
        c.fillStyle = i % 2 ? '#ff922b' : '#ffd43b'
        const fh = (3 + Math.sin(now / 90 + i * 2) * 1.5) * z
        c.beginPath(); c.moveTo(p.x + (12 + i * 3) * z, p.y + h - 3 * z); c.lineTo(p.x + (13.5 + i * 3) * z, p.y + h - 3 * z - fh); c.lineTo(p.x + (15 + i * 3) * z, p.y + h - 3 * z); c.fill()
      }
      if (!isOpen(g, f)) return
      const toss = Math.abs(Math.sin(now / 420))
      const dx = p.x + 56 * z, dy = p.y + h - 20 * z - toss * 9 * z
      c.fillStyle = '#f1c27d'; c.fillRect(dx - 1.5 * z, p.y + h - 17 * z, 3 * z, 3 * z)
      c.fillStyle = SHIRTS[0]; c.fillRect(dx - 1.5 * z, p.y + h - 14 * z, 3 * z, 4 * z)
      c.fillStyle = '#fff'; c.fillRect(dx - 1.5 * z, p.y + h - 18.5 * z, 3 * z, 1.5 * z)
      c.fillStyle = '#f4dfb0'
      c.beginPath(); c.ellipse(dx, dy, 5 * z, (1 + 1.2 * Math.abs(Math.cos(now / 160))) * z, 0, 0, Math.PI * 2); c.fill()
      return
    }
    case 'tacos': {
      if (!isOpen(g, f)) return
      c.fillStyle = 'rgba(255,255,255,0.55)'
      for (let i = 0; i < 3; i++) {
        const k = (now / 1200 + i / 3) % 1
        c.beginPath(); c.arc(p.x + (10 + i * 8) * z + Math.sin(now / 300 + i) * z, p.y + h - 15 * z - k * 12 * z, (1 + k * 2) * z, 0, Math.PI * 2); c.fill()
      }
      return
    }
    case 'sushi': {
      // plates riding the conveyor belt
      const x0 = p.x + 6 * z, len = w - 12 * z
      const cols: [string, string][] = [['#ff8787', '#fff'], ['#ff922b', '#fff'], ['#212529', '#fff'], ['#ffd43b', '#fff'], ['#69db7c', '#fff']]
      const n = Math.floor(len / (12 * z))
      for (let i = 0; i < n; i++) {
        const x = x0 + ((now / 70 * z + i * 12 * z) % len)
        const [fish, rice] = cols[i % cols.length]
        c.fillStyle = i % 2 ? '#4dabf7' : '#fff'; c.fillRect(x, p.y + h - 16 * z, 6 * z, 1 * z)
        c.fillStyle = rice; c.fillRect(x + 1 * z, p.y + h - 18 * z, 4 * z, 2 * z)
        c.fillStyle = fish; c.fillRect(x + 1 * z, p.y + h - 19 * z, 4 * z, 1.2 * z)
      }
      return
    }
    case 'donuts': {
      // a giant spinning donut with sprinkles
      const cx = p.x + w - 12 * z, cy = p.y + h - 14 * z
      c.fillStyle = '#d9a03f'; c.beginPath(); c.arc(cx, cy, 8 * z, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#f783ac'; c.beginPath(); c.arc(cx, cy, 6.8 * z, 0, Math.PI * 2); c.fill()
      const sp = ['#fff', '#ffd43b', '#4dabf7', '#69db7c', '#ff6b6b']
      for (let i = 0; i < 10; i++) {
        const a = now / 900 + i * 0.63
        c.fillStyle = sp[i % sp.length]
        c.fillRect(cx + Math.cos(a) * 5 * z, cy + Math.sin(a) * 5 * z, 1.2 * z, 1.2 * z)
      }
      c.fillStyle = '#fff3f8'; c.beginPath(); c.arc(cx, cy, 2.6 * z, 0, Math.PI * 2); c.fill()
      return
    }
    case 'pancakes': {
      if (!isOpen(g, f)) return
      // flip! and a stack with melting butter + steam
      const t = (now % 1600) / 1600
      const fx = p.x + 18 * z, fy = p.y + h - 14 * z - Math.sin(t * Math.PI) * 10 * z
      c.save(); c.translate(fx, fy); c.rotate(t * Math.PI * 2)
      c.fillStyle = '#e8b04f'; c.fillRect(-4 * z, -1 * z, 8 * z, 2 * z)
      c.fillStyle = '#c98a2c'; c.fillRect(-4 * z, 0.4 * z, 8 * z, 0.6 * z)
      c.restore()
      const sx = p.x + 40 * z, sb = p.y + h - 13 * z
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#e8b04f' : '#d9982f'; c.fillRect(sx - 4 * z, sb - (i + 1) * 1.6 * z, 8 * z, 1.6 * z) }
      c.fillStyle = '#ffec99'; c.fillRect(sx - 1.5 * z, sb - 9.4 * z, 3 * z, 1.4 * z)
      c.fillStyle = '#b5651d'; c.fillRect(sx - 4 * z, sb - 8 * z, 8 * z, 0.8 * z); c.fillRect(sx + 3 * z, sb - 8 * z, 0.8 * z, (3 + Math.sin(now / 500) * 1) * z)
      c.fillStyle = 'rgba(255,255,255,0.5)'
      for (let i = 0; i < 2; i++) {
        const k = (now / 1400 + i / 2) % 1
        c.beginPath(); c.arc(sx + Math.sin(now / 400 + i * 3) * 2 * z, sb - 10 * z - k * 8 * z, (0.8 + k * 1.5) * z, 0, Math.PI * 2); c.fill()
      }
      return
    }
    case 'candy': {
      // spinning lollipop swirls
      CANDY_POPS.forEach((lx, i) => {
        const cx = p.x + (lx + 0.5) * z, cy = p.y + h - 17 * z, rad = 5 * z
        c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill()
        for (let k = 0; k < 6; k++) {
          const a = (i ? -1 : 1) * now / 500 + (k * Math.PI) / 3
          c.fillStyle = i ? (k % 2 ? '#4dabf7' : '#da77f2') : (k % 2 ? '#ff6b6b' : '#ffd43b')
          c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, rad, a, a + Math.PI / 6); c.fill()
        }
      })
      return
    }
    case 'trampoline': {
      const open = isOpen(g, f) || f.inside > 0
      if (!open) return
      for (let i = 0; i < TRAMPS; i++) {
        const period = 700 + i * 90
        const ph = ((now + i * 260) % period) / period
        const hop = Math.sin(ph * Math.PI)
        const cx = p.x + (6 + i * 26 + 11) * z
        const yb = p.y + h - 8 * z - hop * 34 * z
        const flip = i % 2 === 1 && Math.floor(now / period + i) % 3 === 0
        c.save(); c.translate(cx, yb - 4 * z)
        if (flip) c.rotate(ph * Math.PI * 2)
        drawPersonAt(c, 0, 4 * z, z, SHIRTS[(i * 3 + f.id) % SHIRTS.length], hop > 0.6 ? 1 : 0, 0)
        c.restore()
      }
      return
    }
    case 'climbing': {
      if (!isOpen(g, f) && f.inside === 0) return
      // climb the wall, ring the bell, walk to the platform, ZIP down the line, land, walk back, repeat
      const X = (sx: number) => p.x + sx * z
      const Y = (sy: number) => p.y + sy * z
      const H = h / z
      const [ax, ay, bx, by] = ZIP
      const lanes = [18, 32, 44]
      const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))
      c.font = `bold ${Math.round(6 * z)}px sans-serif`
      for (let i = 0; i < 3; i++) {
        const period = 12000 + i * 1700
        const k = ((now + i * 4300) % period) / period
        const col = SHIRTS[(i + f.id) % SHIRTS.length]
        const lane = lanes[i]
        const walkFrame = Math.floor(now / 160 + i) % 2
        if (k < 0.45) {
          const yb = lerp(H - 6, CLIMB_TOP, k / 0.45)
          c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = Math.max(0.5, 0.5 * z)
          c.beginPath(); c.moveTo(X(lane + 0.5), Y(CLIMB_TOP - 2)); c.lineTo(X(lane + 0.5), Y(yb - 9)); c.stroke()
          drawPersonAt(c, X(lane), Y(yb), z, col, walkFrame, 0)
        } else if (k < 0.52) {
          const t = (k - 0.45) / 0.07
          drawPersonAt(c, X(lerp(lane, 10, t)), Y(CLIMB_TOP - 2), z, col, walkFrame, 0)
          if (t < 0.4) { c.fillStyle = '#ffe066'; c.fillText('DING!', X(46), Y(CLIMB_TOP - 10)) }
        } else if (k < 0.74) {
          const t = ((k - 0.52) / 0.22) ** 1.5
          const cx = lerp(ax, bx, t), cy = lerp(ay, by, t)
          c.fillStyle = '#868e96'; c.fillRect(X(cx - 1.5), Y(cy - 1), 3 * z, 2 * z)
          c.strokeStyle = '#212529'; c.lineWidth = Math.max(0.5, 0.6 * z)
          c.beginPath(); c.moveTo(X(cx), Y(cy + 1)); c.lineTo(X(cx), Y(cy + 4)); c.stroke()
          drawPersonAt(c, X(cx - 0.5), Y(cy + 13.5), z, col, 1, 0)
          c.fillStyle = '#f1c27d'; c.fillRect(X(cx - 1), Y(cy + 3), 0.8 * z, 3 * z); c.fillRect(X(cx + 0.6), Y(cy + 3), 0.8 * z, 3 * z)
          if (t > 0.1 && t < 0.9) { c.fillStyle = '#ffe066'; c.fillText('WHEEE!', X(cx + 4), Y(cy + 2)) }
        } else if (k < 0.78) {
          drawPersonAt(c, X(bx - 1), Y(lerp(by + 13.5, H - 6, (k - 0.74) / 0.04)), z, col, 0, 0)
        } else {
          drawPersonAt(c, X(lerp(bx - 1, lane, (k - 0.78) / 0.22)), Y(H - 6), z, col, walkFrame, 0)
        }
      }
      return
    }
    case 'miniGolf': {
      // windmill blades
      const mx = p.x + GOLF_MILL * z, my = p.y + h - 20 * z
      c.fillStyle = '#fff'
      for (let k = 0; k < 4; k++) {
        const a = now / 600 + (k * Math.PI) / 2
        c.save(); c.translate(mx, my); c.rotate(a); c.fillRect(-1 * z, 0, 2 * z, 9 * z); c.restore()
      }
      if (!isOpen(g, f) && f.inside === 0) return
      // golfer and a ball rolling to the hole
      drawPersonAt(c, p.x + 12 * z, p.y + h - 6 * z, z, SHIRTS[(f.id + 2) % SHIRTS.length], 0, 0)
      const k = (now % 7000) / 7000
      const bx = p.x + (16 + Math.min(1, k * 1.15) * (GOLF_HOLE - 16)) * z
      const hill = Math.max(0, 1 - Math.abs(bx - (p.x + 52 * z)) / (14 * z)) * 3 * z
      if (k < 0.87) { c.fillStyle = '#fff'; c.fillRect(bx - z, p.y + h - 8 * z - hill, 2 * z, 2 * z) }
      else { c.fillStyle = '#ffe066'; c.font = `bold ${Math.round(6 * z)}px sans-serif`; c.fillText('Hole in one!', p.x + (GOLF_HOLE - 24) * z, p.y + h - 22 * z) }
      return
    }
    case 'bowling': {
      const k = (now % 4500) / 4500
      const hit = k > 0.62
      // pins: standing, then scattered, then reset
      const pinsX = p.x + BOWL_PINS * z, py = p.y + h - 8 * z
      for (let i = 0; i < 4; i++) {
        const dx = (i % 2) * 3 * z + Math.floor(i / 2) * 5 * z
        c.save(); c.translate(pinsX + dx, py)
        if (hit && k < 0.95) c.rotate((i % 2 ? 1 : -1) * Math.min(1.4, (k - 0.62) * 8))
        c.fillStyle = '#fff'; c.fillRect(-1 * z, -6 * z, 2 * z, 6 * z)
        c.fillStyle = '#e03131'; c.fillRect(-1 * z, -4.5 * z, 2 * z, 0.8 * z)
        c.restore()
      }
      if (!isOpen(g, f) && f.inside === 0) return
      if (k < 0.62) {
        const bx = p.x + (26 + (k / 0.62) * (BOWL_PINS - 30)) * z
        c.fillStyle = '#7048e8'; c.beginPath(); c.arc(bx, py - 2 * z, 2.2 * z, 0, Math.PI * 2); c.fill()
      } else if (k < 0.85) {
        c.fillStyle = '#ffe066'; c.font = `bold ${Math.round(8 * z)}px sans-serif`
        c.fillText('STRIKE!', pinsX - 40 * z, p.y + 16 * z)
      }
      drawPersonAt(c, p.x + 24 * z, py, z, SHIRTS[(f.id + 4) % SHIRTS.length], 1, 0)
      return
    }
    case 'rollerRink': {
      const open = isOpen(g, f) || f.inside > 0
      if (!open) return
      const cols = ['rgba(255,107,107,0.35)', 'rgba(77,171,247,0.35)', 'rgba(255,212,59,0.35)', 'rgba(105,219,124,0.35)']
      for (let i = 0; i < 4; i++) {
        c.fillStyle = cols[i]
        const lx = p.x + w * (0.5 + 0.4 * Math.sin(now / (900 + i * 170) + i * 2))
        c.beginPath(); c.ellipse(lx, p.y + h - 5 * z, 10 * z, 2.5 * z, 0, 0, Math.PI * 2); c.fill()
      }
      for (let i = 0; i < Math.min(6, 3 + f.inside); i++) {
        const a = now / (1800 + i * 240) + i * 1.3
        const sx = p.x + w / 2 + Math.sin(a) * (w / 2 - 16 * z)
        drawPersonAt(c, sx, p.y + h - 6 * z, z, SHIRTS[(i + f.id) % SHIRTS.length], 0, 0)
        c.fillStyle = '#e64980'; c.fillRect(sx - 1 * z, p.y + h - 6 * z, 3 * z, 0.8 * z)
      }
      return
    }
    case 'fazbear': {
      drawFazbear(c, g, f, p, w, h, z, now, m)
      return
    }
    case 'metro': {
      drawTrain(c, g, p, w, h, z, now)
      return
    }
    case 'toyFactory': {
      drawToyFactory(c, g, f, p, w, h, z, now, m)
      return
    }
    case 'indigoPark': {
      drawIndigo(c, g, f, p, w, h, z, now, m)
      return
    }
    case 'library': {
      if (m >= 21 * 60 || m < 6 * 60) {
        // after closing, something tall and blind wanders the stacks
        c.fillStyle = 'rgba(10,0,0,0.6)'
        c.fillRect(p.x, p.y, w, h)
        const fx0 = p.x + w * (0.5 + 0.38 * Math.sin(now / 5200))
        const dir = Math.cos(now / 5200) >= 0 ? 1 : -1
        drawFigure(c, fx0, p.y + h - 3 * z, z, now, dir)
        return
      }
      // the rolling ladder glides along the shelves
      const lx = p.x + (20 + (Math.sin(now / 2600) * 0.5 + 0.5) * (w / z - 40)) * z
      c.strokeStyle = '#8b5a2b'; c.lineWidth = Math.max(1, z)
      c.beginPath(); c.moveTo(lx, p.y + 4 * z); c.lineTo(lx + 6 * z, p.y + FH * z - 3 * z); c.moveTo(lx + 4 * z, p.y + 4 * z); c.lineTo(lx + 10 * z, p.y + FH * z - 3 * z)
      for (let k = 1; k < 6; k++) { const t = k / 6; c.moveTo(lx + 6 * z * t, p.y + (4 + t * (FH - 7)) * z); c.lineTo(lx + 4 * z + 6 * z * t, p.y + (4 + t * (FH - 7)) * z) }
      c.stroke()
      if (isOpen(g, f) && Math.floor(now / 3000) % 4 === 0) {
        c.fillStyle = '#fff'; c.font = `bold ${Math.round(6 * z)}px sans-serif`
        c.fillText('Shhh! 🤫', p.x + 70 * z, p.y + FH * z + 12 * z)
      }
      return
    }
    case 'bookstore': {
      // the shop cat's tail flicks, and zzz
      const t = Math.sin(now / 400)
      c.fillStyle = '#ff922b'; c.fillRect(p.x + (56 + t) * z, p.y + h - 15 * z, 1 * z, 2 * z)
      c.fillStyle = '#fff'; c.font = `${Math.round(5 * z)}px sans-serif`
      c.fillText('z', p.x + 62 * z, p.y + h - 20 * z - ((now / 60) % 6) * z)
      return
    }
    case 'park': {
      if (m < 6 * 60 || m > 20 * 60) return
      for (let i = 0; i < 2; i++) {
        const bx = p.x + w * (0.3 + 0.4 * i) + Math.sin(now / 700 + i * 4) * 14 * z
        const by = p.y + 12 * z + Math.sin(now / 330 + i) * 5 * z
        const flap = Math.abs(Math.sin(now / 80 + i)) * 2 * z + 0.4 * z
        c.fillStyle = i ? '#ffd43b' : '#f783ac'
        c.fillRect(bx - flap, by - z, flap, 2 * z); c.fillRect(bx + 0.6 * z, by - z, flap, 2 * z)
        c.fillStyle = '#212529'; c.fillRect(bx, by - z, 0.6 * z, 2 * z)
      }
      return
    }
    case 'zoo': {
      drawZoo(c, g, f, p, w, h, z, now, m)
      return
    }
    case 'rainforest': return drawRainforest(c, g, f, p, w, h, z, now, m)
    case 'market': {
      drawMarket(c, g, f, p, w, h, z, now, m)
      return
    }
    case 'playground': {
      drawPlayground(c, g, f, p, w, h, z, now, m)
      return
    }
    case 'concertHall': return drawConcertHall(c, g, f, p, w, h, z, now, m)
  }
}

function fish(c: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, col: string) {
  c.fillStyle = col
  c.beginPath(); c.ellipse(x, y, s * 1.4, s * 0.8, 0, 0, Math.PI * 2); c.fill()
  c.beginPath(); c.moveTo(x - dir * s * 1.2, y); c.lineTo(x - dir * s * 2.4, y - s * 0.9); c.lineTo(x - dir * s * 2.4, y + s * 0.9); c.fill()
  c.fillStyle = '#111'
  c.fillRect(x + dir * s * 0.6 - s * 0.2, y - s * 0.35, s * 0.4, s * 0.4)
}

function drawRocket(c: CanvasRenderingContext2D, g: Game, f: Facility, S: (x: number, y: number) => Pt, z: number, now: number) {
  const t = f.reachable ? launchClock(g) : -999
  let lift = 0
  let burn = false
  if (t >= 0 && t < 60) { lift = (t / 60) ** 2 * 3200; burn = true }
  else if (t >= 60 && t < 130) return
  else if (t >= 130 && t < 150) { lift = ((150 - t) / 20) ** 2 * 1800; burn = true }
  const baseW = S(f.x * T + ROCKET_X, floorTop(f.floor) + FH - 8 - lift)
  const cx = baseW.x, yb = baseW.y
  const u = z
  // smoke at the pad during liftoff / countdown
  const pad = S(f.x * T + ROCKET_X, floorTop(f.floor) + FH - 8)
  if ((t > -15 && t < 20) || (t >= 130 && t < 160)) {
    const k = t < 0 ? (t + 15) / 15 : t < 20 ? 1 - t / 20 : t < 150 ? 1 : 1 - (t - 150) / 10
    c.fillStyle = `rgba(230,230,235,${0.75 * k})`
    for (let i = 0; i < 7; i++) {
      const sx = pad.x + (i - 3) * 9 * u + Math.sin(now / 300 + i) * 2 * u
      c.beginPath(); c.arc(sx, pad.y - 3 * u, (5 + (i % 3) * 2 + (t > 0 && t < 20 ? 4 : 0)) * u, 0, Math.PI * 2); c.fill()
    }
  }
  if (burn) {
    const fl = (14 + Math.sin(now / 40) * 4) * u
    c.fillStyle = '#ff922b'
    c.beginPath(); c.moveTo(cx - 5 * u, yb); c.lineTo(cx, yb + fl); c.lineTo(cx + 5 * u, yb); c.fill()
    c.fillStyle = '#ffe066'
    c.beginPath(); c.moveTo(cx - 3 * u, yb); c.lineTo(cx, yb + fl * 0.6); c.lineTo(cx + 3 * u, yb); c.fill()
    if (t < 60) {
      c.fillStyle = 'rgba(220,220,225,0.5)'
      for (let i = 1; i < 10; i++) { c.beginPath(); c.arc(cx + Math.sin(i * 3 + now / 500) * 3 * u, yb + fl + i * 14 * u, (3 + i) * u, 0, Math.PI * 2); c.fill() }
    }
  }
  // body
  c.fillStyle = '#c92a2a'
  c.beginPath(); c.moveTo(cx - 6 * u, yb); c.lineTo(cx - 11 * u, yb + 1 * u); c.lineTo(cx - 6 * u, yb - 12 * u); c.fill()
  c.beginPath(); c.moveTo(cx + 6 * u, yb); c.lineTo(cx + 11 * u, yb + 1 * u); c.lineTo(cx + 6 * u, yb - 12 * u); c.fill()
  c.fillStyle = '#f8f9fa'
  c.fillRect(cx - 6 * u, yb - 40 * u, 12 * u, 40 * u)
  c.fillStyle = '#dee2e6'
  c.fillRect(cx + 3 * u, yb - 40 * u, 3 * u, 40 * u)
  c.fillStyle = '#c92a2a'
  c.beginPath(); c.moveTo(cx - 6 * u, yb - 40 * u); c.quadraticCurveTo(cx, yb - 58 * u, cx + 6 * u, yb - 40 * u); c.fill()
  c.fillRect(cx - 6 * u, yb - 14 * u, 12 * u, 2 * u)
  c.fillStyle = '#1864ab'; c.beginPath(); c.arc(cx, yb - 30 * u, 3.2 * u, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#a5d8ff'; c.beginPath(); c.arc(cx, yb - 30 * u, 2.2 * u, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#495057'; c.fillRect(cx - 4 * u, yb, 8 * u, 2 * u)
}

function drawUfo(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, now: number) {
  const t = ufoTime(g)
  if (t == null) return
  const roof = floorTop(topFloor(g))
  let dx = 0, dy = 0
  if (t < 8) dx = ((8 - t) / 8) ** 2 * 1600
  if (t > 52) { dy = -(((t - 52) / 8) ** 2) * 1600; dx = -((t - 52) / 8) * 300 }
  const hover = Math.sin(now / 400) * 3
  const p = S(ufoX(g) * T + dx, roof - 70 + dy + hover)
  const u = z
  const beaming = t >= 10 && t < 50
  if (beaming) {
    const roofP = S(ufoX(g) * T, roof)
    const grd = c.createLinearGradient(0, p.y, 0, roofP.y)
    grd.addColorStop(0, 'rgba(180,255,170,0.55)'); grd.addColorStop(1, 'rgba(180,255,170,0.12)')
    c.fillStyle = grd
    c.beginPath(); c.moveTo(p.x - 8 * u, p.y + 4 * u); c.lineTo(p.x + 8 * u, p.y + 4 * u); c.lineTo(p.x + 26 * u, roofP.y); c.lineTo(p.x - 26 * u, roofP.y); c.fill()
    // a very surprised cow floats up the beam
    const k = Math.min(1, Math.max(0, (t - 14) / 30))
    if (k < 1) {
      const cy = roofP.y - 4 * u - k * (roofP.y - p.y - 8 * u)
      const spin = Math.sin(now / 300) * 0.4
      c.save(); c.translate(p.x, cy); c.rotate(spin)
      c.fillStyle = '#fff'; c.fillRect(-6 * u, -4 * u, 12 * u, 6 * u)
      c.fillStyle = '#212529'; c.fillRect(-4 * u, -4 * u, 3 * u, 3 * u); c.fillRect(2 * u, -1 * u, 3 * u, 3 * u)
      c.fillStyle = '#fff'; c.fillRect(5 * u, -7 * u, 4 * u, 4 * u)
      c.fillStyle = '#ffc9c9'; c.fillRect(7 * u, -5 * u, 2 * u, 2 * u)
      c.fillStyle = '#212529'
      for (const lx of [-5, -2, 2, 4]) c.fillRect(lx * u, 2 * u, 1.2 * u, 3 * u)
      c.restore()
    }
  }
  // saucer
  c.fillStyle = 'rgba(165,216,255,0.85)'
  c.beginPath(); c.ellipse(p.x, p.y - 4 * u, 9 * u, 8 * u, 0, Math.PI, 0); c.fill()
  c.fillStyle = '#69db7c'; c.fillRect(p.x - 2 * u, p.y - 9 * u, 4 * u, 4 * u)
  c.fillStyle = '#111'; c.fillRect(p.x - 1.4 * u, p.y - 8 * u, 1 * u, 1.2 * u); c.fillRect(p.x + 0.4 * u, p.y - 8 * u, 1 * u, 1.2 * u)
  c.fillStyle = '#adb5bd'
  c.beginPath(); c.ellipse(p.x, p.y, 22 * u, 6 * u, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#868e96'
  c.beginPath(); c.ellipse(p.x, p.y + 2 * u, 14 * u, 3 * u, 0, 0, Math.PI * 2); c.fill()
  for (let i = 0; i < 6; i++) {
    c.fillStyle = Math.floor(now / 150 + i) % 3 === 0 ? '#ffd43b' : i % 2 ? '#ff6b6b' : '#74c0fc'
    c.fillRect(p.x + (-17 + i * 6.6) * u, p.y - 1 * u, 2.4 * u, 2.4 * u)
  }
}

let signCache: { key: string; at: { floor: number; x: number } | null } = { key: '', at: null }

/** The player's tower name on a little billboard on the highest roof that has room. */
function drawTowerSign(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, night: number) {
  const name = (g.name ?? '').trim()
  if (!name || g.floors.size === 0) return
  const textW = name.length * 6.2 + 12
  const tiles = Math.ceil(textW / T) + 2
  const key = `${g.buildVersion}|${name}`
  if (signCache.key !== key) {
    signCache = { key, at: null }
    const floors = [...g.floors.keys()].filter((f) => f >= 0).sort((a, b) => b - a)
    search: for (const f of floors) {
      const row = g.floors.get(f)!
      const above = g.floors.get(f + 1)
      let run = 0
      for (let i = 0; i < TOWER_WIDTH; i++) {
        const v = row[i]
        const k = v > 0 ? g.facilities.get(v)?.kind : undefined
        const ok = v !== -1 && (!above || above[i] === -1) && k !== 'cathedral' && !(k && needsOpenSky(k))
        run = ok ? run + 1 : 0
        if (run >= tiles) { signCache.at = { floor: f, x: i - run + 1 }; break search }
      }
    }
  }
  const at = signCache.at
  if (!at) return
  const left = S((at.x + 1) * T, floorTop(at.floor) - 3)
  const bw = textW * z, bh = 13 * z
  const top = left.y - 8 * z - bh
  c.fillStyle = '#343a40'
  c.fillRect(left.x + 4 * z, top + bh, 2 * z, 8 * z)
  c.fillRect(left.x + bw - 6 * z, top + bh, 2 * z, 8 * z)
  c.fillStyle = '#1b1033'
  c.fillRect(left.x, top, bw, bh)
  c.strokeStyle = '#ffd43b'; c.lineWidth = Math.max(1, z)
  c.strokeRect(left.x, top, bw, bh)
  c.font = `900 ${Math.round(9 * z)}px "Nunito", sans-serif`
  c.textAlign = 'center'
  if (night > 0.3) { c.shadowColor = '#f783ac'; c.shadowBlur = 10 * z }
  c.fillStyle = night > 0.3 ? '#ffdeeb' : '#ffd43b'
  c.fillText(name, left.x + bw / 2, top + bh - 3.5 * z)
  c.shadowBlur = 0
  c.textAlign = 'left'
}

function drawBlimp(c: CanvasRenderingContext2D, W: number, H: number, g: Game, now: number, night: number) {
  if (night > 0.5) return
  const cycle = (now / 1000) % 75
  if (cycle > 40) return
  const k = cycle / 40
  const raw = ((g.name ?? '').trim() || 'SKY TOWER').toUpperCase()
  const text = holidayBanner(g, raw.length > 18 ? raw.slice(0, 17) + '…' : raw)
  c.font = '900 13px "Nunito", sans-serif'
  const rx = Math.max(70, c.measureText(text).width / 2 + 26)
  const x = W + 160 - k * (W + 420)
  const y = H * 0.13 + Math.sin(now / 1500) * 6
  c.fillStyle = '#ced4da'
  c.beginPath(); c.ellipse(x, y, rx, 20, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#e9ecef'
  c.beginPath(); c.ellipse(x - 6, y - 6, rx - 12, 9, 0, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#c92a2a'
  c.beginPath(); c.moveTo(x + rx - 12, y - 4); c.lineTo(x + rx + 12, y - 20); c.lineTo(x + rx + 10, y - 2); c.fill()
  c.beginPath(); c.moveTo(x + rx - 12, y + 4); c.lineTo(x + rx + 12, y + 20); c.lineTo(x + rx + 10, y + 2); c.fill()
  c.fillStyle = '#495057'; c.fillRect(x - 12, y + 18, 24, 7)
  c.fillStyle = '#a5d8ff'; for (let i = 0; i < 4; i++) c.fillRect(x - 10 + i * 6, y + 20, 3, 3)
  c.textAlign = 'center'
  c.fillStyle = '#c92a2a'
  c.fillText(text, x - 4, y + 5)
  c.textAlign = 'left'
}

const BALLOONS = [
  { seed: 0.1, y: 0.2, s: 1, cols: ['#ff6b6b', '#ffd43b'] },
  { seed: 0.55, y: 0.32, s: 0.7, cols: ['#4dabf7', '#fff'] },
  { seed: 0.8, y: 0.12, s: 0.55, cols: ['#69db7c', '#da77f2'] },
]
function drawBalloons(c: CanvasRenderingContext2D, W: number, H: number, now: number, night: number) {
  if (night > 0.6) return
  for (const b of BALLOONS) {
    const x = ((b.seed * (W + 200) + now * 0.006 * b.s) % (W + 200)) - 100
    const y = H * b.y + Math.sin(now / 2000 + b.seed * 10) * 10
    const r = 16 * b.s
    for (let i = 0; i < 4; i++) {
      c.fillStyle = b.cols[i % 2]
      c.beginPath(); c.ellipse(x, y, r * (1 - i * 0.25), r * 1.15, 0, 0, Math.PI * 2); c.fill()
    }
    c.strokeStyle = '#5c4632'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x - r * 0.6, y + r); c.lineTo(x - r * 0.3, y + r * 1.6); c.moveTo(x + r * 0.6, y + r); c.lineTo(x + r * 0.3, y + r * 1.6); c.stroke()
    c.fillStyle = '#8b5a2b'; c.fillRect(x - r * 0.3, y + r * 1.6, r * 0.6, r * 0.45)
  }
}

// ---------- metro train ----------
const TRAIN_CARS = 3
const CAR_W = 62 // px per car

function drawTrain(c: CanvasRenderingContext2D, g: Game, p: Pt, w: number, h: number, z: number, now: number) {
  const tp = trainPhase(g)
  // departure board
  const [bx, by, bw, bh] = METRO_BOARD
  c.fillStyle = '#111'
  c.fillRect(p.x + bx * z, p.y + by * z, bw * z, bh * z)
  const m = minuteOfDay(g.time)
  let text = 'NO SERVICE'
  if (tp?.phase === 'doors') text = Math.floor(now / 500) % 2 ? 'BOARDING' : 'ALL ABOARD!'
  else if (tp?.phase === 'in') text = 'ARRIVING'
  else if (m >= 5 * 60 - TRAIN_EVERY) {
    const c0 = ((m - 5 * 60) % TRAIN_EVERY + TRAIN_EVERY) % TRAIN_EVERY
    const wait = Math.max(1, Math.ceil(TRAIN_EVERY - c0))
    if (m < 24 * 60 - TRAIN_EVERY + TRAIN_IN || m < 5 * 60) text = `NEXT ${wait} MIN`
  }
  c.fillStyle = '#ffa94d'
  c.font = `bold ${Math.max(5, Math.round(6.5 * z))}px monospace`
  c.textAlign = 'center'
  c.fillText(text, p.x + (bx + bw / 2) * z, p.y + (by + bh / 2 + 2.5) * z)
  c.textAlign = 'left'
  if (!tp) return
  const L = TRAIN_CARS * CAR_W * z
  const stop = p.x + (w - L) / 2
  let x = stop
  if (tp.phase === 'in') { const e = 1 - (1 - tp.k) ** 2; x = p.x - L + (stop - (p.x - L)) * e }
  else if (tp.phase === 'out') x = stop + (w + L) * tp.k ** 2
  const top = p.y + h - (METRO_TUNNEL - 2) * z
  const bodyH = (METRO_TUNNEL - 12) * z
  const open = tp.phase === 'doors' ? Math.min(1, tp.k * 8, (1 - tp.k) * 8) : 0
  c.save()
  c.beginPath(); c.rect(p.x + 22 * z, p.y, w - 44 * z, h); c.clip() // emerge from the tunnel mouths
  for (let i = 0; i < TRAIN_CARS; i++) {
    const cx = x + i * CAR_W * z
    const cw = (CAR_W - 2) * z
    c.fillStyle = '#1971c2'
    c.fillRect(cx, top, cw, bodyH)
    c.fillStyle = '#e7f5ff'
    c.fillRect(cx, top + bodyH * 0.62, cw, 2 * z)
    c.fillStyle = '#145a9e'
    c.fillRect(cx, top, cw, 2 * z)
    // windows with riders
    for (let wi = 0; wi < 3; wi++) {
      const wx = cx + (6 + wi * 18) * z
      c.fillStyle = '#d0ebff'
      c.fillRect(wx, top + 5 * z, 10 * z, 8 * z)
      if ((i * 3 + wi + Math.floor(g.time / TRAIN_EVERY)) % 3 !== 0) {
        c.fillStyle = SHIRTS[(i * 3 + wi) % SHIRTS.length]
        c.fillRect(wx + 3 * z, top + 9 * z, 4 * z, 4 * z)
        c.fillStyle = '#f1c27d'
        c.fillRect(wx + 3.5 * z, top + 6.5 * z, 3 * z, 3 * z)
      }
    }
    // doors (slide open at the station)
    for (const dx of [15, 51]) {
      const dxp = cx + (dx - 6) * z
      const dw = 10 * z
      const dy = top + 4 * z, dh = bodyH - 5 * z
      c.fillStyle = open > 0 ? '#fff3bf' : '#1864ab'
      c.fillRect(dxp, dy, dw, dh)
      if (open < 1) {
        const leaf = (dw / 2) * (1 - open)
        c.fillStyle = '#1864ab'
        c.fillRect(dxp, dy, leaf, dh); c.fillRect(dxp + dw - leaf, dy, leaf, dh)
        c.fillStyle = '#a5d8ff'
        c.fillRect(dxp + 1 * z, dy + 2 * z, Math.max(0, leaf - 2 * z), 4 * z)
        c.fillRect(dxp + dw - leaf + 1 * z, dy + 2 * z, Math.max(0, leaf - 2 * z), 4 * z)
      } else if ((i + dx) % 2 === 0) {
        // someone stepping out onto the platform
        const step = (now / 900 + i) % 1
        drawPersonAt(c, dxp + dw / 2 + (dx < 30 ? -1 : 1) * step * 12 * z, p.y + h - 8 * z, z, SHIRTS[(i + dx) % SHIRTS.length], Math.floor(now / 150) % 2, 0)
      }
    }
    // wheels + coupler
    c.fillStyle = '#212529'
    for (const wx of [8, 18, cw / z - 18, cw / z - 8]) { c.beginPath(); c.arc(cx + wx * z, top + bodyH + 1 * z, 2.2 * z, 0, Math.PI * 2); c.fill() }
    if (i < TRAIN_CARS - 1) { c.fillStyle = '#495057'; c.fillRect(cx + cw, top + bodyH * 0.5, 2 * z, 3 * z) }
  }
  // the nose with its headlight, at the front (right end)
  const nx = x + L - 2 * z
  c.fillStyle = '#1971c2'
  c.beginPath(); c.moveTo(nx, top); c.quadraticCurveTo(nx + 10 * z, top + 2 * z, nx + 12 * z, top + bodyH); c.lineTo(nx, top + bodyH); c.fill()
  c.fillStyle = '#a5d8ff'; c.fillRect(nx + 1 * z, top + 4 * z, 5 * z, 6 * z)
  c.fillStyle = '#fff3bf'; c.fillRect(nx + 8 * z, top + bodyH - 6 * z, 3 * z, 2 * z)
  if (tp.phase !== 'doors') {
    const glow = c.createRadialGradient(nx + 12 * z, top + bodyH - 5 * z, 1, nx + 12 * z, top + bodyH - 5 * z, 26 * z)
    glow.addColorStop(0, 'rgba(255,243,191,0.6)'); glow.addColorStop(1, 'rgba(255,243,191,0)')
    c.fillStyle = glow; c.fillRect(nx, top - 10 * z, 40 * z, bodyH + 20 * z)
  }
  c.restore()
}

// ---------- Freddy Fazbear's Pizza ----------
type Bot = 'freddy' | 'bonnie' | 'chica' | 'foxy'
let scareUntil = 0
let scareStart = 0
/** Full-screen cartoon jumpscare (poking Freddy's after midnight). */
export function jumpscare(now: number) { scareStart = now; scareUntil = now + 650 }

function drawBot(c: CanvasRenderingContext2D, bot: Bot, x: number, yb: number, u: number, o: { mouth: boolean; glow: boolean; bob: number; lean?: number }) {
  const col = { freddy: '#8b5a2b', bonnie: '#6c63c9', chica: '#f6c90e', foxy: '#c0392b' }[bot]
  const light = { freddy: '#c48b5c', bonnie: '#a5a0e6', chica: '#fff3bf', foxy: '#e8a598' }[bot]
  const R = (x0: number, y0: number, w: number, hh: number, cc: string) => { c.fillStyle = cc; c.fillRect(x + x0 * u, yb + (y0 - o.bob) * u, w * u, hh * u) }
  c.save()
  if (o.lean) { c.translate(x, yb); c.rotate(o.lean); c.translate(-x, -yb) }
  // legs, body, belly, arms
  R(-4, -6, 3, 6, col); R(1, -6, 3, 6, col)
  R(-5, -15, 10, 10, col); R(-3, -13, 6, 6, light)
  R(-7, -14, 2, 7, col); R(5, -14, 2, 7, col)
  // head
  R(-5, -24, 10, 9, col); R(-3, -19, 6, 4, light)
  if (bot === 'freddy') { R(-6, -26, 3, 3, col); R(3, -26, 3, 3, col); R(-3, -29, 6, 4, '#111'); R(-4, -26, 8, 1, '#111'); R(-2, -15, 4, 2, '#111'); R(6, -15, 1, 4, '#868e96'); R(5.5, -16.5, 2, 2, '#495057') }
  if (bot === 'bonnie') { R(-4, -33, 2, 9, col); R(2, -33, 2, 9, col); R(-3.5, -31, 1, 6, light); R(2.5, -31, 1, 6, light); R(-2, -15, 4, 2, '#e03131'); R(-6, -11, 12, 3, '#e03131'); R(4, -13, 2, 6, '#c92a2a') }
  if (bot === 'chica') { R(-3, -19, 6, 2, '#ff922b'); R(-3, -26, 1, 2, '#ff922b'); R(-1, -27, 1, 3, '#ff922b'); R(-4, -13, 8, 6, '#fff'); c.fillStyle = '#e64980'; c.font = `bold ${2.4 * u}px sans-serif`; c.fillText('EAT', x - 3.2 * u, yb + (-9 - o.bob) * u); R(6, -17, 3, 3, '#f783ac'); R(7, -18.5, 1, 1.5, '#fff') }
  if (bot === 'foxy') { R(-6, -27, 3, 4, col); R(3, -27, 3, 4, col); R(-4, -22, 3, 2, '#111'); R(-7, -9, 2, 2, '#adb5bd'); R(-8, -11, 1, 2, '#adb5bd'); R(-3, -19, 6, 4, light); R(-6, -6, 3, 6, '#5c3d2e') }
  // eyes + mouth
  if (o.glow) {
    c.shadowColor = '#fff'; c.shadowBlur = 6 * u
    R(-3, -22, 1.4, 1.4, '#fff'); if (bot !== 'foxy') R(1.6, -22, 1.4, 1.4, '#fff'); else R(1.6, -22, 1.4, 1.4, '#ffd43b')
    c.shadowBlur = 0
  } else {
    if (bot !== 'foxy') R(-3, -22, 1.5, 1.5, '#1c7ed6'); R(1.5, -22, 1.5, 1.5, bot === 'foxy' ? '#ffd43b' : '#1c7ed6')
  }
  R(-2, -17, 4, o.mouth ? 2 : 0.8, '#3a1d1d')
  if (o.mouth) R(-1.5, -17, 1, 0.8, '#fff')
  c.restore()
}

function drawFazbear(c: CanvasRenderingContext2D, g: Game, f: Facility, p: Pt, w: number, h: number, z: number, now: number, m: number) {
  const night = m < 6 * 60
  const show = isOpen(g, f)
  const X = (sx: number) => p.x + sx * z
  const stageY = p.y + h - 18 * z
  const floorY = p.y + h - 3 * z
  const beat = Math.floor(now / 260) % 2
  const bob = show ? (beat ? 1 : 0) : 0
  if (!night) {
    const [s0, s1] = FAZ_STAGE
    const mid = (s0 + s1) / 2
    drawBot(c, 'bonnie', X(mid - 32), stageY, z, { mouth: false, glow: false, bob, lean: show ? Math.sin(now / 300) * 0.06 : 0 })
    drawBot(c, 'freddy', X(mid), stageY, z, { mouth: show && beat === 1, glow: false, bob })
    drawBot(c, 'chica', X(mid + 32), stageY, z, { mouth: show && beat === 0, glow: false, bob })
    if (show) {
      c.fillStyle = '#ffd43b'
      c.font = `bold ${Math.round(7 * z)}px sans-serif`
      for (let i = 0; i < 3; i++) {
        const k = (now / 1600 + i / 3) % 1
        c.globalAlpha = 1 - k
        c.fillText(i % 2 ? '♪' : '♫', X(mid - 20 + i * 18) + Math.sin(now / 300 + i) * 3 * z, stageY - 34 * z - k * 16 * z)
      }
      c.globalAlpha = 1
    }
    // Foxy peeks out of Pirate Cove now and then
    const peek = Math.max(0, Math.sin(now / 2300))
    if (peek > 0.6) {
      c.save(); c.beginPath(); c.rect(X(FAZ_COVE), p.y, (peek - 0.6) * 2.5 * 14 * z, h); c.clip()
      drawBot(c, 'foxy', X(FAZ_COVE + 6), floorY, z, { mouth: true, glow: false, bob: 0 })
      c.restore()
    }
    return
  }
  // ---- the night shift ----
  c.fillStyle = 'rgba(5,5,20,0.78)'
  c.fillRect(p.x, p.y, w, h)
  // the animatronics move when you're not looking: each one hops to a new spot every few seconds
  const spots: Record<Bot, number[]> = {
    freddy: [(FAZ_STAGE[0] + FAZ_STAGE[1]) / 2, (FAZ_STAGE[0] + FAZ_STAGE[1]) / 2, FAZ_TABLES + 30],
    bonnie: [FAZ_STAGE[0] + 20, FAZ_TABLES + 8, FAZ_OFFICE - 8],
    chica: [FAZ_STAGE[1] - 20, FAZ_TABLES + 50, FAZ_TABLES + 64],
    foxy: [FAZ_COVE + 12, FAZ_COVE + 12, FAZ_TABLES + 40],
  }
  ;(['freddy', 'bonnie', 'chica', 'foxy'] as Bot[]).forEach((b, i) => {
    const slot = Math.floor(now / (3200 + i * 700) + i * 1.7) % spots[b].length
    const sx = spots[b][slot]
    const onStage = sx >= FAZ_STAGE[0] && sx <= FAZ_STAGE[1]
    drawBot(c, b, X(sx), onStage ? stageY : floorY, z, { mouth: false, glow: true, bob: 0, lean: 0.08 * Math.sin(i) })
  })
  // the night guard and their sweeping flashlight
  const gx = X(FAZ_OFFICE + 14)
  c.fillStyle = 'rgba(255,240,170,0.18)'
  const a = Math.sin(now / 1100) * 0.35
  c.beginPath(); c.moveTo(gx, floorY - 10 * z); c.lineTo(gx - 90 * z, floorY - (16 + a * 40) * z - 14 * z); c.lineTo(gx - 90 * z, floorY - (16 + a * 40) * z + 14 * z); c.fill()
  drawPersonAt(c, gx, floorY, z, '#4263eb', 0, 0, 60)
  c.fillStyle = '#4dff88'
  c.font = `bold ${Math.round(5 * z)}px monospace`
  const hr = Math.floor(m / 60)
  c.fillText(`${hr === 0 ? 12 : hr} AM`, X(FAZ_OFFICE + 3), p.y + 14 * z)
  c.fillText(`Night ${(dayOf(g.time) % 5) + 1}`, X(FAZ_OFFICE + 3), p.y + 20 * z)
}

function drawJumpscare(c: CanvasRenderingContext2D, W: number, H: number, now: number) {
  if (now > scareUntil) return
  const k = (now - scareStart) / 650
  const shake = (Math.random() - 0.5) * 24 * (1 - k)
  c.fillStyle = `rgba(0,0,0,${0.85 * (1 - k * 0.5)})`
  c.fillRect(0, 0, W, H)
  const u = Math.min(W, H) / 40 * (0.8 + k * 0.6)
  drawBot(c, 'freddy', W / 2 + shake, H / 2 + 22 * u, u, { mouth: true, glow: true, bob: 0 })
}

// ---------- spooky references ----------
let plateCache: { v: number; nums: Map<number, number> } = { v: -1, nums: new Map() }

/** Gold door-number plates on hotel rooms, counted up the tower like a certain hotel game. */
function drawDoorPlate(c: CanvasRenderingContext2D, g: Game, f: Facility, p: Pt, w: number, h: number, z: number) {
  if (plateCache.v !== g.buildVersion) {
    const rooms = [...g.facilities.values()].filter((r) => isHotel(r.kind)).sort((a, b) => a.floor - b.floor || a.x - b.x)
    plateCache = { v: g.buildVersion, nums: new Map(rooms.map((r, i) => [r.id, i + 1])) }
  }
  const n = plateCache.nums.get(f.id)
  if (!n) return
  const px = p.x + w - 10 * z, py = p.y + h - 27 * z
  c.fillStyle = '#7a5c12'; c.fillRect(px - 0.5 * z, py - 0.5 * z, 9 * z, 4 * z)
  c.fillStyle = '#f2c94c'; c.fillRect(px, py, 8 * z, 3 * z)
  c.fillStyle = '#3d2a00'
  c.font = `bold ${2.6 * z}px monospace`
  c.fillText(String(n).padStart(4, '0'), px + 0.6 * z, py + 2.4 * z)
}

function drawHuggy(c: CanvasRenderingContext2D, x: number, yb: number, u: number, now: number, wave = false) {
  const fur = '#1c7ed6', fur2 = '#4dabf7'
  const R = (x0: number, y0: number, w: number, hh: number, cc: string) => { c.fillStyle = cc; c.fillRect(x + x0 * u, yb + y0 * u, w * u, hh * u) }
  R(-4, -14, 3, 14, fur); R(1, -14, 3, 14, fur) // legs
  R(-4, -28, 8, 15, fur) // body
  const swing = Math.sin(now / 500) * 2
  R(-7, -27, 3, 20 + swing, fur); R(4, -27, 3, wave ? 8 : 20 - swing, fur) // long arms
  if (wave) R(5, -36 + Math.sin(now / 150) * 1.5, 3, 9, fur)
  R(-5, -38, 10, 10, fur) // head
  for (const [dx, dy] of [[-3, -24], [1, -20], [-2, -16], [2, -26], [-4, -35], [3, -33]]) R(dx, dy, 1, 1, fur2)
  R(-4, -36, 3, 3, '#fff'); R(1, -36, 3, 3, '#fff'); R(-3, -35, 1.5, 1.5, '#111'); R(2, -35, 1.5, 1.5, '#111')
  R(-4.5, -31, 9, 3, '#e03131') // big red smile
  for (let k = 0; k < 4; k++) R(-3.6 + k * 2, -30.4, 1.2, 1.4, '#fff')
}

function drawHuggyVent(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, now: number) {
  const hg = g.flags.huggy
  if (!hg || z < 0.5) return
  const top = S(hg.x * T, floorTop(hg.floor) + 2)
  // vent grate hanging open
  c.fillStyle = '#495057'; c.fillRect(top.x - 6 * z, top.y, 12 * z, 2.5 * z)
  c.fillStyle = '#212529'; for (let k = 0; k < 4; k++) c.fillRect(top.x - 5 * z + k * 3 * z, top.y + 0.5 * z, 1.5 * z, 1.5 * z)
  c.save(); c.translate(top.x + 7 * z, top.y + 1 * z); c.rotate(0.9); c.fillStyle = '#868e96'; c.fillRect(0, 0, 10 * z, 1.5 * z); c.restore()
  // Huggy dangles upside down out of the vent, peeking
  const peek = 6 + Math.sin(now / 700) * 2
  c.save()
  c.beginPath(); c.rect(top.x - 20 * z, top.y + 2 * z, 40 * z, 30 * z); c.clip()
  c.translate(top.x, top.y + 2 * z + (peek - 6) * z)
  c.rotate(Math.PI)
  drawHuggy(c, 0, 28 * z, z, now) // upside down: head and arms hang below the vent
  c.restore()
  // a little sparkle so kids can spot him
  if (Math.floor(now / 400) % 3 === 0) { c.fillStyle = '#ffe066'; c.fillRect(top.x + 9 * z, top.y + 4 * z, 1.5 * z, 1.5 * z) }
}

function drawToyFactory(c: CanvasRenderingContext2D, g: Game, f: Facility, p: Pt, w: number, h: number, z: number, now: number, m: number) {
  const X = (sx: number) => p.x + sx * z
  const open = isOpen(g, f)
  // toys riding the belt
  const [b0, b1] = TOY_BELT
  const toyCols = ['#e03131', '#fab005', '#2f9e44', '#1c7ed6', '#e64980']
  for (let i = 0; i < 6; i++) {
    const k = ((open ? now / 60 : 0) + i * 15) % (b1 - b0)
    const tx = X(b0 + k), ty = p.y + h - 16 * z
    c.fillStyle = toyCols[i % toyCols.length]
    if (i % 2) c.fillRect(tx - 2 * z, ty - 4 * z, 4 * z, 4 * z)
    else { c.beginPath(); c.arc(tx, ty - 2.5 * z, 2.5 * z, 0, Math.PI * 2); c.fill(); c.fillRect(tx - 2.5 * z, ty - 6 * z, 1.5 * z, 1.5 * z); c.fillRect(tx + 1 * z, ty - 6 * z, 1.5 * z, 1.5 * z) }
  }
  // the GrabPack hand shoots out on its cord and grabs a toy
  if (open) {
    const k = (now % 2600) / 2600
    const reach = k < 0.5 ? Math.sin(k * Math.PI) : 0
    if (reach > 0) {
      const hx = X(166), hy = p.y + 26 * z
      const ex = hx - reach * 40 * z, ey = hy + reach * (h - 46 * z)
      c.strokeStyle = '#495057'; c.lineWidth = Math.max(1, 0.8 * z)
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke()
      c.fillStyle = Math.floor(now / 2600) % 2 ? '#e03131' : '#1c7ed6'
      c.fillRect(ex - 3 * z, ey - 2 * z, 6 * z, 5 * z)
    }
  }
  // Huggy in his case, unless he's escaped
  const [cx, cw] = TOY_CASE
  if (!g.flags.huggy) drawHuggy(c, X(cx + cw / 2), p.y + h - 8 * z, z, now, open && Math.floor(now / 3000) % 3 === 0)
  else {
    c.fillStyle = '#ff6b6b'
    c.font = `bold ${Math.round(10 * z)}px sans-serif`
    c.textAlign = 'center'
    c.fillText('?', X(cx + cw / 2), p.y + h / 2 + 2 * z)
    c.font = `bold ${Math.max(4, Math.round(3.5 * z))}px monospace`
    c.fillText('MISSING', X(cx + cw / 2), p.y + h - 12 * z)
    c.textAlign = 'left'
  }
  if (m >= 20 * 60 || m < 6 * 60) { c.fillStyle = 'rgba(5,5,20,0.45)'; c.fillRect(p.x, p.y, w, h) }
}

function drawRambley(c: CanvasRenderingContext2D, x: number, y: number, u: number, talk: boolean, eyes = '#111') {
  const R = (x0: number, y0: number, w: number, hh: number, cc: string) => { c.fillStyle = cc; c.fillRect(x + x0 * u, y + y0 * u, w * u, hh * u) }
  R(-6, -4, 3, 3, '#868e96'); R(3, -4, 3, 3, '#868e96'); R(-5, -3, 1, 1, '#ffc9c9'); R(4, -3, 1, 1, '#ffc9c9') // ears
  R(-5, -2, 10, 9, '#adb5bd') // head
  R(-5, 0, 10, 3, '#343a40') // bandit mask
  R(-3, 0.5, 2, 2, '#fff'); R(1, 0.5, 2, 2, '#fff'); R(-2.5, 1, 1, 1, eyes); R(1.5, 1, 1, 1, eyes)
  R(-3, 3, 6, 4, '#f1f3f5') // muzzle
  R(-1, 3, 2, 1, '#111')
  R(-2, 5, 4, talk ? 1.5 : 0.6, '#c92a2a')
}

function drawIndigo(c: CanvasRenderingContext2D, g: Game, f: Facility, p: Pt, w: number, h: number, z: number, now: number, m: number) {
  const X = (sx: number) => p.x + sx * z
  const open = isOpen(g, f)
  const dark = m >= 20 * 60 || m < 6 * 60
  // the park railway circling the lake
  const [lc, lr] = INDIGO_LOOP
  const th = open ? now / 2400 : 1.2
  for (let i = 3; i >= 0; i--) {
    const a = th - i * 0.32
    const tx = X(lc + Math.cos(a) * lr), ty = p.y + h - 11 * z + Math.sin(a) * 7 * z
    c.fillStyle = i === 0 ? '#5f3dc4' : ['#ffd43b', '#ff8787', '#74c0fc'][i - 1]
    c.fillRect(tx - 4 * z, ty - 5 * z, 8 * z, 5 * z)
    if (i === 0) { c.fillStyle = '#212529'; c.fillRect(tx + 1 * z, ty - 8 * z, 2 * z, 3 * z) }
    c.fillStyle = '#212529'; c.fillRect(tx - 3 * z, ty, 1.5 * z, 1.5 * z); c.fillRect(tx + 1.5 * z, ty, 1.5 * z, 1.5 * z)
  }
  // the big screen
  const [sx, sy, sw, sh] = INDIGO_SCREEN
  const scr = { x: X(sx), y: p.y + sy * z, w: sw * z, h: sh * z }
  if (dark) {
    c.fillStyle = 'rgba(5,5,25,0.6)'; c.fillRect(p.x, p.y, w, h)
    for (let i = 0; i < 60; i++) { c.fillStyle = Math.random() < 0.5 ? '#555' : '#ccc'; c.fillRect(scr.x + Math.random() * scr.w, scr.y + Math.random() * scr.h, z, z) }
    if (Math.random() < 0.6) {
      c.save(); c.beginPath(); c.rect(scr.x, scr.y, scr.w, scr.h); c.clip()
      drawRambley(c, scr.x + scr.w / 2 + (Math.random() - 0.5) * 4 * z, scr.y + 6 * z, z, false, '#ff2d2d')
      c.restore()
    }
  } else {
    c.fillStyle = '#d0bfff'; c.fillRect(scr.x, scr.y, scr.w, scr.h)
    drawRambley(c, scr.x + scr.w / 2, scr.y + 6 * z, z, open && Math.floor(now / 180) % 2 === 0)
  }
}

function drawFigure(c: CanvasRenderingContext2D, x: number, yb: number, u: number, now: number, dir: number) {
  const step = Math.sin(now / 400)
  const R = (x0: number, y0: number, w: number, hh: number, cc: string) => { c.fillStyle = cc; c.fillRect(x + x0 * dir * u - (dir < 0 ? w * u : 0), yb + y0 * u, w * u, hh * u) }
  const skin = '#7a2e2e'
  R(-3 + step, -22, 3, 22, skin); R(1 - step, -22, 3, 22, skin) // long legs
  R(-5, -42, 10, 21, skin)
  for (let k = 0; k < 4; k++) R(-4, -40 + k * 4, 8, 1, '#4a1414') // ribs
  R(-8, -41, 3, 24, skin); R(5, -41, 3, 24, skin)
  R(-4, -52, 9, 11, skin) // eyeless head
  R(-3, -46, 7, 4, '#2b0a0a'); for (let k = 0; k < 4; k++) R(-2.5 + k * 1.8, -46, 1, 1.4, '#f1e3c8')
}

function drawEntity(c: CanvasRenderingContext2D, g: Game, S: (x: number, y: number) => Pt, z: number, now: number) {
  const e = entityNow(g)
  if (!e) return
  const yb = floorTop(e.floor) + FH - 3
  if (e.kind === 'seek') {
    // eyes open up all over the walls
    const n = Math.floor(6 + 30 * (e.warning ? e.k : 1))
    for (let i = 0; i < n; i++) {
      const ex = e.a + ((i * 37.7) % Math.max(1, e.b - e.a))
      const ey = floorTop(e.floor) + 6 + ((i * 13) % 18)
      const p = S(ex * T, ey)
      const blink = Math.sin(now / 300 + i * 1.7) > 0.92 ? 0.3 : 1
      c.fillStyle = '#f8f9fa'
      c.beginPath(); c.ellipse(p.x, p.y, 2.6 * z, 1.4 * z * blink, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#111'; c.fillRect(p.x - 0.7 * z, p.y - 0.7 * z * blink, 1.4 * z, 1.4 * z * blink)
    }
    if (e.warning) return
    const x = e.a + (e.b - e.a) * e.k
    const p = S(x * T, yb)
    const run = Math.sin(now / 70)
    c.fillStyle = '#0b0b0f'
    c.fillRect(p.x - 3 * z, p.y - 20 * z, 7 * z, 12 * z)
    c.fillRect(p.x - 2 * z + run * 2 * z, p.y - 9 * z, 2.5 * z, 9 * z); c.fillRect(p.x + 1.5 * z - run * 2 * z, p.y - 9 * z, 2.5 * z, 9 * z)
    c.beginPath(); c.arc(p.x + 0.5 * z, p.y - 23 * z, 4.5 * z, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#f8f9fa'; c.beginPath(); c.ellipse(p.x + 1.5 * z, p.y - 23 * z, 2.4 * z, 1.6 * z, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#111'; c.fillRect(p.x + 1.2 * z, p.y - 23.8 * z, 1.4 * z, 1.4 * z)
    c.fillStyle = 'rgba(11,11,15,0.5)'; for (let k = 1; k < 4; k++) c.fillRect(p.x - (3 + k * 5) * z, p.y - 2 * z, 4 * z, 2 * z)
    return
  }
  if (e.warning) return
  // RUSH: a roaring cloud with a huge grin, tearing down the hallway
  const x = e.a - 6 + (e.b - e.a + 12) * e.k
  const p = S(x * T, yb - FH / 2 + 2)
  for (let i = 0; i < 8; i++) {
    c.fillStyle = `rgba(20,20,24,${0.12 + i * 0.05})`
    c.beginPath(); c.arc(p.x - (30 - i * 4) * z, p.y + Math.sin(now / 60 + i) * 2 * z, (6 + i) * z, 0, Math.PI * 2); c.fill()
  }
  const jitter = (Math.random() - 0.5) * 2 * z
  c.fillStyle = '#16161a'
  c.beginPath(); c.arc(p.x + jitter, p.y, 13 * z, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#f8f9fa'
  c.beginPath(); c.ellipse(p.x - 5 * z + jitter, p.y - 4 * z, 3 * z, 2.2 * z, 0, 0, Math.PI * 2); c.fill()
  c.beginPath(); c.ellipse(p.x + 5 * z + jitter, p.y - 4 * z, 3 * z, 2.2 * z, 0, 0, Math.PI * 2); c.fill()
  c.beginPath(); c.moveTo(p.x - 9 * z, p.y + 2 * z); c.quadraticCurveTo(p.x, p.y + 12 * z, p.x + 9 * z, p.y + 2 * z); c.quadraticCurveTo(p.x, p.y + 6 * z, p.x - 9 * z, p.y + 2 * z); c.fill()
}
