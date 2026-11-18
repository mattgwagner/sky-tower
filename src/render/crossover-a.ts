// Crossover rooms (#20): Door Codes, Midnight Hotel, Night Shift and Math Maker, drawn from scratch
// in Sky Tower's pixel style. Characters keep their home-game colours: see the hex notes beside each.
// Walls and furniture are cached painters; characters, doors, beams and visitors are drawn live.
import {
  DOORS_PER_FLOOR, boughtItem, croonerSinging, crossHash, doorCount, doorPeek, gigglesSpot, lampFlicker, makerWalk,
  pencilTippedAt,
} from '../game/crossover-a'
import type { DoorMonster } from '../game/crossover-a'
import type { Facility, Game, Person } from '../game/state'
import { minuteOfDay } from '../game/state'

type Ctx = CanvasRenderingContext2D
type Look = 'day' | 'night' | 'vacant' | 'dirty'
/** Draws one visitor with its feet at (x, yBottom), in screen px. */
export type DrawPerson = (x: number, yBottom: number, shirt: number, frame: number) => void

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

/** Paints in room sprite units: (x, y) from the room's top-left, scaled by z. */
interface Pen {
  c: Ctx
  z: number
  r(color: string, x: number, y: number, w: number, h: number): void
  X(x: number): number
  Y(y: number): number
}
function pen(c: Ctx, p: { x: number; y: number }, z: number): Pen {
  return {
    c, z,
    r: (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(p.x + x * z, p.y + y * z, w * z, h * z) },
    X: (x) => p.x + x * z,
    Y: (y) => p.y + y * z,
  }
}
/** The same pen, unscaled, for the cached painters. */
function flat(c: Ctx): Pen {
  return { c, z: 1, r: (color, x, y, w, h) => px(c, color, x, y, w, h), X: (x) => x, Y: (y) => y }
}

function text(q: Pen, s: string, x: number, y: number, size: number, color: string) {
  q.c.fillStyle = color
  q.c.font = `bold ${Math.max(4, Math.round(size * q.z))}px monospace`
  q.c.textAlign = 'center'
  q.c.textBaseline = 'middle'
  q.c.fillText(s, q.X(x), q.Y(y))
  q.c.textAlign = 'left'
  q.c.textBaseline = 'alphabetic'
}

// ---------------------------------------------------------------- Door Codes cast
// Colours from door-codes/public/index.html (drawGrumble, drawHoot, drawFluff, drawSquirm, drawClonk, drawCrooner).

/** Grumble: brown bear, red suspenders, tiny blue top hat with a gold band. Red eyes when he wakes. */
function grumble(q: Pen, x: number, y: number, awake: boolean) {
  q.r('#6b3f22', x - 6, y - 3, 4, 3)
  q.r('#6b3f22', x + 2, y - 3, 4, 3)
  q.r('#7a4a2a', x - 7, y - 11, 14, 9)
  q.r('#c08a5a', x - 4, y - 9, 8, 6)
  q.r('#5d666e', x - 1, y - 7, 3, 3)
  q.r('#c7372f', x - 5, y - 11, 2, 8)
  q.r('#c7372f', x + 3, y - 11, 2, 8)
  q.r('#7a4a2a', x - 6, y - 19, 12, 9)
  q.r('#7a4a2a', x - 7, y - 21, 3, 3)
  q.r('#7a4a2a', x + 4, y - 21, 3, 3)
  q.r('#c08a5a', x - 6, y - 20, 1, 1)
  q.r('#c08a5a', x + 5, y - 20, 1, 1)
  q.r('#d9a878', x - 3, y - 14, 6, 4)
  q.r('#2a1a10', x - 1, y - 14, 2, 1)
  if (awake) {
    q.r('#ff3b2a', x - 4, y - 17, 2, 2)
    q.r('#ff3b2a', x + 2, y - 17, 2, 2)
    q.r('#2a1a10', x - 5, y - 18, 3, 1)
    q.r('#2a1a10', x + 2, y - 18, 3, 1)
    q.r('#f4f0e6', x - 1, y - 11, 1, 1)
    q.r('#f4f0e6', x + 1, y - 11, 1, 1)
  } else {
    q.r('#2a1a10', x - 4, y - 16, 2, 1)
    q.r('#2a1a10', x + 2, y - 16, 2, 1)
  }
  // hat, tipped
  q.r('#2b3f8f', x - 3, y - 25, 6, 5)
  q.r('#2b3f8f', x - 4, y - 21, 8, 1)
  q.r('#f5c542', x - 3, y - 22, 6, 1)
}

/** Hoot: brown owl, cream belly, orange eyes, navy guard cap with a gold badge. */
function hoot(q: Pen, x: number, y: number, blink: boolean) {
  q.r('#8a6a4a', x - 5, y - 12, 10, 12)
  q.r('#6b4f34', x - 6, y - 10, 2, 7)
  q.r('#6b4f34', x + 4, y - 10, 2, 7)
  q.r('#e8d6b8', x - 3, y - 7, 6, 6)
  q.r('#a88a66', x - 1, y - 5, 2, 1)
  q.r('#a88a66', x - 1, y - 3, 2, 1)
  q.r('#e8d6b8', x - 4, y - 11, 4, 4)
  q.r('#e8d6b8', x, y - 11, 4, 4)
  if (blink) {
    q.r('#6b4f34', x - 4, y - 9, 4, 1)
    q.r('#6b4f34', x, y - 9, 4, 1)
  } else {
    q.r('#ffb52e', x - 3, y - 10, 2, 2)
    q.r('#ffb52e', x + 1, y - 10, 2, 2)
    q.r('#111', x - 3, y - 10, 1, 1)
    q.r('#111', x + 2, y - 10, 1, 1)
  }
  q.r('#e0a030', x - 1, y - 8, 2, 2)
  q.r('#e0a030', x - 3, y, 2, 1)
  q.r('#e0a030', x + 1, y, 2, 1)
  q.r('#24305e', x - 5, y - 14, 10, 3)
  q.r('#1a2348', x - 6, y - 12, 7, 1)
  q.r('#f5c542', x - 1, y - 13, 2, 1)
}

