// Rainforest Frogs room: a misty terrarium. Scenery is cached; frogs, mist and glow are drawn live.
import { chorusOn, frogsRainy } from '../game/frogs'
import type { Facility, Game } from '../game/state'

type Ctx = CanvasRenderingContext2D
type Look = 'day' | 'night' | 'vacant' | 'dirty'
type Spot = readonly [number, number]

// Sprite pixels inside a 24×2 room (192×64).
const PAD = 8
const TOP = 4
const SOIL = 12 // soil top sits this far above the room's bottom edge
const FALL_X = 30 // waterfall stream, left edge
const POND: Spot = [60, 53]
const LILY: Spot = [70, 51]
const LOG: Spot = [126, 47]
const LEAVES: Spot[] = [[42, 36], [86, 30], [102, 42], [132, 30], [162, 40], [66, 20]]
const MUSH: Spot[] = [[108, 52], [154, 52], [170, 52]]
const BRANCH_Y = 14
const TOUCAN_X = 172
const GLASS_FROG: Spot = [180, 30]

interface Frog { col: string; spots: boolean; hops: [Spot, Spot] }
const FROGS: Frog[] = [
  { col: '#94d82d', spots: false, hops: [LILY, LEAVES[0]] },
  { col: '#1c7ed6', spots: true, hops: [LEAVES[1], LEAVES[5]] },
  { col: '#ff922b', spots: true, hops: [LEAVES[2], LOG] },
  { col: '#e03131', spots: true, hops: [LEAVES[3], LEAVES[4]] },
]
const ZAPPER = 0 // the lime frog catches flies

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function leaf(c: Ctx, x: number, y: number, rx: number, col: string) {
  c.fillStyle = col
  c.beginPath(); c.ellipse(x, y + 1.5, rx, 2.2, 0, 0, Math.PI * 2); c.fill()
  px(c, 'rgba(255,255,255,0.25)', x - rx + 2, y + 0.6, rx * 2 - 4, 0.6)
}

function mushroom(c: Ctx, x: number, y: number, cap: string) {
  px(c, '#f1f3f5', x - 0.8, y - 4, 1.6, 4)
  c.fillStyle = cap
  c.beginPath(); c.arc(x, y - 4, 3.4, Math.PI, 0); c.fill()
  px(c, '#fff', x - 1.8, y - 6, 1, 1); px(c, '#fff', x + 0.8, y - 5.4, 1, 1)
}

/** Scenery for the cached room sprite. */
export function paintRainforest(c: Ctx, w: number, h: number, look: Look) {
  const x0 = PAD, x1 = w - PAD, soil = h - SOIL
  px(c, '#1e3a2a', 0, 0, w, h)
  px(c, '#3a3a46', 0, 0, w, 2); px(c, '#2a2f3a', 0, h - 3, w, 3)
  const sky = c.createLinearGradient(0, TOP, 0, h - 6)
  sky.addColorStop(0, '#c3fae8'); sky.addColorStop(0.45, '#63e6be'); sky.addColorStop(1, '#2b8a3e')
  c.fillStyle = sky
  c.fillRect(x0, TOP, x1 - x0, h - 6 - TOP)
  // far jungle: big dark leaves along the back
  c.fillStyle = 'rgba(25,113,48,0.55)'
  for (let x = x0 + 6; x < x1; x += 17) {
    c.beginPath(); c.ellipse(x, soil - 8 - ((x * 7) % 9), 9, 4, (x % 3) - 1, 0, Math.PI * 2); c.fill()
  }
  // vines from the lid
  for (const vx of [56, 94, 118, 146]) {
    const len = 14 + (vx % 13)
    px(c, '#2b8a3e', vx, TOP, 1, len)
    for (let k = 4; k < len; k += 5) px(c, '#51cf66', vx + (k % 2 ? 1 : -2), TOP + k, 2, 1.4)
  }
  // waterfall rock and stream
  px(c, '#5c6b5e', 14, 14, 18, soil - 14); px(c, '#495057', 16, 18, 6, soil - 18)
  for (let y = 16; y < soil; y += 7) px(c, '#40c057', 14 + (y % 3) * 4, y, 5, 1.4)
  px(c, '#a5d8ff', FALL_X, 14, 6, soil - 12)
  // soil, pond, lily pads, log
  px(c, '#5c4033', x0, soil, x1 - x0, SOIL - 6)
  px(c, '#2f9e44', x0, soil, x1 - x0, 1.5)
  c.fillStyle = '#1c7ed6'
  c.beginPath(); c.ellipse(POND[0], POND[1], 28, 3.6, 0, 0, Math.PI * 2); c.fill()
  px(c, 'rgba(255,255,255,0.45)', POND[0] - 12, POND[1] - 1, 8, 0.8)
  leaf(c, LILY[0], LILY[1] - 1, 5, '#37b24d'); leaf(c, 48, 51, 4, '#40c057')
  px(c, '#f783ac', 47, 49.5, 2, 1.2)
  px(c, '#8b5a2b', LOG[0] - 16, LOG[1], 32, 6); px(c, '#6b4226', LOG[0] - 16, LOG[1] + 4, 32, 2)
  px(c, '#69db7c', LOG[0] - 14, LOG[1] - 0.6, 26, 1.4)
  c.fillStyle = '#d2a679'; c.beginPath(); c.ellipse(LOG[0] + 16, LOG[1] + 3, 1.6, 3, 0, 0, Math.PI * 2); c.fill()
  // giant leaves on stems (the frogs' lily pads in the air)
  c.strokeStyle = '#2b8a3e'; c.lineWidth = 1
  for (const [lx, ly] of LEAVES) {
    c.beginPath(); c.moveTo(lx + 2, ly + 2); c.quadraticCurveTo(lx + 8, (ly + soil) / 2, lx + 3, soil); c.stroke()
  }
  for (const [lx, ly] of LEAVES) leaf(c, lx, ly, 9, '#40c057')
  for (const [mx, my] of MUSH) mushroom(c, mx, my, mx % 2 ? '#e64980' : '#7950f2')
  // branch for the toucan
  px(c, '#6b4226', 148, BRANCH_Y, x1 - 148, 2); px(c, '#51cf66', 152, BRANCH_Y - 2, 4, 2)
  // glass: frame posts and a shine
  px(c, 'rgba(255,255,255,0.22)', x0 + 2, TOP + 2, 2, h - 20)
  px(c, 'rgba(255,255,255,0.12)', x1 - 30, TOP + 2, 1, h - 22)
  px(c, '#212529', x0 - 2, 3, 2, h - 8); px(c, '#212529', x1, 3, 2, h - 8)
  if (look === 'night') {
    c.fillStyle = 'rgba(5,10,28,0.42)'
    c.fillRect(0, 0, w, h)
  }
  px(c, '#2b8a3e', w / 2 - 30, 2, 60, 8)
  c.fillStyle = '#fff'
  c.font = 'bold 6px monospace'
  c.textAlign = 'center'
  c.fillText('RAINFOREST', w / 2, 8)
  c.textAlign = 'left'
}

