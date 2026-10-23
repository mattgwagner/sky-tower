// Concert Hall room: a stage with a red curtain, a truss of lights, a raked floor and a balcony, and a marquee.
// Scenery is cached; the curtain, band, crowd, lights and marquee are drawn live.
import { ENCORE_AT, actFor, concertPhase, isMatinee, isMystery, showLabel, soldOut } from '../game/concert'
import type { Act, ActId, ConcertPhase } from '../game/concert'
import type { Facility, Game } from '../game/state'
import { dayOf } from '../game/state'
import { SHIRTS } from './sprites'

type Ctx = CanvasRenderingContext2D
type Look = 'day' | 'night' | 'vacant' | 'dirty'

// Sprite pixels inside a 36×3 room (288×96).
const DECK = 72 // stage floor
const STAGE: readonly [number, number] = [6, 118]
const CURTAIN: readonly [number, number] = [20, 104]
const TRUSS_Y = 16
const LAMPS = [30, 46, 62, 78, 94]
const FLOOR_SEATS = { x0: 126, x1: 282, y0: 90, rise: 0.07, step: 9.5 }
const BALCONY = { x0: 182, x1: 284, y: 54 }
const BALC_SEATS = { x0: 190, x1: 282, y0: 52, rise: 0.06, step: 9.5 }
const MARQUEE = { x0: 150, x1: 282, y0: 4, y1: 20 }
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']
const HAIRS = ['#343a40', '#f08c00', '#862e9c', '#212529']
const GLOWS = ['#69db7c', '#f783ac', '#74c0fc', '#ffd43b']

const SPOT: Record<ActId, string> = {
  orchestra: '255,236,153', jazzCats: '116,192,252', choir: '255,214,232', robots: '140,233,154', rock: '255,135,135',
  popStar: '229,153,247', piano: '255,224,178', penguins: '165,216,255', dragon: '255,169,77',
}

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function seats(s: { x0: number; x1: number; y0: number; rise: number; step: number }) {
  const out: [number, number][] = []
  for (let x = s.x0; x + s.step <= s.x1 + 1; x += s.step) out.push([x, s.y0 - (x - s.x0) * s.rise])
  return out
}
const FLOOR_SPOTS = seats(FLOOR_SEATS)
const BALC_SPOTS = seats(BALC_SEATS)
const ALL_SPOTS = [...FLOOR_SPOTS, ...BALC_SPOTS]