/** Fluff: tiny grey fuzzballs with long bunny ears and pink noses, always in a group. */
function fluff(q: Pen, x: number, y: number, hop: number) {
  const yy = y - hop
  q.r('#9a97a6', x - 3, yy - 5, 6, 5)
  q.r('#9a97a6', x - 4, yy - 4, 8, 3)
  q.r('#b3b0bf', x - 2, yy - 4, 4, 3)
  q.r('#8d8a99', x - 2, yy - 9, 1, 4)
  q.r('#8d8a99', x + 1, yy - 9, 1, 4)
  q.r('#c9a4b4', x - 2, yy - 8, 1, 2)
  q.r('#c9a4b4', x + 1, yy - 8, 1, 2)
  q.r('#fff', x - 2, yy - 4, 1, 1)
  q.r('#fff', x + 1, yy - 4, 1, 1)
  q.r('#e07a9a', x, yy - 3, 1, 1)
}

/** Squirm: a pink segmented worm rising from a dirt burrow, ring of teeth on top. */
function squirm(q: Pen, x: number, y: number, rise: number, spin: number) {
  const segs = 2 + Math.round(rise * 2)
  for (let i = 0; i < segs; i++) {
    const sx = x - 3 + Math.round(Math.sin(i * 0.9 + spin) * 1)
    q.r(i % 2 ? '#c96a86' : '#b4536f', sx, y - 4 - i * 3, 6, 3)
    q.r('#8e3a54', sx, y - 4 - i * 3, 6, 1)
  }
  const hy = y - 4 - segs * 3
  q.r('#d77a96', x - 4, hy - 4, 8, 5)
  q.r('#e898ae', x - 3, hy - 4, 2, 1)
  q.r('#3a0d16', x - 2, hy - 3, 4, 3)
  q.r('#1a0408', x - 1, hy - 2, 2, 1)
  const t = Math.floor(spin * 2) % 2
  q.r('#fff8e0', x - 2 + t, hy - 3, 1, 1)
  q.r('#fff8e0', x + 1 - t, hy - 1, 1, 1)
  q.r('#111', x - 3, hy - 5, 1, 1)
  q.r('#111', x + 2, hy - 5, 1, 1)
  // burrow and broken boards
  q.r('#4a3221', x - 6, y - 3, 12, 3)
  q.r('#6b4a2e', x - 7, y - 4, 4, 1)
  q.r('#6b4a2e', x + 4, y - 3, 3, 1)
}

/** Clonk: a red brick brute with orange brick hands and no eyes; his whole head is a mouth. */
function clonk(q: Pen, x: number, y: number, listen: boolean) {
  for (let i = 0; i < 3; i++) {
    q.r('#d1312b', x - 5, y - 2 - i * 2, 3, 2)
    q.r('#d1312b', x + 2, y - 2 - i * 2, 3, 2)
    q.r('#9c1f1b', x - 5, y - 1 - i * 2, 3, 1)
    q.r('#9c1f1b', x + 2, y - 1 - i * 2, 3, 1)
  }
  for (let r = 0; r < 4; r++) {
    const off = r % 2 ? 2 : 0
    for (let b = 0; b < 3; b++) {
      q.r('#d1312b', x - 7 + off + b * 4, y - 8 - r * 2, 3, 2)
      q.r('#9c1f1b', x - 7 + off + b * 4, y - 7 - r * 2, 3, 1)
    }
  }
  q.r('#f05a28', x - 10, y - 10, 3, 3)
  q.r('#f05a28', x + 7, y - 10, 3, 3)
  // the brick head: all mouth
  q.r('#d1312b', x - 5, y - 22, 10, 7)
  q.r('#2a0606', x - 4, y - 21, 8, 5)
  for (let i = 0; i < 4; i++) {
    q.r('#fffbea', x - 4 + i * 2, y - 21, 1, 1)
    q.r('#fffbea', x - 3 + i * 2, y - 17, 1, 1)
  }
  q.r('#ff8f8f', x - 1, y - 18, 3, 1)
  const ear = listen ? 2 : 1
  q.r('#f05a28', x - 5 - ear, y - 20, ear, 2)
  q.r('#f05a28', x + 5, y - 20, ear, 2)
  if (listen) {
    q.r('#ffe066', x - 10, y - 21, 1, 3)
    q.r('#ffe066', x + 9, y - 21, 1, 3)
  }
}

const NOTE_COLOR = '#fde68a'
function notes(q: Pen, x: number, y: number, now: number, n = 3) {
  for (let i = 0; i < n; i++) {
    const t = ((now / 900 + i / n) % 1)
    const nx = x + Math.sin(t * 6 + i) * 3 + i * 3
    const ny = y - t * 14
    q.c.globalAlpha = 1 - t
    q.r(NOTE_COLOR, nx, ny, 2, 2)
    q.r(NOTE_COLOR, nx + 1, ny - 3, 1, 3)
    q.r(NOTE_COLOR, nx + 1, ny - 3, 2, 1)
  }
  q.c.globalAlpha = 1
}