/** How dark it is for glowing things: 0 by day, 1 at night. */
function darkness(m: number) {
  if (m >= 20 * 60 || m < 6 * 60) return 1
  if (m >= 18.5 * 60) return (m - 18.5 * 60) / 90
  if (m < 7 * 60) return (7 * 60 - m) / 60
  return 0
}

/** A side-on frog, feet at (x, y). `puff` 0..1 blows up the throat; `air` stretches the legs. */
function frog(c: Ctx, x: number, y: number, s: number, f: Frog, dir: number, puff: number, air: boolean, shine: boolean) {
  c.save()
  c.translate(x, y)
  c.scale(dir * s, s)
  if (puff > 0) {
    c.fillStyle = '#fff3bf'
    c.beginPath(); c.arc(3.4, -1.6, 0.9 + puff * 1.8, 0, Math.PI * 2); c.fill()
  }
  const dark = 'rgba(0,0,0,0.25)'
  if (air) { px(c, f.col, -6, -2.2, 3.4, 0.9); px(c, f.col, -8, -1.8, 2.4, 0.7) }
  else { px(c, f.col, -3.8, -1.8, 2.6, 1.8); px(c, dark, -4.6, -0.6, 2.6, 0.6) }
  px(c, f.col, -3, -3.6, 6, 2.8)
  px(c, f.col, 1, -4.6, 3.2, 2.4)
  px(c, f.col, -3, -4.2, 2.8, 0.8)
  px(c, f.col, 2.2, -1.2, 0.8, 1.2); px(c, dark, 2.2, -0.4, 1.6, 0.4)
  if (f.spots) { px(c, '#212529', -1.8, -3.2, 0.9, 0.9); px(c, '#212529', 0.2, -2.4, 0.9, 0.9); px(c, '#212529', -2.6, -2, 0.8, 0.8) }
  px(c, f.col, 2, -5.6, 1.6, 1.4)
  px(c, '#212529', 2.6, -5.3, 0.8, 0.8)
  if (shine) px(c, '#d8f5a2', 2.8, -5.4, 0.5, 0.5)
  c.restore()
}