/** Scenery for the cached room sprite. */
export function paintConcertHall(c: Ctx, w: number, h: number, look: Look) {
  // hall walls and ceiling
  px(c, '#3b1f2b', 0, 0, w, h)
  const wall = c.createLinearGradient(0, 0, 0, h)
  wall.addColorStop(0, '#5a2a3a'); wall.addColorStop(1, '#2e1520')
  c.fillStyle = wall
  c.fillRect(2, 2, w - 4, h - 5)
  px(c, '#3a3a46', 0, 0, w, 2); px(c, '#2a2f3a', 0, h - 3, w, 3)
  // wall sconces between the floors
  for (const x of [140, 176, 230, 270]) { px(c, '#ffd8a8', x, 30, 3, 3); px(c, 'rgba(255,216,168,0.18)', x - 3, 27, 9, 9) }

  // stage: back wall, deck, front face
  const [s0, s1] = STAGE
  px(c, '#1a1426', s0, 10, s1 - s0, DECK - 10)
  px(c, '#2b2140', s0 + 4, 20, s1 - s0 - 8, DECK - 20)
  px(c, '#8b5a2b', s0, DECK, s1 - s0 + 4, 3)
  px(c, '#5c3a1e', s0, DECK + 3, s1 - s0 + 4, h - 3 - DECK - 3)
  for (let x = s0 + 6; x < s1; x += 10) px(c, '#6b4226', x, DECK + 4, 1, h - DECK - 10)
  // proscenium frame and gold trim
  px(c, '#7a1020', s0 - 2, 8, 4, DECK - 8); px(c, '#7a1020', s1 - 2, 8, 4, DECK - 8)
  px(c, '#7a1020', s0 - 2, 6, s1 - s0 + 4, 5)
  px(c, '#fcc419', s0 - 2, 11, s1 - s0 + 4, 1)
  // valance swags along the top of the curtain
  c.fillStyle = '#c92a2a'
  for (let x = CURTAIN[0]; x < CURTAIN[1]; x += 12) { c.beginPath(); c.ellipse(x + 6, 12, 6, 3.5, 0, 0, Math.PI); c.fill() }
  // truss with stage lights
  px(c, '#868e96', CURTAIN[0] - 4, TRUSS_Y, CURTAIN[1] - CURTAIN[0] + 8, 1)
  px(c, '#868e96', CURTAIN[0] - 4, TRUSS_Y + 3, CURTAIN[1] - CURTAIN[0] + 8, 1)
  c.strokeStyle = '#868e96'; c.lineWidth = 0.6
  for (let x = CURTAIN[0] - 4; x < CURTAIN[1] + 4; x += 4) { c.beginPath(); c.moveTo(x, TRUSS_Y); c.lineTo(x + 4, TRUSS_Y + 3); c.stroke() }
  for (const lx of LAMPS) { px(c, '#212529', lx - 2, TRUSS_Y + 4, 4, 4); px(c, '#495057', lx - 1, TRUSS_Y + 7, 2, 1) }
  // speaker stacks on the deck, outside the curtain
  for (const sx of [s0 + 2, s1 - 12]) {
    for (const [dy, hh] of [[0, 12], [12, 10]] as const) {
      const y = DECK - 22 + dy
      px(c, '#212529', sx, y, 10, hh - 1)
      c.fillStyle = '#495057'
      c.beginPath(); c.arc(sx + 5, y + hh / 2, hh / 2 - 2, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#212529'
      c.beginPath(); c.arc(sx + 5, y + hh / 2, 1.2, 0, Math.PI * 2); c.fill()
    }
  }
  // raked floor seats and the balcony
  const fs = FLOOR_SEATS
  c.fillStyle = '#4a2030'
  c.beginPath(); c.moveTo(fs.x0 - 4, h - 3); c.lineTo(fs.x0 - 4, fs.y0 + 2); c.lineTo(fs.x1 + 2, fs.y0 + 2 - (fs.x1 - fs.x0) * fs.rise); c.lineTo(fs.x1 + 2, h - 3); c.fill()
  px(c, '#3b1f2b', BALCONY.x0, BALCONY.y, BALCONY.x1 - BALCONY.x0, 5)
  px(c, '#fcc419', BALCONY.x0, BALCONY.y, BALCONY.x1 - BALCONY.x0, 1)
  for (let x = BALCONY.x0 + 3; x < BALCONY.x1; x += 6) px(c, '#e8b04b', x, BALCONY.y + 1.5, 1, 2.5)
  for (const [sx, sy] of ALL_SPOTS) seat(c, sx, sy)
  // marquee board (the words are drawn live)
  px(c, '#212529', MARQUEE.x0, MARQUEE.y0, MARQUEE.x1 - MARQUEE.x0, MARQUEE.y1 - MARQUEE.y0)
  px(c, '#fcc419', MARQUEE.x0, MARQUEE.y0, MARQUEE.x1 - MARQUEE.x0, 1)
  px(c, '#fcc419', MARQUEE.x0, MARQUEE.y1 - 1, MARQUEE.x1 - MARQUEE.x0, 1)
  if (look === 'night' || look === 'vacant') {
    c.fillStyle = look === 'vacant' ? 'rgba(20,20,30,0.5)' : 'rgba(5,10,28,0.3)'
    c.fillRect(0, 0, w, h)
  }
}

function seat(c: Ctx, x: number, y: number) {
  px(c, '#a61e4d', x, y - 6, 7, 6)
  px(c, '#c2255c', x + 1, y - 6, 5, 1)
  px(c, '#5c0f2a', x, y, 7, 1.5)
}

/** 0 = curtain shut, 1 = wide open. */
function curtainOpen(phase: string, k: number) {
  if (phase === 'show') return Math.min(1, (k * ENCORE_AT) / 3)
  if (phase === 'encore') return 1 - Math.max(0, (k - 0.85) / 0.15)
  return 0
}

export function drawConcertHall(c: Ctx, g: Game, f: Facility, p: { x: number; y: number }, w: number, _h: number, z: number, now: number, m: number) {
  const X = (sx: number) => p.x + sx * z
  const Y = (sy: number) => p.y + sy * z
  const P = (x: number, y: number, ww: number, hh: number, col: string) => px(c, col, X(x), Y(y), ww * z, hh * z)
  const live = f.reachable && !f.fire
  const { phase, k } = concertPhase(g)
  const playing = live && (phase === 'show' || phase === 'encore')
  const act = actFor(g)
  const open = live ? curtainOpen(phase, k) : 0
  const night = m >= 18 * 60 || m < 6 * 60

  // stage: spotlight and band behind the curtain
  if (open > 0) {
    c.save()
    c.beginPath(); c.rect(X(CURTAIN[0]), Y(TRUSS_Y), (CURTAIN[1] - CURTAIN[0]) * z, (DECK - TRUSS_Y) * z); c.clip()
    lightShow(c, X, Y, z, act.id, now)
    band(c, P, X, Y, z, act.id, now, phase === 'encore')
    c.restore()
  }
  drawCurtain(P, z, open)
  if (playing) stageFx(c, P, X, Y, act.id, now)

  // house lights dim for the show
  const dim = !live ? 0 : phase === 'dim' ? k : phase === 'show' ? 1 : phase === 'encore' ? open : 0
  if (dim > 0) { c.fillStyle = `rgba(10,6,24,${0.45 * dim})`; c.fillRect(X(STAGE[1] + 4), Y(22), w - (STAGE[1] + 6) * z, (96 - 25) * z) }

  // the crowd: front floor first, then the balcony
  if (live && f.inside > 0) {
    const n = Math.min(ALL_SPOTS.length, Math.ceil((ALL_SPOTS.length * f.inside) / 70))
    for (let i = 0; i < n; i++) {
      const [sx, sy] = ALL_SPOTS[i]
      const balcony = i >= FLOOR_SPOTS.length
      const jump = phase === 'encore' ? Math.abs(Math.sin(now / 170 + i)) * 3 : playing ? Math.max(0, Math.sin(now / 260 + i * 0.9)) * 0.9 : 0
      fan(c, P, X, Y, z, sx + 3.5, sy - 4 - jump, i, phase === 'encore', balcony && playing && night, now)
    }
  }

  // notes float up from the band
  if (playing && open > 0.5 && z >= 0.8) {
    const quiet = act.id === 'piano'
    c.font = `bold ${Math.round(8 * z)}px sans-serif`
    c.textAlign = 'center'
    for (let i = 0; i < (quiet ? 2 : 4); i++) {
      const t = (now / 1500 + i / 4) % 1
      const nx = 32 + ((i * 23 + Math.floor(now / 1500 + i / 4) * 37) % 64)
      const note = i % 2 ? '♫' : '♪'
      c.globalAlpha = 1 - t
      c.fillStyle = '#1a1426'
      c.fillText(note, X(nx) + 0.6 * z, Y(DECK - 18 - t * 34) + 0.6 * z)
      c.fillStyle = '#fff3bf'
      c.fillText(note, X(nx), Y(DECK - 18 - t * 34))
      c.globalAlpha = 1
    }
    c.textAlign = 'left'
  }

  drawMarquee(c, g, P, X, Y, z, now, live, phase, act)
}

function drawCurtain(P: Pfn, z: number, open: number) {
  const half = (CURTAIN[1] - CURTAIN[0]) / 2
  const cw = half - open * (half - 7)
  for (const side of [0, 1]) {
    const x = side ? CURTAIN[1] - cw : CURTAIN[0]
    P(x, 13, cw, DECK - 13, '#a51d2d')
    for (let fx = 2; fx < cw; fx += 4) P(x + fx, 13, 1.4, DECK - 13, '#7a1020')
    P(x, DECK - 2, cw, 2, '#7a1020')
  }
  if (open === 0 && z >= 0.8) P(CURTAIN[0] + half - 0.5, 13, 1, DECK - 13, '#5c0a18')
}

function lightShow(c: Ctx, X: (n: number) => number, Y: (n: number) => number, z: number, id: ActId, now: number) {
  const col = SPOT[id]
  const beams = id === 'popStar' || id === 'rock' ? LAMPS : [LAMPS[2]]
  beams.forEach((lx, i) => {
    const sway = beams.length > 1 ? Math.sin(now / 600 + i * 1.3) * 18 : 0
    const hue = id === 'popStar' ? `hsla(${(now / 8 + i * 70) % 360},90%,70%,0.28)` : `rgba(${col},${beams.length > 1 ? 0.22 : 0.32})`
    c.fillStyle = hue
    c.beginPath()
    c.moveTo(X(lx - 1), Y(TRUSS_Y + 8)); c.lineTo(X(lx + 1), Y(TRUSS_Y + 8))
    c.lineTo(X(lx + sway + 16), Y(DECK)); c.lineTo(X(lx + sway - 16), Y(DECK))
    c.fill()
  })
  c.fillStyle = `rgba(${col},0.35)`
  c.beginPath(); c.ellipse(X(62), Y(DECK), 30 * z, 3 * z, 0, 0, Math.PI * 2); c.fill()
}

type Pfn = (x: number, y: number, w: number, h: number, col: string) => void

/** A stage person, feet at (x, DECK). */
function player(P: Pfn, x: number, shirt: string, skin: string, bob = 0, hair = '#343a40') {
  const y = DECK - bob
  P(x - 1.5, y - 4, 1.2, 4, '#343a40'); P(x + 0.3, y - 4, 1.2, 4, '#343a40')
  P(x - 2, y - 9, 4, 5, shirt)
  P(x - 1.6, y - 12.6, 3.2, 3.4, skin)
  P(x - 1.8, y - 13.2, 3.6, 1.2, hair)
}

function band(c: Ctx, P: Pfn, X: (n: number) => number, Y: (n: number) => number, z: number, id: ActId, now: number, encore: boolean) {
  const beat = Math.sin(now / (encore ? 120 : 200))
  const bob = (i: number) => Math.max(0, Math.sin(now / (encore ? 140 : 230) + i)) * (encore ? 2 : 0.8)
  switch (id) {
    case 'orchestra': {
      for (const [i, x] of [34, 44, 54].entries()) {
        player(P, x, '#212529', SKINS[i], 0)
        P(x - 4, DECK - 10, 4, 1.6, '#8b5a2b') // violin under the chin
        c.strokeStyle = '#ced4da'; c.lineWidth = 0.5 * z
        const bow = Math.sin(now / 180 + i) * 2.5
        c.beginPath(); c.moveTo(X(x - 7 + bow), Y(DECK - 12)); c.lineTo(X(x - 1 + bow), Y(DECK - 8)); c.stroke()
      }
      // big drum
      c.fillStyle = '#d9480f'
      c.beginPath(); c.ellipse(X(70), Y(DECK - 7), 5 * z, 4 * z, 0, 0, Math.PI); c.fill()
      P(65, DECK - 7.6, 10, 1.2, '#f1f3f5')
      player(P, 70, '#212529', SKINS[3], 0)
      P(66 + (beat > 0 ? 0 : 1), DECK - 10 - Math.max(0, beat) * 2, 1, 3, '#adb5bd')
      // conductor on a podium, baton waving
      P(84, DECK - 3, 10, 3, '#495057')
      const cy = 3
      player(P, 89, '#000', SKINS[4], cy, '#dee2e6')
      c.strokeStyle = '#fff'; c.lineWidth = 0.6 * z
      const a = -2.2 + Math.sin(now / 220) * 0.7
      c.beginPath(); c.moveTo(X(87), Y(DECK - 11 - cy)); c.lineTo(X(87 + Math.cos(a) * 6), Y(DECK - 11 - cy + Math.sin(a) * 6)); c.stroke()
      return
    }
    case 'jazzCats': {
      const cats: [number, string][] = [[36, '#868e96'], [58, '#ffa94d'], [82, '#343a40']]
      cats.forEach(([x, fur], i) => {
        const y = DECK - bob(i)
        P(x - 2.5, y - 8, 5, 8, fur) // body
        P(x - 2, y - 12.5, 4, 4.5, fur) // head
        P(x - 2, y - 13.8, 1.2, 1.4, fur); P(x + 0.8, y - 13.8, 1.2, 1.4, fur) // ears
        P(x - 2.2, y - 11.4, 4.4, 1.2, '#000') // sunglasses
        c.strokeStyle = fur; c.lineWidth = 1 * z
        c.beginPath(); c.moveTo(X(x + 2.5), Y(y - 2)); c.quadraticCurveTo(X(x + 7), Y(y - 3), X(x + 6 + Math.sin(now / 300 + i)), Y(y - 9)); c.stroke()
      })
      // sax, upright bass, little drum
      P(33, DECK - 9, 1, 5, '#fcc419'); P(33, DECK - 5, 3, 1.4, '#fcc419')
      P(53, DECK - 15, 2, 13, '#8b5a2b'); P(52, DECK - 8, 4, 5, '#a0522d')
      P(78, DECK - 5, 6, 4, '#e64980'); P(78, DECK - 5.4, 6, 0.8, '#f1f3f5')
      return
    }
    case 'choir': {
      const robes = ['#4dabf7', '#ffd43b', '#ff8787', '#69db7c', '#da77f2', '#ffa94d']
      for (const [row, ry] of [[0, 0], [1, -6]] as const) {
        for (let i = 0; i < 7; i++) {
          const x = 30 + i * 10 + row * 5
          const y = DECK + ry
          if (row) P(x - 4, y, 8, 6, '#495057') // riser
          P(x - 1.8, y - 6, 3.6, 6, robes[(i + row) % robes.length])
          P(x - 1.4, y - 9, 2.8, 3, SKINS[(i + row * 2) % SKINS.length])
          const sing = Math.sin(now / 240 + i + row) > 0
          P(x - 0.4, y - 7.4, 0.8, sing ? 1 : 0.4, '#5c0a18')
          if (row === 0 && i === 6) {
            // one kid waves at the crowd
            const up = Math.sin(now / 150) > 0
            P(x + 1.8, y - (up ? 11 : 9), 1, 3, SKINS[(i + row * 2) % SKINS.length])
          }
        }
      }
      return
    }
    case 'robots': {
      [34, 56, 78].forEach((x, i) => {
        const y = DECK - bob(i)
        P(x - 1.5, y - 4, 1.2, 4, '#868e96'); P(x + 0.3, y - 4, 1.2, 4, '#868e96')
        P(x - 3, y - 10, 6, 6, '#adb5bd')
        P(x - 2.5, y - 15, 5, 5, '#ced4da')
        const blink = Math.floor(now / 300 + i) % 2
        P(x - 1.6, y - 13.4, 1.2, 1.2, blink ? '#ff6b6b' : '#ffd43b'); P(x + 0.4, y - 13.4, 1.2, 1.2, blink ? '#ff6b6b' : '#ffd43b')
        P(x - 0.3, y - 18, 0.6, 3, '#868e96'); P(x - 0.8, y - 19, 1.6, 1.6, Math.floor(now / 200 + i) % 2 ? '#51cf66' : '#ff922b')
        P(x - 2, y - 8.6, 4, 1, Math.floor(now / 250 + i * 2) % 3 === 0 ? '#74c0fc' : '#495057')
        // keytar slung across
        c.save(); c.translate(X(x), Y(y - 7)); c.rotate(-0.4)
        c.fillStyle = ['#e64980', '#4dabf7', '#ffd43b'][i]; c.fillRect(-5 * z, -1 * z, 10 * z, 2 * z)
        c.fillStyle = '#fff'; for (let kk = -4; kk < 3; kk += 1.5) c.fillRect(kk * z, -0.6 * z, 0.8 * z, 1.2 * z)
        c.restore()
      })
      return
    }
    case 'rock': {
      // drummer at the back
      P(57, DECK - 6, 10, 6, '#c92a2a'); P(57, DECK - 6.4, 10, 0.8, '#f1f3f5')
      player(P, 62, '#343a40', SKINS[1], bob(2) * 0.5, '#f08c00')
      P(53, DECK - 11, 4, 1, '#fcc419'); P(67, DECK - 11 + (beat > 0 ? 1 : 0), 4, 1, '#fcc419')
      for (const [i, x, gcol] of [[0, 38, '#e8590c'], [1, 84, '#7048e8']] as const) {
        const b = bob(i) * 1.5
        player(P, x, i ? '#212529' : '#495057', SKINS[i * 2], 0, i ? '#fa5252' : '#212529')
        // headbang: the head dips with the beat
        P(x - 1.6, DECK - 12.6 + b, 3.2, 3.4, SKINS[i * 2]); P(x - 1.8, DECK - 13.2 + b, 3.6, 2.4, i ? '#fa5252' : '#212529')
        c.save(); c.translate(X(x), Y(DECK - 7)); c.rotate(-0.35)
        c.fillStyle = gcol; c.beginPath(); c.ellipse(-1.5 * z, 0, 3 * z, 2 * z, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#8b5a2b'; c.fillRect(1 * z, -0.5 * z, 7 * z, 1 * z)
        c.restore()
      }
      return
    }
    case 'popStar': {
      const y = DECK - bob(0) * 1.4
      P(60.5, y - 4, 1.2, 4, '#f783ac'); P(62.3, y - 4, 1.2, 4, '#f783ac')
      c.fillStyle = Math.floor(now / 150) % 2 ? '#e599f7' : '#f783ac'
      c.beginPath(); c.moveTo(X(59), Y(y - 4)); c.lineTo(X(65), Y(y - 4)); c.lineTo(X(63.5), Y(y - 10)); c.lineTo(X(60.5), Y(y - 10)); c.fill()
      P(60.4, y - 13.6, 3.2, 3.6, SKINS[0])
      P(59.4, y - 14.6, 5.2, 2, '#fcc419'); P(59.4, y - 13, 1.2, 5, '#fcc419'); P(63.4, y - 13, 1.2, 5, '#fcc419')
      P(64.6, y - 13 + Math.sin(now / 200), 1, 4, SKINS[0]); P(64.4, y - 14 + Math.sin(now / 200), 1.4, 1.4, '#adb5bd') // mic
      return
    }
    case 'piano': {
      // a grand piano with its lid up
      c.fillStyle = '#111'
      c.beginPath(); c.moveTo(X(50), Y(DECK - 10)); c.lineTo(X(74), Y(DECK - 10)); c.quadraticCurveTo(X(78), Y(DECK - 7), X(72), Y(DECK - 6)); c.lineTo(X(50), Y(DECK - 6)); c.fill()
      c.beginPath(); c.moveTo(X(52), Y(DECK - 10)); c.lineTo(X(70), Y(DECK - 20)); c.lineTo(X(72), Y(DECK - 10)); c.fill()
      P(51, DECK - 6, 1.4, 6, '#111'); P(71, DECK - 6, 1.4, 6, '#111')
      P(46, DECK - 9.5, 4, 1, '#f8f9fa')
      for (let kx = 46.4; kx < 50; kx += 1) P(kx, DECK - 9.5, 0.4, 0.6, '#111')
      P(39, DECK - 5, 5, 1.2, '#5c3a1e'); P(39.5, DECK - 4, 1, 4, '#5c3a1e'); P(42.5, DECK - 4, 1, 4, '#5c3a1e')
      const lean = Math.sin(now / 500) * 0.6
      P(39.6 + lean, DECK - 11, 4, 6, '#212529')
      P(40 + lean, DECK - 14.6, 3.2, 3.4, SKINS[2]); P(39.8 + lean, DECK - 15.2, 3.6, 1.4, '#ced4da')
      P(43.5 + lean, DECK - 9.5 - Math.max(0, Math.sin(now / 160)) * 0.8, 2.5, 1, '#212529')
      return
    }
    case 'penguins': {
      [36, 52, 68, 84].forEach((x, i) => {
        const waddle = Math.sin(now / 160 + i) * 0.5
        const y = DECK - bob(i)
        c.save(); c.translate(X(x), Y(y)); c.rotate(waddle * 0.15)
        c.fillStyle = '#212529'; c.beginPath(); c.ellipse(0, -5 * z, 3 * z, 5 * z, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#f8f9fa'; c.beginPath(); c.ellipse(0.6 * z, -4.4 * z, 2 * z, 3.8 * z, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#ff922b'; c.fillRect(2 * z, -8.4 * z, 2 * z, 0.8 * z); c.fillRect(-2 * z, 0, 1.6 * z, 0.6 * z); c.fillRect(0.6 * z, 0, 1.6 * z, 0.6 * z)
        c.fillStyle = '#fff'; c.fillRect(0.6 * z, -9 * z, 0.8 * z, 0.8 * z)
        c.restore()
        const inst = ['#fcc419', '#e64980', '#4dabf7', '#fcc419'][i]
        if (i === 1) { P(x - 3, DECK - 4, 6, 4, inst); P(x - 3, DECK - 4.4, 6, 0.8, '#fff') } else P(x + 2.5, y - 7, 4, 1.2, inst)
      })
      return
    }
    case 'dragon': {
      // the giant visitors' dragon, small enough for the stage, on drums
      P(70, DECK - 7, 14, 7, '#1971c2'); P(70, DECK - 7.4, 14, 0.8, '#f1f3f5')
      P(62, DECK - 8, 6, 5, '#1971c2')
      const flap = Math.sin(now / 180) * 3
      c.fillStyle = '#2f9e44'
      c.beginPath(); c.ellipse(X(56), Y(DECK - 10), 9 * z, 8 * z, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#69db7c'
      c.beginPath(); c.moveTo(X(52), Y(DECK - 16)); c.lineTo(X(40), Y(DECK - 26 - flap)); c.lineTo(X(48), Y(DECK - 12)); c.fill()
      c.fillStyle = '#2f9e44'
      c.beginPath(); c.ellipse(X(60), Y(DECK - 21), 5 * z, 4 * z, 0.3, 0, Math.PI * 2); c.fill()
      P(63, DECK - 21, 5, 3, '#2f9e44')
      P(59, DECK - 23, 1.4, 1.4, '#fff'); P(59.4, DECK - 22.6, 0.6, 0.6, '#000')
      P(57, DECK - 26, 1, 2, '#ffd43b'); P(60, DECK - 26, 1, 2, '#ffd43b')
      for (let i = 0; i < 4; i++) P(48 + i * 3, DECK - 18 + i * 2, 1.6, 1.6, '#ffd43b')
      P(62, DECK - 13 - Math.max(0, beat) * 3, 6, 1, '#ffd43b'); P(66, DECK - 13 - Math.max(0, -beat) * 3, 6, 1, '#ffd43b')
      if (Math.floor(now / 2400) % 2 && (now % 2400) < 500) { c.font = `${Math.round(7 * z)}px sans-serif`; c.fillText('🔥', X(69), Y(DECK - 19)) }
      return
    }
  }
}

/** Effects that spill past the curtain: rock flames, pop confetti. */
function stageFx(c: Ctx, P: Pfn, X: (n: number) => number, Y: (n: number) => number, id: ActId, now: number) {
  if (id === 'rock') {
    const t = now % 2600
    if (t < 520) {
      const k = t / 520
      const hgt = Math.sin(k * Math.PI) * 22
      for (const fx of [CURTAIN[0] + 12, CURTAIN[1] - 12]) {
        for (const [col, wd, hk] of [['#ff6b00', 6, 1], ['#ffd43b', 3.6, 0.7], ['#fff3bf', 1.6, 0.4]] as const) {
          c.fillStyle = col
          c.beginPath(); c.moveTo(X(fx - wd / 2), Y(DECK)); c.quadraticCurveTo(X(fx + Math.sin(now / 40) * 1.5), Y(DECK - hgt * hk * 1.4), X(fx + wd / 2), Y(DECK)); c.fill()
        }
      }
    }
  }
  if (id === 'popStar') {
    const t = (now % 3200) / 1600
    if (t < 1) {
      const cols = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#fff']
      for (let i = 0; i < 24; i++) {
        const side = i % 2
        const vx = (side ? -1 : 1) * (8 + (i * 7) % 26)
        const vy = 34 + ((i * 13) % 22)
        const x = (side ? CURTAIN[1] - 10 : CURTAIN[0] + 10) + vx * t * 1.4
        const y = DECK - 8 - vy * t + 40 * t * t + Math.sin(i + now / 90) * 0.8
        P(x, y, 1.2, 1.2, cols[i % cols.length])
      }
    }
  }
}

function fan(c: Ctx, P: Pfn, X: (n: number) => number, Y: (n: number) => number, z: number, x: number, y: number, i: number, cheer: boolean, glow: boolean, now: number) {
  const shirt = SHIRTS[(i * 5) % SHIRTS.length], skin = SKINS[(i * 3) % SKINS.length]
  P(x - 2, y - 1, 4, 4, shirt)
  P(x - 1.6, y - 4.4, 3.2, 3.4, skin)
  P(x - 1.8, y - 5, 3.6, 1, HAIRS[i % HAIRS.length])
  if (cheer) { P(x - 3, y - 4 - (i % 2), 1, 3.5, skin); P(x + 2, y - 4 - ((i + 1) % 2), 1, 3.5, skin) }
  if (glow) {
    const a = Math.sin(now / 300 + i) * 0.5
    c.strokeStyle = GLOWS[i % GLOWS.length]
    c.lineWidth = 1 * z
    c.beginPath(); c.moveTo(X(x + 2), Y(y - 3)); c.lineTo(X(x + 2 + Math.sin(a) * 3), Y(y - 3 - Math.cos(a) * 4)); c.stroke()
  }
}

function drawMarquee(c: Ctx, g: Game, P: Pfn, X: (n: number) => number, Y: (n: number) => number, z: number, now: number, live: boolean, phase: ConcertPhase, act: Act) {
  const { x0, x1, y0, y1 } = MARQUEE
  // chasing bulbs
  for (let x = x0 + 2, i = 0; x < x1 - 1; x += 4, i++) {
    const on = live && (i + Math.floor(now / 180)) % 3 !== 0
    P(x, y0 + 0.2, 1.2, 1.2, on ? '#fff3bf' : '#866b1a'); P(x, y1 - 1.4, 1.2, 1.2, on ? '#fff3bf' : '#866b1a')
  }
  if (!live || z < 0.8) return
  const day = dayOf(g.time)
  const started = phase === 'show' || phase === 'encore' || phase === 'over'
  let text = `${act.emoji} ${act.name.toUpperCase()}`
  let col = '#ffe066'
  if (isMystery(g, day) && !started) text = '??? MYSTERY GUEST ???'
  if (soldOut(g) && started && phase !== 'over') {
    text = 'SOLD OUT!'
    col = Math.floor(now / 400) % 2 ? '#ff6b6b' : '#ffe066'
  }
  if (isMatinee(day) && !started) text = `MATINEE ${showLabel(day).toUpperCase()} · ${text}`
  c.font = `bold ${Math.max(5, 7 * z)}px monospace`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = col
  const maxW = (x1 - x0 - 6) * z
  const tw = c.measureText(text).width
  if (tw > maxW) {
    c.save(); c.translate(X((x0 + x1) / 2), Y((y0 + y1) / 2)); c.scale(maxW / tw, 1); c.fillText(text, 0, 0); c.restore()
  } else c.fillText(text, X((x0 + x1) / 2), Y((y0 + y1) / 2))
  c.textAlign = 'left'
  c.textBaseline = 'alphabetic'
}