/** Crooner: sky-blue robot bear, silver sequin jacket, gold star sunglasses, mic up to his mouth. */
function crooner(q: Pen, x: number, y: number, now: number, sway: number) {
  const s = Math.round(sway)
  q.r('#e9eef5', x - 4, y - 5, 3, 5)
  q.r('#e9eef5', x + 1, y - 5, 3, 5)
  q.r('#fff', x - 5, y - 1, 4, 1)
  q.r('#fff', x + 1, y - 1, 4, 1)
  q.r('#b9c6d6', x - 6 + s, y - 14, 12, 9)
  q.r('#8fa0b5', x - 2 + s, y - 14, 1, 6)
  q.r('#8fa0b5', x + 1 + s, y - 14, 1, 6)
  const tw = Math.floor(now / 250) % 3
  q.r('#fff', x - 4 + s + tw, y - 11, 1, 1)
  q.r('#fff', x + 3 + s - tw, y - 8, 1, 1)
  // arm out, and the mic hand
  q.r('#5fb4e8', x - 9 + s, y - 13, 3, 2)
  q.r('#c6ecff', x - 10 + s, y - 14, 2, 2)
  q.r('#5fb4e8', x + 5 + s, y - 15, 2, 4)
  q.r('#16161c', x + 3 + s, y - 17, 1, 4)
  q.r('#c9d1dc', x + 2 + s, y - 19, 3, 2)
  // head
  q.r('#5fb4e8', x - 6 + s, y - 25, 12, 11)
  q.r('#5fb4e8', x - 7 + s, y - 27, 3, 3)
  q.r('#5fb4e8', x + 4 + s, y - 27, 3, 3)
  q.r('#2b3a5c', x - 6 + s, y - 26, 1, 1)
  q.r('#2b3a5c', x + 5 + s, y - 26, 1, 1)
  q.r('#3f8fc8', x - 4 + s, y - 27, 7, 3)
  q.r('#f5c542', x - 5 + s, y - 22, 4, 3)
  q.r('#f5c542', x + 1 + s, y - 22, 4, 3)
  q.r('#1b1030', x - 4 + s, y - 21, 2, 1)
  q.r('#1b1030', x + 2 + s, y - 21, 2, 1)
  q.r('#c6ecff', x - 3 + s, y - 18, 6, 3)
  q.r('#1b2440', x - 1 + s, y - 18, 2, 1)
  q.r('#3a0b1a', x - 1 + s, y - 16, 2, 1)
  q.r('#9aa6b5', x - 6 + s, y - 17, 1, 1)
  q.r('#9aa6b5', x + 5 + s, y - 17, 1, 1)
  notes(q, x + 3 + s, y - 22, now)
}

// ---------------------------------------------------------------- Midnight Hotel cast
// Colours from midnight-hotel/public/index.html (drawMortimer, drawGiggles, the shop table).

/** Mortimer the Mummy: bandages, one big socket and one small, green pupils, a lantern and a loose bandage end. */
function mortimer(q: Pen, x: number, y: number, now: number) {
  q.r('#d2c6a6', x - 4, y - 4, 3, 4)
  q.r('#d2c6a6', x + 1, y - 4, 3, 4)
  q.r('#ddd2b4', x - 5, y - 14, 10, 10)
  for (let i = 0; i < 4; i++) q.r('rgba(110,90,60,.45)', x - 5, y - 13 + i * 3, 10, 1)
  q.r('#e6dcc2', x - 4, y - 21, 8, 7)
  q.r('rgba(110,90,60,.45)', x - 4, y - 19, 8, 1)
  q.r('rgba(110,90,60,.45)', x - 4, y - 16, 8, 1)
  q.r('#160d0a', x - 3, y - 19, 3, 3)
  q.r('#160d0a', x + 1, y - 18, 2, 2)
  q.r('#7dff9a', x - 2, y - 18, 1, 1)
  q.r('#7dff9a', x + 1, y - 18, 1, 1)
  // loose bandage end, waving
  const wv = Math.round(Math.sin(now / 300) * 1.5)
  q.r('#ddd2b4', x + 4, y - 20, 3, 1)
  q.r('#ddd2b4', x + 6, y - 19 + wv, 2, 1)
  // arm with the lantern
  q.r('#ddd2b4', x - 8, y - 16, 3, 2)
  q.r('#3b2414', x - 9, y - 18, 3, 4)
  const fl = 0.75 + 0.25 * Math.sin(now / 90)
  q.c.globalAlpha = 0.35 * fl
  q.r('#ffb347', x - 12, y - 21, 9, 9)
  q.c.globalAlpha = 1
  q.r('#ffd27a', x - 8, y - 17, 1, 2)
}

/** Giggles: a little ghost with a red propeller beanie, happy closed eyes, big open grin. Half see-through. */
function giggles(q: Pen, x: number, y: number, now: number, alpha: number) {
  q.c.globalAlpha = alpha
  const bob = Math.round(Math.sin(now / 260) * 1)
  const yy = y + bob
  q.r('#dff6ff', x - 4, yy - 9, 8, 8)
  q.r('#dff6ff', x - 3, yy - 10, 6, 1)
  const wig = Math.floor(now / 160) % 2
  for (let i = 0; i < 4; i++) q.r('#dff6ff', x - 4 + i * 2, yy - 1 + ((i + wig) % 2), 2, 1)
  q.r('#1a1424', x - 3, yy - 7, 2, 1)
  q.r('#1a1424', x + 1, yy - 7, 2, 1)
  q.r('#1a1424', x - 1, yy - 5, 3, 2)
  q.r('#ff7a9a', x, yy - 4, 1, 1)
  q.r('rgba(255,140,170,.6)', x - 4, yy - 6, 1, 1)
  q.r('rgba(255,140,170,.6)', x + 3, yy - 6, 1, 1)
  q.r('#ff4d5e', x - 3, yy - 12, 6, 2)
  q.r('#e8b64a', x - 3, yy - 10, 6, 1)
  q.r('#555', x, yy - 13, 1, 1)
  const pr = Math.abs(Math.cos(now / 50)) * 3
  q.r('#7fe3ff', x + 0.5 - pr, yy - 14, pr * 2, 1)
  q.c.globalAlpha = 1
}