/** The red-eyed tree frog, stuck to the front of the glass. */
function glassFrog(c: Ctx, x: number, y: number, s: number, now: number, puff: number, shine: boolean) {
  const P = (dx: number, dy: number, w: number, h: number, col: string) => px(c, col, x + dx * s, y + dy * s, w * s, h * s)
  for (const [dx, dy] of [[-4, -4], [3, -4], [-4, 2], [3, 2]]) P(dx, dy, 1.2, 1.2, '#ff922b')
  P(-3, -3, 6, 5, '#51cf66')
  P(-2, -5, 4, 2.4, '#51cf66')
  P(-1.6, 1, 3.2, 1, '#a9e34b')
  if (puff > 0) {
    c.fillStyle = '#fff3bf'
    c.beginPath(); c.arc(x, y - 2 * s, (0.8 + puff * 1.6) * s, 0, Math.PI * 2); c.fill()
  }
  const blink = (now % 5200) < 160
  for (const ex of [-2.6, 1.2]) {
    P(ex, -6.2, 1.6, blink ? 0.4 : 1.6, '#fa5252')
    if (!blink) P(ex + 0.6, -6, 0.4, 1.2, '#212529')
    if (!blink && shine) P(ex + 0.2, -6.2, 0.4, 0.4, '#ffe066')
  }
}

function toucan(c: Ctx, x: number, y: number, s: number, now: number, asleep: boolean) {
  const bob = Math.sin(now / 700) * 0.4 * s
  const P = (dx: number, dy: number, w: number, h: number, col: string) => px(c, col, x + dx * s, y + dy * s + bob, w * s, h * s)
  P(-2, -7, 4, 6, '#212529')
  P(-1.6, 0, 1.2, 3, '#212529')
  P(0.4, -6.4, 2, 2.6, '#fff9db')
  P(2, -6.8, 4.6, 1.4, '#ff922b')
  P(2, -5.4, 4, 0.8, '#ffd43b')
  P(5.4, -6.8, 1.2, 1, '#212529')
  P(0.6, -7, 1, asleep ? 0.3 : 1, asleep ? '#868e96' : '#fff')
  if (!asleep) P(1, -6.6, 0.5, 0.5, '#212529')
  P(-1, 0, 0.6, 0.6, '#fab005'); P(0.6, 0, 0.6, 0.6, '#fab005')
}

function ribbit(c: Ctx, text: string, x: number, y: number, z: number, k: number) {
  c.globalAlpha = 1 - k
  c.font = `bold ${Math.max(7, Math.round(5 * z))}px sans-serif`
  c.textAlign = 'center'
  c.fillStyle = '#1e3a2a'
  c.fillText(text, x + 0.6 * z, y - k * 14 * z + 0.6 * z)
  c.fillStyle = '#fff'
  c.fillText(text, x, y - k * 14 * z)
  c.textAlign = 'left'
  c.globalAlpha = 1
}

const CHORUS_BEAT = 650 // ms per singer