/** One stock icon, about 4px, in the shop's real colours. */
function stockIcon(q: Pen, i: number, x: number, y: number) {
  switch (i) {
    case 0: // fresh battery
      q.r('#495057', x, y - 4, 3, 4); q.r('#7dff9a', x, y - 2, 3, 2); q.r('#adb5bd', x + 1, y - 5, 1, 1); return
    case 1: // skeleton key
      q.r('#e8b64a', x, y - 4, 2, 2); q.r('#e8b64a', x + 2, y - 3, 3, 1); q.r('#e8b64a', x + 4, y - 2, 1, 1); return
    case 2: // mega flashlight
      q.r('#868e96', x, y - 3, 4, 2); q.r('#fff3bf', x + 4, y - 4, 1, 4); return
    case 3: // lucky sock
      q.r('#e03131', x, y - 5, 2, 3); q.r('#fff', x, y - 4, 2, 1); q.r('#e03131', x, y - 2, 4, 2); return
  }
}

/** What a Mortimer's shopper carries out, held at the hand. */
export function drawCarried(c: Ctx, g: Game, p: Person, x: number, yBottom: number, z: number) {
  const i = boughtItem(g, p)
  if (i == null || z < 0.75) return
  stockIcon(pen(c, { x, y: yBottom }, z), i, 2, -4)
}

// ---------------------------------------------------------------- Night Shift
// Colours from night-shift/public/game.js (drawHall, the lamps, the rusher, drawCloset).

/** The rusher: a churning black cloud in a red haze with white eyes and a zigzag of teeth. */
function rusher(q: Pen, x: number, y: number, now: number) {
  q.c.globalAlpha = 0.4
  q.r('rgba(255,40,30,1)', x - 12, y - 22, 24, 22)
  q.c.globalAlpha = 1
  for (let i = 0; i < 8; i++) {
    const a = now / 120 + i * 0.8
    const cx = x + Math.cos(a) * 6
    const cy = y - 11 + Math.sin(a * 1.3) * 5
    q.r('rgba(4,2,5,.92)', cx - 4, cy - 4, 8, 8)
  }
  q.r('#fff', x - 5, y - 15, 3, 2)
  q.r('#fff', x + 2, y - 15, 3, 2)
  for (let i = 0; i < 4; i++) q.r('#fff', x - 4 + i * 2, y - 10 + (i % 2), 2, 1)
}

/** A louvred closet door, Night Shift's only hiding place. */
function closet(q: Pen, x: number, y: number, eyes: boolean) {
  q.r('#2a1a12', x, y, 12, 22)
  for (let i = 0; i < 9; i++) q.r('#050304', x + 1, y + 2 + i * 2, 10, 1)
  q.r('#050304', x + 6, y, 1, 22)
  q.r('#b08a3a', x + 4, y + 11, 1, 1)
  q.r('#b08a3a', x + 7, y + 11, 1, 1)
  if (eyes) {
    q.r('#f4f1d0', x + 2, y + 8, 1, 1)
    q.r('#f4f1d0', x + 4, y + 8, 1, 1)
    q.r('#f4f1d0', x + 8, y + 10, 1, 1)
    q.r('#f4f1d0', x + 10, y + 10, 1, 1)
  }
}

// ---------------------------------------------------------------- Math Maker
// Colours from math-maker/public/index.html (drawMaker).