export function drawRainforest(c: Ctx, g: Game, _f: Facility, p: { x: number; y: number }, w: number, h: number, z: number, now: number, m: number) {
  const X = (sx: number) => p.x + sx * z
  const Y = (sy: number) => p.y + sy * z
  const x0 = X(PAD), x1 = p.x + w - PAD * z
  const soil = h / z - SOIL
  const dark = darkness(m)
  const singing = chorusOn(g)
  const hopEvery = frogsRainy(g) ? 1500 : 4500
  const singer = Math.floor(now / CHORUS_BEAT) % (FROGS.length + 1)
  const beat = (now % CHORUS_BEAT) / CHORUS_BEAT
  const puffFor = (i: number) => (singing && singer === i ? Math.sin(beat * Math.PI) : 0)
  const heads: { x: number; y: number }[] = []

  c.save()
  c.beginPath(); c.rect(x0, Y(TOP), x1 - x0, h - (TOP + 6) * z); c.clip()

  // waterfall streaks and splash
  c.fillStyle = 'rgba(255,255,255,0.75)'
  for (let k = 0; k < 4; k++) {
    const sy = 14 + ((now / 14 + k * 9) % (soil - 14))
    c.fillRect(X(FALL_X + 1 + (k % 3) * 1.5), Y(sy), z, 3 * z)
  }
  for (let k = 0; k < 3; k++) {
    const t = ((now / 500 + k / 3) % 1)
    c.fillRect(X(FALL_X + 2 + (k - 1) * 3 * t), Y(soil - 1 - Math.sin(t * Math.PI) * 3), 0.8 * z, 0.8 * z)
  }

  // mushroom glow
  if (dark > 0) {
    for (const [mx, my] of MUSH) {
      c.fillStyle = `rgba(150,242,215,${0.28 * dark * (0.8 + 0.2 * Math.sin(now / 500 + mx))})`
      c.beginPath(); c.arc(X(mx), Y(my - 4), 7 * z, 0, Math.PI * 2); c.fill()
      c.fillStyle = `rgba(227,250,252,${0.8 * dark})`
      c.beginPath(); c.arc(X(mx), Y(my - 4), 3.4 * z, Math.PI, 0); c.fill()
    }
  }

  // frogs on leaves, hopping between two spots each
  FROGS.forEach((fr, i) => {
    const off = i * 1130
    const t = ((now + off) % hopEvery) / hopEvery
    const leg = Math.floor((now + off) / hopEvery) % 2
    const from = fr.hops[leg], to = fr.hops[1 - leg]
    const dir = to[0] >= from[0] ? 1 : -1
    let fx = from[0], fy = from[1]
    const air = !singing && t > 0.75
    if (air) {
      const k = (t - 0.75) / 0.25
      fx = from[0] + (to[0] - from[0]) * k
      const arc = Math.min(8 + Math.abs(to[0] - from[0]) * 0.2, Math.min(from[1], to[1]) - TOP - 12) // stay under the sign
      fy = from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * arc
    }
    frog(c, X(fx), Y(fy), 1.3 * z, fr, dir, puffFor(i), air, dark > 0.5)
    heads.push({ x: X(fx + dir * 3.5), y: Y(fy - 6) })
    if (i === ZAPPER && !air) {
      // a fly buzzes nearby, and now and then the tongue gets it
      const zt = ((now + 900) % 6400) / 6400
      const flyX = X(fx + dir * (9 + Math.sin(now / 170) * 3)), flyY = Y(fy - 9 + Math.cos(now / 230) * 2)
      if (zt >= 0.86 && zt < 0.9) {
        c.strokeStyle = '#f783ac'; c.lineWidth = Math.max(1, 0.8 * z)
        c.beginPath(); c.moveTo(X(fx + dir * 4.5), Y(fy - 4.5)); c.lineTo(flyX, flyY); c.stroke()
      }
      if (zt < 0.88) {
        px(c, '#212529', flyX - 0.6 * z, flyY - 0.6 * z, 1.2 * z, 1.2 * z)
        px(c, 'rgba(255,255,255,0.8)', flyX - 0.4 * z, flyY - (now % 120 < 60 ? 1.6 : 1.2) * z, 0.8 * z, 0.6 * z)
      }
    }
  })

  // toucan on the branch
  toucan(c, X(TOUCAN_X), Y(BRANCH_Y), z, now, dark > 0.8)

  // drifting mist across the top, drips down the glass
  for (let i = 0; i < 4; i++) {
    const span = x1 - x0 + 50 * z
    const mx = x0 - 25 * z + ((now * 0.006 * z + i * 61 * z) % span)
    c.fillStyle = 'rgba(255,255,255,0.22)'
    c.beginPath(); c.ellipse(mx, Y(9 + i * 3.5 + Math.sin(now / 1500 + i) * 1.5), 24 * z, 3.5 * z, 0, 0, Math.PI * 2); c.fill()
  }
  for (let i = 0; i < 6; i++) {
    const k = (now / (2600 + i * 400) + i * 0.37) % 1
    const dx = PAD + 12 + ((i * 47) % (w / z - PAD * 2 - 24))
    c.fillStyle = 'rgba(208,235,255,0.35)'
    c.fillRect(X(dx) + 0.3 * z, Y(TOP + 2), 0.4 * z, k * (soil - TOP - 2) * z)
    c.fillStyle = 'rgba(231,245,255,0.85)'
    c.fillRect(X(dx), Y(TOP + 2 + k * (soil - TOP - 2)), z, 1.6 * z)
  }

  // the red-eyed tree frog on the glass
  glassFrog(c, X(GLASS_FROG[0]), Y(GLASS_FROG[1]), 1.5 * z, now, puffFor(FROGS.length), dark > 0.5)
  heads.push({ x: X(GLASS_FROG[0]), y: Y(GLASS_FROG[1] - 10) })

  // fireflies
  if (dark > 0) {
    for (let i = 0; i < 7; i++) {
      const a = dark * Math.max(0, Math.sin(now / 320 + i * 1.7))
      if (a <= 0) continue
      const fx = X(PAD + 10 + ((i * 29 + now / (60 + i * 9)) % (w / z - PAD * 2 - 20)))
      const fy = Y(TOP + 10 + ((i * 13) % 30) + Math.sin(now / 600 + i) * 4)
      c.fillStyle = `rgba(216,245,162,${0.3 * a})`
      c.beginPath(); c.arc(fx, fy, 2.4 * z, 0, Math.PI * 2); c.fill()
      c.fillStyle = `rgba(244,252,193,${a})`
      c.fillRect(fx - 0.5 * z, fy - 0.5 * z, z, z)
    }
  }
  c.restore()

  // dusk chorus: ribbits float up from whoever is singing, and the one before
  if (singing) {
    for (const back of [0, 1]) {
      const i = (singer - back + heads.length) % heads.length
      ribbit(c, i === FROGS.length ? 'RIBBIT!' : 'ribbit', heads[i].x, heads[i].y, z, (back + beat) / 2)
    }
  }
}