/** The Math Maker: a lanky mint clockwork ghost, gear in his chest, wind-up key, blue cap, pencil behind his ear. */
function maker(q: Pen, x: number, y: number, now: number, hammer: number, tip: number, walking: boolean) {
  const bob = Math.round(Math.sin(now / 280) * 1)
  const yy = y + bob
  const body = 'rgba(214,255,238,.94)'
  // glow
  q.c.globalAlpha = 0.18
  q.r('#9ff5d5', x - 7, yy - 27, 14, 27)
  q.c.globalAlpha = 1
  // wavy tail
  const wig = Math.floor(now / 200) % 2
  q.r(body, x - 3, yy - 4, 6, 3)
  q.r(body, x - 3 + wig, yy - 1, 2, 1)
  q.r(body, x + 1 - wig, yy - 1, 2, 1)
  // tall skinny body
  q.r(body, x - 4, yy - 16, 8, 12)
  q.r('#b9efd9', x - 2, yy - 13, 4, 4)
  q.r(Math.floor(now / 200) % 2 ? '#c9932e' : '#7a5414', x - 1, yy - 12, 2, 2)
  // wind-up key
  const kw = Math.abs(Math.cos(now / 300)) * 2
  q.r('#d4a23a', x + 4, yy - 12, 1, 1)
  q.r('#d4a23a', x + 5, yy - 13 - kw / 2, 1, 1 + kw)
  // toolbelt with ruler
  q.r('#7b4a22', x - 4, yy - 7, 8, 1)
  q.r('#e5b84a', x - 1, yy - 7, 1, 1)
  q.r('#f7d54a', x + 2, yy - 6, 1, 3)
  // arms: hammer arm up and down at the bench
  const swing = walking ? 0 : hammer
  q.r(body, x - 6, yy - 15, 2, 6)
  q.r('#e8fff6', x - 7, yy - 9, 2, 2)
  const hy = yy - 16 + Math.round(swing * 4)
  q.r(body, x + 4, yy - 15, 2, 3)
  q.r(body, x + 5, hy, 2, 4)
  q.r('#e8fff6', x + 5, hy - 1, 2, 2)
  q.r('#8a5a2b', x + 7, hy - 1, 3, 1)
  q.r('#9aa3ad', x + 9, hy - 3, 2, 4)
  // head
  q.r(body, x - 5, yy - 25, 10, 9)
  q.r('#1d2a33', x - 3, yy - 22, 2, 2)
  q.r('#1d2a33', x + 1, yy - 22, 2, 2)
  q.r('#fff', x - 3, yy - 22, 1, 1)
  q.r('#fff', x + 1, yy - 22, 1, 1)
  q.r('#1d2a33', x - 2, yy - 19, 4, 1)
  q.r('#fff', x - 1, yy - 19, 1, 1)
  q.r('#ffb3c6', x - 4, yy - 20, 1, 1)
  q.r('#ffb3c6', x + 3, yy - 20, 1, 1)
  // flat blue carpenter cap
  q.r('#4a6fa5', x - 5, yy - 27, 10, 2)
  q.r('#355384', x + 2, yy - 25, 5, 1)
  // pencil: behind his ear, or tipped like a hat brim when tapped
  if (tip > 0) {
    const ty = yy - 30 - Math.round(tip * 2)
    q.r('#f7c33a', x - 7, ty, 5, 1)
    q.r('#e88aa8', x - 8, ty, 1, 1)
    q.r('#333', x - 2, ty, 1, 1)
    q.r('#e8fff6', x - 7, ty + 1, 2, 2)
  } else {
    q.r('#f7c33a', x - 7, yy - 24, 1, 4)
    q.r('#e88aa8', x - 7, yy - 25, 1, 1)
    q.r('#f1d4a6', x - 7, yy - 20, 1, 1)
  }
}

// ---------------------------------------------------------------- painters (cached)

/** Door Codes chapter door colours, 1 to 5. */
const CHAPTER_DOORS = [['#6b4426', '#4d2f19'], ['#5f6b66', '#3b4541'], ['#8a6f45', '#5c4628'], ['#8b939e', '#5d646e'], ['#4b3d78', '#2a2148']]

function doorX(w: number, i: number) {
  const gap = w / DOORS_PER_FLOOR
  return Math.round(gap * i + gap / 2 - 7)
}

export function paintDoorHall(c: Ctx, w: number, h: number, _look: Look) {
  const q = flat(c)
  const floors = h / 32
  for (let fl = 0; fl < floors; fl++) {
    const y0 = fl * 32
    q.r('#2e2433', 0, y0, w, 32)
    for (let sx = 0; sx < w; sx += 6) q.r('#352a3c', sx, y0 + 3, 3, 26)
    q.r('#1a110a', 0, y0, w, 3)
    q.r('#4a3221', 0, y0 + 28, w, 4)
    for (let i = 0; i < DOORS_PER_FLOOR; i++) {
      const x = doorX(w, i)
      const [hi, lo] = CHAPTER_DOORS[(fl * DOORS_PER_FLOOR + i) % 5]
      q.r('#1a110a', x - 1, y0 + 5, 16, 23)
      q.r(hi, x, y0 + 6, 14, 11)
      q.r(lo, x, y0 + 17, 14, 11)
      q.r('#2e1a0c', x + 2, y0 + 8, 10, 7)
      q.r(hi, x + 3, y0 + 9, 8, 5)
      q.r('#2e1a0c', x + 2, y0 + 19, 10, 6)
      q.r(lo, x + 3, y0 + 20, 8, 4)
      q.r('#d8b45a', x + 11, y0 + 17, 2, 2)
      // keypad
      q.r('#1b1b22', x + 15, y0 + 13, 3, 5)
      q.r('#3a3a48', x + 16, y0 + 14, 1, 1)
      q.r('#3a3a48', x + 16, y0 + 16, 1, 1)
    }
  }
}

export function paintKaraoke(c: Ctx, w: number, h: number, _look: Look) {
  const q = flat(c)
  q.r('#1e1838', 0, 0, w, h)
  for (let sx = 2; sx < w; sx += 10) q.r('#251e46', sx, 3, 1, 25)
  q.r('#110d22', 0, 0, w, 3)
  q.r('#3b2a5c', 0, h - 4, w, 4)
  // stage on the right with a curtain
  const sx = w - 44
  q.r('#5c3a1e', sx, h - 8, 42, 4)
  q.r('#7a4f29', sx, h - 9, 42, 1)
  q.r('#a61e4d', sx, 3, 4, h - 12)
  q.r('#a61e4d', w - 6, 3, 4, h - 12)
  q.r('#c2255c', sx, 3, 42, 3)
  // lyrics screen
  q.r('#0b0a14', 8, 6, 34, 14)
  q.r('#2b2f77', 9, 7, 32, 12)
  // little tables
  for (const tx of [10, 36, 62]) {
    q.r('#7a4f29', tx, h - 12, 10, 2)
    q.r('#5c3a1e', tx + 4, h - 10, 2, 6)
  }
}

export function paintMortimerShop(c: Ctx, w: number, h: number, _look: Look) {
  const q = flat(c)
  q.r('#2a1d1a', 0, 0, w, h)
  for (let sx = 0; sx < w; sx += 8) q.r('rgba(232,182,74,.07)', sx, 3, 4, 25)
  q.r('#160d0a', 0, 0, w, 3)
  q.r('#3a2618', 0, h - 4, w, 4)
  // shelves of stock behind the counter
  for (const [y, row] of [[10, 0], [17, 1]] as const) {
    q.r('#6a4226', 6, y, 56, 1)
    for (let i = 0; i < 6; i++) stockIcon(q, (i + row * 2) % 4, 8 + i * 9, y)
  }
  // the counter
  q.r('#6a4226', 30, h - 13, 40, 9)
  q.r('#8a5a36', 30, h - 13, 40, 2)
  q.r('#2a1a10', 34, h - 5, 4, 1)
  // SHOP sign on a pole
  q.r('#3b2414', w - 18, 6, 1, 20)
  q.r('#e8b64a', w - 26, 6, 16, 7)
}

export function paintLightsOutHall(c: Ctx, w: number, h: number, _look: Look) {
  const q = flat(c)
  const floors = h / 32
  for (let fl = 0; fl < floors; fl++) {
    const y0 = fl * 32
    q.r('#151019', 0, y0, w, 32)
    for (let sx = 0; sx < w; sx += 12) q.r('rgba(120,90,160,.12)', sx + 4, y0 + 8, 2, 2)
    q.r('#08060a', 0, y0, w, 3)
    q.r('#1d1424', 0, y0 + 28, w, 4)
    for (let i = 0; i < 3; i++) {
      const dx = 18 + i * Math.floor((w - 36) / 2) - 6
      q.r('#2a1a10', dx, y0 + 8, 12, 20)
      q.r('#3a2618', dx + 1, y0 + 9, 10, 1)
      q.r('#5a4426', dx + 9, y0 + 18, 1, 1)
    }
  }
}

export function paintLampHall(c: Ctx, w: number, h: number, _look: Look) {
  const q = flat(c)
  q.r('#41302a', 0, 0, w, 20)
  q.r('#2a1e1a', 0, 20, w, 8)
  for (let sx = 3; sx < w; sx += 9) q.r('rgba(201,162,74,.07)', sx, 3, 2, 17)
  q.r('#1d1618', 0, 0, w, 3)
  q.r('#5a3d27', 0, 18, w, 1)
  q.r('#1a110c', 0, 26, w, 2)
  q.r('#33251c', 0, h - 4, w, 4)
  for (let sx = 6; sx < w; sx += 12) q.r('rgba(0,0,0,.4)', sx, h - 4, 1, 4)
  // end door with a brass plate
  q.r('#3b2619', w - 16, 7, 12, 21)
  q.r('#c9a24a', w - 13, 10, 6, 3)
  q.r('#b08a3a', w - 7, 18, 1, 1)
}

export function paintMathWorkshop(c: Ctx, w: number, h: number, _look: Look) {
  const q = flat(c)
  q.r('#8a6a48', 0, 0, w, h)
  for (let sx = 0; sx < w; sx += 10) q.r('#7a5c3c', sx, 3, 1, 25)
  q.r('#5a4228', 0, 0, w, 3)
  q.r('#c9a46a', 0, h - 4, w, 4)
  // sawdust
  for (let i = 0; i < 14; i++) q.r('#e9cf9a', (i * 37) % w, h - 5 + (i % 2), 2, 1)
  // rulers and a protractor on the wall
  q.r('#f7d54a', 8, 7, 22, 2)
  for (let i = 0; i < 11; i++) q.r('#5a4310', 8 + i * 2, 7, 1, 1)
  q.r('#f7d54a', 34, 6, 2, 14)
  for (let i = 0; i < 7; i++) q.r('#5a4310', 34, 6 + i * 2, 1, 1)
  q.r('rgba(140,200,255,.75)', 40, 10, 12, 6)
  q.r('rgba(140,200,255,.75)', 42, 8, 8, 2)
  q.r('#2b5d8a', 40, 15, 12, 1)
  q.r('#2b5d8a', 45, 10, 1, 5)
  // scaffold beams at the back
  q.r('#a9895f', w - 34, 4, 2, 24)
  q.r('#a9895f', w - 10, 4, 2, 24)
  q.r('#6b5236', w - 34, 12, 26, 2)
  // workbench
  q.r('#6b5236', 66, h - 13, 46, 3)
  q.r('#5a4228', 68, h - 10, 3, 6)
  q.r('#5a4228', 107, h - 10, 3, 6)
  q.r('#c9a46a', 76, h - 15, 18, 2)
}

// ---------------------------------------------------------------- live layers

function visitors(f: Facility, max: number) {
  return Math.min(f.inside, max)
}

function drawDoorHall(q: Pen, g: Game, f: Facility, sw: number, now: number, person: DrawPerson) {
  // the door counter over the top floor
  const n = doorCount(f)
  q.r('#7d5f1f', sw / 2 - 17, 0, 34, 6)
  q.r('#c9a24a', sw / 2 - 16, 0, 32, 5)
  text(q, `DOOR ${String(n % 1000).padStart(3, '0')}`, sw / 2, 2.6, 4.5, '#3a2508')
  const pk = doorPeek(g, f)
  const floors = f.height
  // visitors walk the hall left to right, one lane per floor
  const k = visitors(f, 10)
  for (let i = 0; i < k; i++) {
    const fl = i % floors
    const yb = (floors - 1 - fl) * 32 + 28
    const x = ((now / 60 + i * 47 + f.id * 13) % (sw + 8)) - 4
    person(q.X(x), q.Y(yb), (f.id + i) % 8, Math.floor(now / 200 + i) % 2)
  }
  if (!pk) return
  const fl = Math.floor(pk.door / DOORS_PER_FLOOR)
  const col = pk.door % DOORS_PER_FLOOR
  const x = doorX(sw, col)
  const y0 = (floors - 1 - fl) * 32
  // the door swings open on a dark doorway
  const open = Math.min(1, pk.t / 1.2, (6 - pk.t) / 1.2)
  q.r('#07050a', x, y0 + 6, 14, 22)
  const cx = x + 7
  const yb = y0 + 28
  const who: DoorMonster = pk.who
  const blink = Math.floor(now / 1700) % 6 === 0
  if (who === 'Grumble') grumble(q, cx, yb, true)
  else if (who === 'Hoot') hoot(q, cx, yb - 4, blink)
  else if (who === 'Fluff') {
    for (let i = 0; i < 3; i++) fluff(q, x + 3 + i * 4, yb, Math.abs(Math.sin(now / 180 + i * 1.3)) * 3)
  } else if (who === 'Squirm') squirm(q, cx, yb, open, now / 150)
  else clonk(q, cx, yb, Math.floor(now / 500) % 2 === 0)
  // the door itself, swung back toward the wall
  const dw = Math.max(2, Math.round(14 * (1 - open * 0.8)))
  const [hi, lo] = CHAPTER_DOORS[pk.door % 5]
  q.r(hi, x, y0 + 6, dw, 11)
  q.r(lo, x, y0 + 17, dw, 11)
}

function drawKaraoke(q: Pen, g: Game, f: Facility, sw: number, sh: number, now: number, person: DrawPerson) {
  // lyric bars scroll on the screen
  const line = Math.floor(now / 700) % 3
  for (let i = 0; i < 3; i++) q.r(i === line ? '#fde68a' : '#6c72c9', 12, 9 + i * 3, 14 + ((i * 7) % 12), 1)
  q.r('#fde68a', 12 + ((now / 60) % 22), 8 + line * 3, 1, 1)
  // neon sign
  const on = Math.floor(now / 900) % 8 !== 0
  text(q, 'KARAOKE', 62, 8, 5, on ? '#ff8fe1' : '#5a3a6a')
  const stageX = sw - 22
  const spot = 0.25 + 0.08 * Math.sin(now / 200)
  q.c.globalAlpha = spot
  q.r('#fff3bf', stageX - 10, 12, 20, sh - 20)
  q.c.globalAlpha = 1
  const inside = visitors(f, 6)
  if (croonerSinging(g)) {
    crooner(q, stageX, sh - 9, now, Math.sin(now / 300) * 1.4)
  } else if (inside > 0) {
    // a visitor takes a turn at the mic stand
    q.r('#16161c', stageX + 4, sh - 20, 1, 11)
    q.r('#c9d1dc', stageX + 3, sh - 21, 3, 2)
    const turn = Math.floor(g.time / 4)
    person(q.X(stageX), q.Y(sh - 9), (f.id + turn) % 8, Math.floor(now / 250) % 2)
    notes(q, stageX + 2, sh - 20, now, 2)
  } else {
    q.r('#16161c', stageX + 4, sh - 20, 1, 11)
    q.r('#c9d1dc', stageX + 3, sh - 21, 3, 2)
  }
  // the crowd at the little tables
  for (let i = 0; i < Math.min(inside, 5); i++) {
    const x = 8 + i * 13
    const bob = Math.sin(now / 250 + i) > 0.5 ? 1 : 0
    person(q.X(x), q.Y(sh - 4 - bob), (f.id + i + 3) % 8, 0)
  }
}

function drawMortimerShop(q: Pen, f: Facility, sw: number, sh: number, now: number, person: DrawPerson) {
  text(q, 'SHOP', sw - 18, 9.5, 5, '#3b2414')
  mortimer(q, 48, sh - 4, now)
  // the counter front again, so he stands behind it
  q.r('#6a4226', 30, sh - 13, 40, 9)
  q.r('#8a5a36', 30, sh - 13, 40, 2)
  q.r('#2a1a10', 34, sh - 5, 4, 1)
  // shoppers wait at the counter
  for (let i = 0; i < visitors(f, 3); i++) person(q.X(76 + i * 6), q.Y(sh - 4), (f.id + i) % 8, 0)
}

function drawLightsOutHall(q: Pen, g: Game, f: Facility, sw: number, now: number, person: DrawPerson) {
  const floors = f.height
  const k = visitors(f, 8)
  // flashlight beams first, then the people holding them
  q.c.save()
  q.c.globalCompositeOperation = 'lighter'
  for (let i = 0; i < k; i++) {
    const fl = i % floors
    const yb = (floors - 1 - fl) * 32 + 28
    const x = 10 + ((i * 53 + f.id * 7 + now / 90) % (sw - 20))
    const dir = Math.sin(now / 900 + i * 2) > 0 ? 1 : -1
    const tilt = Math.sin(now / 400 + i) * 4
    q.c.fillStyle = 'rgba(255,205,120,0.22)'
    q.c.beginPath()
    q.c.moveTo(q.X(x + dir * 2), q.Y(yb - 6))
    q.c.lineTo(q.X(x + dir * 24), q.Y(yb - 16 + tilt))
    q.c.lineTo(q.X(x + dir * 24), q.Y(yb + tilt))
    q.c.closePath()
    q.c.fill()
  }
  q.c.restore()
  for (let i = 0; i < k; i++) {
    const fl = i % floors
    const yb = (floors - 1 - fl) * 32 + 28
    const x = 10 + ((i * 53 + f.id * 7 + now / 90) % (sw - 20))
    person(q.X(x), q.Y(yb), (f.id + i) % 8, Math.floor(now / 220 + i) % 2)
  }
  // Giggles peeks from one of six spots: by a door or up on the wall
  const gs = gigglesSpot(g, f)
  if (gs.peeking) {
    const fl = gs.spot % floors
    const y0 = (floors - 1 - fl) * 32
    const sx = 14 + ((gs.spot * 37) % (sw - 28))
    const high = gs.spot % 3 === 0
    giggles(q, sx, y0 + (high ? 16 : 27), now, 0.75 + 0.15 * Math.sin(now / 300))
  }
}

function drawLampHall(q: Pen, g: Game, f: Facility, sw: number, sh: number, now: number, person: DrawPerson) {
  const fl = lampFlicker(g, f)
  const hiding = fl != null
  const light = hiding ? (Math.floor(now / 70) % 3 === 0 ? 0.6 : 0.05) : 0.8 + 0.05 * Math.sin(now / 500)
  const k = visitors(f, 5)
  closet(q, 6, 6, hiding && k > 0)
  closet(q, 52, 6, hiding && k > 2)
  // three pendulum lamps; they swing harder when someone walks under
  for (let i = 0; i < 3; i++) {
    const lx = 30 + i * 36
    const amp = (k > 0 ? 0.35 : 0.12) + (hiding ? 0.3 : 0)
    const a = Math.sin(now / 520 + i * 1.7) * amp
    const ex = lx + Math.sin(a) * 9
    const ey = 3 + Math.cos(a) * 9
    q.c.strokeStyle = '#16100c'
    q.c.lineWidth = Math.max(1, q.z * 0.8)
    q.c.beginPath()
    q.c.moveTo(q.X(lx), q.Y(3))
    q.c.lineTo(q.X(ex), q.Y(ey))
    q.c.stroke()
    q.c.globalAlpha = 0.28 * light
    q.r('#ffcf7a', ex - 9, ey + 2, 18, sh - ey - 6)
    q.c.globalAlpha = 1
    q.r('#3a2e22', ex - 3, ey, 6, 2)
    q.r('#3a2e22', ex - 4, ey + 2, 8, 1)
    q.r(light > 0.3 ? '#ffcf7a' : '#5a4a30', ex - 1, ey + 3, 2, 1)
  }
  if (hiding) {
    // the hall goes dark and the rusher charges through
    q.c.globalAlpha = 1 - light
    q.r('#050304', 0, 3, sw, sh - 7)
    q.c.globalAlpha = 1
    if (fl! >= 2 && fl! < 6) rusher(q, ((fl! - 2) / 4) * (sw + 30) - 15, sh - 4, now)
    return
  }
  for (let i = 0; i < k; i++) {
    const x = 20 + ((i * 41 + f.id * 11 + now / 70) % (sw - 40))
    person(q.X(x), q.Y(sh - 4), (f.id + i) % 8, Math.floor(now / 200 + i) % 2)
  }
}

function drawMathWorkshop(q: Pen, g: Game, f: Facility, sh: number, now: number, person: DrawPerson) {
  const walk = makerWalk(g, f)
  const tipAge = now - pencilTippedAt(f)
  const tip = tipAge >= 0 && tipAge < 1200 ? Math.sin((tipAge / 1200) * Math.PI) : 0
  for (let i = 0; i < visitors(f, 4); i++) person(q.X(12 + i * 12), q.Y(sh - 4), (f.id + i) % 8, 0)
  if (walk) {
    // out the door to the bare tile, paint it with a sawdust burst, then home again
    const home = 88
    const there = (walk.x - f.x) * 8 + 4
    const t = walk.t
    const x = t < 6 ? home + (there - home) * (t / 6) : t < 12 ? there : there + (home - there) * Math.min(1, (t - 12) / 6)
    maker(q, x, sh - 4, now, 0, tip, t < 6 || t >= 12)
    if (t >= 6 && t < 12) {
      const b = (t - 6) / 6
      for (let i = 0; i < 10; i++) {
        const a = i * 0.63
        q.c.globalAlpha = 1 - b
        q.r(i % 2 ? '#e9cf9a' : '#ffd43b', there + Math.cos(a) * b * 14, sh - 8 - Math.abs(Math.sin(a)) * b * 12, 2, 2)
      }
      q.c.globalAlpha = 1
    }
    return
  }
  // hammering at the bench: sparks and sawdust on every hit
  const open = f.inside > 0 || (minuteOfDay(g.time) >= 9 * 60 && minuteOfDay(g.time) < 18 * 60)
  const beat = open ? (Math.sin(now / 90) + 1) / 2 : 0
  maker(q, 88, sh - 4, now, beat, tip, false)
  if (open && beat > 0.85) {
    for (let i = 0; i < 4; i++) {
      const s = crossHash(Math.floor(now / 180), i)
      q.r(i % 2 ? '#ffd43b' : '#e9cf9a', 96 + (s % 9), sh - 18 - ((s >> 4) % 6), 1, 1)
    }
  }
}

/** Live layers for a crossover room, over its cached painter. */
export function drawCrossover(
  c: Ctx, g: Game, f: Facility, p: { x: number; y: number }, w: number, h: number, z: number, now: number, person: DrawPerson,
) {
  const q = pen(c, p, z)
  const sw = w / z
  const sh = h / z
  switch (f.kind) {
    case 'doorHall': return drawDoorHall(q, g, f, sw, now, person)
    case 'karaoke': return drawKaraoke(q, g, f, sw, sh, now, person)
    case 'mortimerShop': return drawMortimerShop(q, f, sw, sh, now, person)
    case 'lightsOutHall': return drawLightsOutHall(q, g, f, sw, now, person)
    case 'lampHall': return drawLampHall(q, g, f, sw, sh, now, person)
    case 'mathWorkshop': return drawMathWorkshop(q, g, f, sh, now, person)
  }
}
