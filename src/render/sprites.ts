// Procedural pixel-art sprites for facilities, cached on offscreen canvases.
import type { FacilityKind } from '../game/defs'

export const T = 8 // px per tile
export const FH = 32 // px per floor

type Ctx = CanvasRenderingContext2D
const cache = new Map<string, HTMLCanvasElement>()

export type Look = 'day' | 'night' | 'vacant' | 'dirty'

function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return [c, ctx]
}

const r = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  let R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255
  if (amt < 0) { R *= 1 + amt; G *= 1 + amt; B *= 1 + amt }
  else { R += (255 - R) * amt; G += (255 - G) * amt; B += (255 - B) * amt }
  return `rgb(${R | 0},${G | 0},${B | 0})`
}

// Shell: walls, ceiling, floor slab. Returns interior bounds.
function shell(c: Ctx, w: number, h: number, wall: string, floor: string, dark: boolean) {
  r(c, dark ? shade(wall, -0.62) : wall, 0, 0, w, h)
  // wainscot
  r(c, dark ? shade(wall, -0.7) : shade(wall, -0.1), 0, h - 10, w, 7)
  r(c, '#3a3a46', 0, 0, w, 2) // ceiling slab
  r(c, dark ? shade(floor, -0.5) : floor, 0, h - 3, w, 3) // floor
  r(c, 'rgba(0,0,0,0.35)', 0, h - 1, w, 1)
  r(c, 'rgba(0,0,0,0.5)', 0, 0, 1, h)
  r(c, 'rgba(0,0,0,0.5)', w - 1, 0, 1, h)
}

function lamp(c: Ctx, x: number, y: number, on: boolean) {
  r(c, '#555', x, 2, 1, y - 2)
  r(c, on ? '#ffe9a8' : '#776', x - 2, y, 5, 2)
  if (on) {
    c.fillStyle = 'rgba(255,230,150,0.18)'
    c.beginPath()
    c.moveTo(x - 2, y + 2); c.lineTo(x + 3, y + 2); c.lineTo(x + 9, y + 24); c.lineTo(x - 8, y + 24)
    c.fill()
  }
}

function plant(c: Ctx, x: number, base: number) {
  r(c, '#8b4a2b', x, base - 4, 4, 4)
  r(c, '#2f9e44', x - 1, base - 9, 6, 5)
  r(c, '#51cf66', x, base - 11, 4, 3)
}

let pendingSigns: [Ctx, number, string, string, string][] = []

// Signs are queued and drawn after the room's furniture so they always sit on top.
function sign(c: Ctx, w: number, text: string, bg: string, fg = '#fff') {
  pendingSigns.push([c, w, text, bg, fg])
}

function drawSign(c: Ctx, w: number, text: string, bg: string, fg: string) {
  c.font = 'bold 7px monospace'
  const tw = Math.ceil(c.measureText(text).width) + 4
  const x = Math.floor((w - tw) / 2)
  r(c, '#222', x - 1, 6, tw + 2, 11)
  r(c, bg, x, 7, tw, 9)
  c.fillStyle = fg
  c.textBaseline = 'middle'
  c.fillText(text, x + 2, 12)
}

function window(c: Ctx, x: number, y: number, w: number, h: number, dark: boolean) {
  r(c, '#2b2f3a', x - 1, y - 1, w + 2, h + 2)
  const g = c.createLinearGradient(0, y, 0, y + h)
  if (dark) { g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#1b2350') }
  else { g.addColorStop(0, '#9ad7ff'); g.addColorStop(1, '#d8f1ff') }
  c.fillStyle = g
  c.fillRect(x, y, w, h)
  r(c, 'rgba(255,255,255,0.35)', x + 1, y + 1, 1, h - 2)
}

const OFFICE_WALLS = ['#d7e3ec', '#e6e1d3', '#dfe8d9', '#e4dbe9']
const CONDO_WALLS = ['#f4d9b8', '#cfe6d2', '#f3c9cf', '#d9d4f2']

type Painter = (c: Ctx, w: number, h: number, look: Look, variant: number) => void

const painters: Partial<Record<FacilityKind, Painter>> = {
  office(c, w, h, look, v) {
    const dark = look === 'night'
    const vacant = look === 'vacant'
    shell(c, w, h, vacant ? '#9aa1a8' : OFFICE_WALLS[v % 4], '#6d7a86', dark)
    window(c, 5, 6, 14, 10, dark)
    window(c, w - 20, 6, 14, 10, dark)
    if (vacant) { sign(c, w, 'FOR RENT', '#e03131'); return }
    lamp(c, w / 2, 5, !dark)
    // desks
    for (const dx of [8, 30, 52]) {
      if (dx + 14 > w) continue
      r(c, '#8d6e4f', dx, h - 11, 13, 2)
      r(c, '#5c4632', dx + 1, h - 9, 1, 6)
      r(c, '#5c4632', dx + 11, h - 9, 1, 6)
      r(c, '#222', dx + 4, h - 17, 6, 5) // monitor
      r(c, dark ? '#1a2a1a' : '#5cf', dx + 5, h - 16, 4, 3)
      r(c, '#222', dx + 6, h - 12, 2, 1)
    }
    r(c, '#6b4f3a', w - 8, h - 22, 6, 19) // bookshelf
    r(c, '#e8590c', w - 7, h - 20, 2, 4); r(c, '#1c7ed6', w - 5, h - 20, 2, 4); r(c, '#37b24d', w - 7, h - 14, 4, 4)
  },
  condo(c, w, h, look, v) {
    const dark = look === 'night'
    const vacant = look === 'vacant'
    shell(c, w, h, vacant ? '#a39a92' : CONDO_WALLS[v % 4], '#a0703f', dark)
    window(c, 8, 6, 16, 11, dark)
    window(c, w - 26, 6, 16, 11, dark)
    if (vacant) { sign(c, w, 'FOR SALE', '#1971c2'); return }
    // sofa + tv
    r(c, '#c92a2a', 30, h - 10, 22, 6); r(c, '#a61e4d', 30, h - 14, 22, 4); r(c, '#a61e4d', 29, h - 12, 2, 8); r(c, '#a61e4d', 51, h - 12, 2, 8)
    r(c, '#222', 60, h - 15, 12, 8); r(c, dark ? '#334' : '#7af', 61, h - 14, 10, 6); r(c, '#555', 64, h - 7, 4, 4)
    // kitchen
    r(c, '#ced4da', 80, h - 12, 22, 9); r(c, '#868e96', 80, h - 13, 22, 1); r(c, '#fff', 84, h - 23, 8, 8)
    // bed
    r(c, '#5c3d2e', 106, h - 9, 18, 6); r(c, '#fff', 106, h - 12, 18, 3); r(c, '#74c0fc', 110, h - 12, 14, 3); r(c, '#fff', 106, h - 15, 5, 3)
    lamp(c, 40, 5, !dark)
    plant(c, 3, h - 3)
  },
  hotelSingle(c, w, h, look) { hotelRoom(c, w, h, look, 1, '#e7d6c3') },
  hotelTwin(c, w, h, look) { hotelRoom(c, w, h, look, 2, '#d3e0ea') },
  hotelSuite(c, w, h, look) {
    hotelRoom(c, w, h, look, 0, '#efe0a8')
    const dark = look === 'night'
    // king bed, chandelier, gold trim
    r(c, '#d4a017', 0, 2, w, 1)
    r(c, '#7d4f14', 30, h - 10, 26, 7); r(c, look === 'dirty' ? '#d8cfc4' : '#fff', 30, h - 14, 26, 4); r(c, '#9c36b5', 36, h - 14, 20, 4)
    r(c, '#7d4f14', 28, h - 20, 3, 17)
    r(c, '#f1c40f', 44, 3, 1, 3); r(c, dark ? '#a98' : '#ffd43b', 40, 6, 9, 2); r(c, '#fff3bf', 41, 8, 1, 1); r(c, '#fff3bf', 47, 8, 1, 1)
    r(c, '#5f3dc4', 62, h - 9, 12, 6); r(c, '#7048e8', 62, h - 13, 12, 4)
    if (look === 'dirty') mess(c, 34, h)
  },
  housekeeping(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#cfe3e8', '#7c8c91', dark)
    sign(c, w, 'HOUSEKEEPING', '#0b7285')
    for (let x = 6; x < w - 16; x += 26) {
      r(c, '#adb5bd', x, h - 14, 14, 11); r(c, '#495057', x + 3, h - 11, 8, 6); r(c, dark ? '#334' : '#99e9f2', x + 4, h - 10, 6, 4)
    }
    r(c, '#868e96', w - 18, h - 12, 12, 7); r(c, '#fff', w - 17, h - 15, 10, 3); r(c, '#ffc9c9', w - 15, h - 17, 6, 2)
    r(c, '#222', w - 17, h - 5, 2, 2); r(c, '#222', w - 9, h - 5, 2, 2)
  },
  fastFood(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#ffe066', '#e03131', dark)
    // stripes
    for (let x = 0; x < w; x += 8) r(c, dark ? '#5a1a1a' : '#fa5252', x, 2, 4, 3)
    sign(c, w, 'BURGERS', '#e03131', '#ffe066')
    // counter
    r(c, '#c92a2a', 8, h - 13, 46, 10); r(c, '#fff', 8, h - 14, 46, 1)
    r(c, '#fff', 12, h - 26, 32, 8); r(c, '#2b8a3e', 14, h - 24, 6, 4); r(c, '#f08c00', 22, h - 24, 6, 4); r(c, '#e03131', 30, h - 24, 6, 4)
    // tables
    for (let x = 64; x < w - 12; x += 22) {
      r(c, '#fff', x, h - 11, 12, 2); r(c, '#868e96', x + 5, h - 9, 2, 6)
      r(c, '#e03131', x - 4, h - 7, 3, 4); r(c, '#e03131', x + 13, h - 7, 3, 4)
    }
  },
  restaurant(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#7a1f2b', '#5c3a21', false)
    if (dark) r(c, 'rgba(0,0,10,0.55)', 0, 0, w, h)
    sign(c, w, 'RISTORANTE', '#2b8a3e', '#fff')
    for (let x = 10; x < w - 16; x += 30) {
      r(c, '#f8f9fa', x, h - 12, 16, 3); r(c, '#dee2e6', x + 1, h - 9, 14, 3); r(c, '#5c3a21', x + 7, h - 6, 2, 3)
      r(c, '#ffd43b', x + 7, h - 15, 1, 2); r(c, '#fff', x + 7, h - 16, 1, 1)
      r(c, '#8b5e3c', x - 4, h - 10, 3, 7); r(c, '#8b5e3c', x + 17, h - 10, 3, 7)
      if (!dark) { r(c, '#f1c40f', x + 8, 2, 1, 4); r(c, '#ffe8a3', x + 5, 6, 7, 2) }
    }
  },
  shop(c, w, h, look, v) {
    const dark = look === 'night'
    const walls = ['#fff0f6', '#e7f5ff', '#fff9db', '#ebfbee']
    shell(c, w, h, walls[v % 4], '#ced4da', dark)
    sign(c, w, ['BOUTIQUE', 'TOYS', 'BOOKS', 'GIFTS'][v % 4], ['#d6336c', '#1c7ed6', '#f08c00', '#37b24d'][v % 4])
    const cols = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d']
    for (let x = 4; x < w - 10; x += 22) {
      r(c, '#8d6e4f', x, h - 22, 16, 19)
      for (let s = 0; s < 3; s++) {
        r(c, '#5c4632', x, h - 21 + s * 6, 16, 1)
        for (let i = 0; i < 4; i++) r(c, cols[(x + s * 3 + i) % cols.length], x + 1 + i * 4, h - 20 + s * 6, 3, 4)
      }
    }
  },
  cinema(c, w, h, look) {
    const dark = look === 'night'
    r(c, '#1b1033', 0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2); r(c, '#2a1f3d', 0, h - 3, w, 3)
    // screen
    const sx = 30, sw = w - 60
    r(c, '#111', sx - 2, 8, sw + 4, 30)
    const g = c.createLinearGradient(sx, 0, sx + sw, 0)
    g.addColorStop(0, '#4dabf7'); g.addColorStop(0.5, '#ffd43b'); g.addColorStop(1, '#f06595')
    c.fillStyle = dark ? '#223' : g
    c.fillRect(sx, 10, sw, 26)
    if (!dark) { r(c, '#fff', sx + sw / 2 - 10, 18, 20, 10); r(c, '#ff6b6b', sx + sw / 2 - 6, 20, 12, 6) }
    // marquee lights
    for (let x = 4; x < w; x += 6) r(c, (x / 6) % 2 ? '#ffd43b' : '#fff3bf', x, 3, 2, 2)
    // seats
    for (let row = 0; row < 3; row++) for (let x = 14 + row * 3; x < w - 14; x += 7) r(c, '#c92a2a', x, h - 8 - row * 7, 5, 4)
    r(c, '#fff', 4, 42, 18, 12); c.fillStyle = '#c92a2a'; c.font = 'bold 6px monospace'; c.fillText('NOW', 6, 50)
  },
  partyHall(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#5f3dc4', '#212529', false)
    if (dark) r(c, 'rgba(0,0,20,0.5)', 0, 0, w, h)
    // checker dance floor
    for (let x = 30; x < w - 30; x += 6) for (let y = h - 9; y < h - 3; y += 3) r(c, ((x + y) / 3) % 2 ? '#f783ac' : '#74c0fc', x, y, 6, 3)
    // disco ball
    r(c, '#ddd', w / 2, 2, 1, 10); r(c, '#ced4da', w / 2 - 4, 12, 9, 9); r(c, '#fff', w / 2 - 2, 14, 2, 2)
    // balloons
    const bc = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac']
    for (let i = 0; i < 10; i++) { const x = 8 + i * (w - 16) / 10; r(c, bc[i % 5], x, 16 + (i % 3) * 4, 5, 6); r(c, '#ddd', x + 2, 22 + (i % 3) * 4, 1, 8) }
    sign(c, w, 'PARTY!', '#f783ac', '#fff')
    // tables
    for (let x = 6; x < w; x += w - 22) { r(c, '#fff', x, h - 12, 14, 2); r(c, '#aaa', x + 6, h - 10, 2, 7) }
  },
  security(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#a5b4c7', '#4c566a', dark)
    sign(c, w, 'SECURITY', '#1c3d6e')
    for (let i = 0; i < 4; i++) { r(c, '#222', 10 + i * 12, h - 22, 10, 8); r(c, '#2f9e44', 11 + i * 12, h - 21, 8, 6); r(c, '#8ce99a', 12 + i * 12, h - 19, 3, 1) }
    r(c, '#495057', 8, h - 12, 50, 9)
    r(c, '#ffd43b', w - 18, h - 22, 10, 10); r(c, '#1c3d6e', w - 15, h - 19, 4, 4)
    r(c, '#212529', w - 40, h - 20, 3, 17); r(c, '#212529', w - 34, h - 20, 3, 17)
  },
  medical(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#f1f3f5', '#adb5bd', dark)
    r(c, '#e03131', 10, 7, 12, 4); r(c, '#e03131', 14, 3, 4, 12)
    sign(c, w, 'CLINIC', '#e03131')
    for (let x = 30; x < w - 20; x += 36) {
      r(c, '#dee2e6', x, h - 10, 20, 4); r(c, '#fff', x, h - 13, 20, 3); r(c, '#a5d8ff', x + 14, h - 13, 6, 3); r(c, '#868e96', x, h - 6, 1, 3); r(c, '#868e96', x + 19, h - 6, 1, 3)
      r(c, '#99e9f2', x + 22, 4, 1, h - 8); r(c, 'rgba(153,233,242,0.5)', x + 23, 4, 6, h - 10)
    }
  },
  recycling(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#d3f9d8', '#5c7c5f', dark)
    sign(c, w, 'RECYCLING', '#2b8a3e')
    const bc = ['#1c7ed6', '#2f9e44', '#f59f00', '#868e96']
    for (let i = 0; i < 6; i++) { const x = 10 + i * 30; if (x > w - 20) break; r(c, bc[i % 4], x, h - 18, 18, 15); r(c, shade(bc[i % 4], -0.3), x - 1, h - 20, 20, 3) }
    r(c, '#495057', 0, 30, w, 3)
    for (let x = 0; x < w; x += 10) r(c, '#adb5bd', x, 31, 4, 1)
  },
  parking(c, w, h) {
    r(c, '#3d3d45', 0, 0, w, h)
    r(c, '#2a2a30', 0, 0, w, 2); r(c, '#55555f', 0, h - 3, w, 3)
    r(c, '#ffd43b', 2, h - 3, 1, 3); r(c, '#ffd43b', w - 3, h - 3, 1, 3)
    r(c, '#868e96', 4, 6, 3, h - 9)
  },
  metro(c, w, h, look) {
    const dark = look === 'night'
    r(c, '#e9ecef', 0, 0, w, h)
    for (let x = 0; x < w; x += 6) for (let y = 4; y < h - 30; y += 6) r(c, (x + y) % 12 ? '#dee2e6' : '#f8f9fa', x, y, 5, 5)
    r(c, '#3a3a46', 0, 0, w, 2)
    sign(c, w, 'METRO', '#1971c2')
    r(c, '#495057', 0, h - 26, w, 6) // platform edge
    r(c, '#ffd43b', 0, h - 26, w, 1)
    r(c, '#212529', 0, h - 20, w, 20)
    r(c, '#868e96', 0, h - 6, w, 1); r(c, '#868e96', 0, h - 3, w, 1)
    // train
    r(c, '#1971c2', 16, h - 22, w - 32, 16); r(c, '#fff', 16, h - 16, w - 32, 2)
    for (let x = 24; x < w - 40; x += 18) r(c, dark ? '#334' : '#d0ebff', x, h - 21, 10, 5)
    r(c, '#a5d8ff', w - 30, h - 21, 14, 8)
  },
  cathedral(c, w, h, look) {
    const dark = look === 'night'
    r(c, '#e6dccb', 0, 0, w, h)
    r(c, '#bfae94', 0, h - 4, w, 4)
    // arches + stained glass
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * 76
      r(c, '#8a7a64', x - 2, 30, 34, 110)
      const g = c.createLinearGradient(x, 32, x + 30, 140)
      g.addColorStop(0, dark ? '#334' : '#4dabf7'); g.addColorStop(0.3, dark ? '#433' : '#ff6b6b'); g.addColorStop(0.6, dark ? '#443' : '#ffd43b'); g.addColorStop(1, dark ? '#343' : '#69db7c')
      c.fillStyle = g
      c.beginPath(); c.moveTo(x, 140); c.lineTo(x, 50); c.quadraticCurveTo(x + 15, 22, x + 30, 50); c.lineTo(x + 30, 140); c.fill()
      r(c, '#5c4a32', x + 14, 40, 2, 100); r(c, '#5c4a32', x, 90, 30, 2)
    }
    // rose window
    c.fillStyle = dark ? '#445' : '#f783ac'
    c.beginPath(); c.arc(w / 2, 22, 14, 0, Math.PI * 2); c.fill()
    c.fillStyle = dark ? '#556' : '#ffd43b'
    c.beginPath(); c.arc(w / 2, 22, 6, 0, Math.PI * 2); c.fill()
    // pews
    for (let x = 12; x < w - 12; x += 14) r(c, '#7d4f14', x, h - 10, 10, 6)
  },
  stairs(c, w, h) {
    r(c, 'rgba(0,0,0,0)', 0, 0, w, h)
    for (let i = 0; i < 8; i++) {
      r(c, '#8d6e4f', i * (w / 8), h - 3 - i * 4, w / 8 + 1, 3)
      r(c, '#5c4632', i * (w / 8), h - i * 4, w / 8 + 1, 1)
    }
    c.strokeStyle = '#495057'; c.lineWidth = 1
    c.beginPath(); c.moveTo(0, h - 10); c.lineTo(w, -6); c.stroke()
  },
  escalator(c, w, h) {
    c.fillStyle = '#adb5bd'
    c.beginPath(); c.moveTo(0, h); c.lineTo(8, h); c.lineTo(w, 6); c.lineTo(w, 0); c.lineTo(w - 8, 0); c.lineTo(0, h - 6); c.fill()
    for (let i = 0; i < 10; i++) r(c, '#495057', i * (w / 10), h - 4 - i * 3, 3, 1)
    c.strokeStyle = '#1c1c1c'; c.lineWidth = 1.5
    c.beginPath(); c.moveTo(0, h - 12); c.lineTo(w, -4); c.stroke()
  },
  iceCream(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#ffdeeb', '#f8f0e3', dark)
    for (let x = 0; x < w; x += 8) r(c, dark ? '#5a2a3a' : '#f06595', x, 2, 4, 4)
    for (let x = 4; x < w; x += 8) r(c, dark ? '#666' : '#fff', x, 2, 4, 4)
    sign(c, w, 'ICE CREAM', '#f06595')
    // counter with tubs of flavours
    r(c, '#e9ecef', 4, h - 13, 40, 10); r(c, '#adb5bd', 4, h - 14, 40, 1)
    const flavours = ['#fff3bf', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#d0bfff', '#8d6e4f']
    flavours.forEach((col, i) => { r(c, col, 6 + i * 6, h - 17, 5, 3); r(c, '#fff', 6 + i * 6, h - 18, 5, 1) })
    // giant cone
    c.fillStyle = '#e8a85c'
    c.beginPath(); c.moveTo(w - 20, h - 18); c.lineTo(w - 6, h - 18); c.lineTo(w - 13, h - 3); c.fill()
    r(c, '#c97d32', w - 17, h - 14, 8, 1); r(c, '#c97d32', w - 15, h - 10, 4, 1)
    c.fillStyle = '#f783ac'; c.beginPath(); c.arc(w - 13, h - 20, 6, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#96f2d7'; c.beginPath(); c.arc(w - 13, h - 26, 5, 0, Math.PI * 2); c.fill()
    r(c, '#e03131', w - 14, h - 33, 3, 3)
    for (const [dx, dy, col] of [[-3, -20, '#fff'], [2, -22, '#ffd43b'], [-1, -26, '#4dabf7'], [3, -27, '#e03131']] as const) r(c, col, w - 13 + dx, h + dy, 1, 1)
    // tiny table
    r(c, '#fff', 50, h - 10, 10, 2); r(c, '#ced4da', 54, h - 8, 2, 5)
  },
  park(c, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#c5f6fa'); g.addColorStop(1, '#e6fcf5')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2)
    r(c, '#51cf66', 0, h - 5, w, 5); r(c, '#2f9e44', 0, h - 2, w, 2)
    for (let x = 1; x < w; x += 3) r(c, '#69db7c', x, h - 6, 1, 1)
    // trees
    for (const tx of [10, w - 18]) {
      r(c, '#8b5a2b', tx + 3, h - 15, 3, 10)
      c.fillStyle = '#2f9e44'; c.beginPath(); c.arc(tx + 4.5, h - 19, 8, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#51cf66'; c.beginPath(); c.arc(tx + 2, h - 22, 4, 0, Math.PI * 2); c.fill()
      r(c, '#e03131', tx + 7, h - 18, 2, 2); r(c, '#e03131', tx, h - 16, 2, 2)
    }
    // pond + bench + flowers
    c.fillStyle = '#4dabf7'; c.beginPath(); c.ellipse(w / 2 + 4, h - 4, 12, 2.5, 0, 0, Math.PI * 2); c.fill()
    r(c, '#8d6e4f', 28, h - 10, 14, 2); r(c, '#5c4632', 29, h - 8, 1, 3); r(c, '#5c4632', 40, h - 8, 1, 3); r(c, '#8d6e4f', 28, h - 13, 14, 1)
    const fl = ['#ff6b6b', '#ffd43b', '#da77f2', '#fff']
    for (let i = 0; i < 9; i++) { const x = 4 + i * 10 + (i % 2) * 3; r(c, '#2f9e44', x, h - 8, 1, 3); r(c, fl[i % 4], x - 1, h - 10, 3, 2) }
  },
  arcade(c, w, h) {
    r(c, '#1a1033', 0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2)
    for (let x = 0; x < w; x += 4) r(c, (x / 4) % 2 ? '#f06595' : '#22b8cf', x, 2, 4, 1)
    // checker carpet
    for (let x = 0; x < w; x += 4) r(c, (x / 4) % 2 ? '#5f3dc4' : '#e64980', x, h - 3, 4, 3)
    sign(c, w, 'ARCADE', '#7048e8', '#ffe066')
    const bodies = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#ae3ec9', '#0ca678']
    for (let i = 0; i < ARCADE_CABS; i++) {
      const x = ARCADE_X[i]
      r(c, bodies[i % bodies.length], x, h - 23, 10, 20)
      r(c, '#111', x + 2, h - 21, 6, 6)
      r(c, '#212529', x + 1, h - 13, 8, 2)
      r(c, '#fa5252', x + 3, h - 15, 1, 2); r(c, '#ffd43b', x + 6, h - 14, 1, 1)
    }
    // claw machine
    const cx = w - 20
    r(c, '#ffd43b', cx, h - 27, 16, 24); r(c, 'rgba(200,240,255,0.55)', cx + 2, h - 25, 12, 12)
    r(c, '#868e96', cx + 7, h - 25, 1, 5); r(c, '#ced4da', cx + 5, h - 20, 5, 2)
    for (const [dx, col] of [[3, '#ff8787'], [7, '#74c0fc'], [10, '#b2f2bb']] as const) r(c, col, cx + dx, h - 16, 3, 3)
  },
  pool(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#e3fafc', '#c5f6fa', dark)
    for (let x = 0; x < w; x += 6) r(c, 'rgba(0,0,0,0.06)', x, 2, 1, h - 5)
    sign(c, w, 'POOL', '#1098ad')
    r(c, '#99e9f2', 14, h - 14, w - 28, 11)
    r(c, '#1098ad', 14, h - 14, 2, 11); r(c, '#1098ad', w - 16, h - 14, 2, 11)
    // diving board + lifeguard chair
    r(c, '#868e96', 2, h - 20, 2, 17); r(c, '#fff', 2, h - 20, 22, 2)
    r(c, '#e03131', w - 12, h - 26, 8, 3); r(c, '#fff', w - 12, h - 23, 1, 20); r(c, '#fff', w - 5, h - 23, 1, 20); r(c, '#fff', w - 12, h - 15, 8, 1)
  },
  aquarium(c, w, h) {
    r(c, '#0b3d5c', 0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2); r(c, '#2a2f3a', 0, h - 3, w, 3)
    const g = c.createLinearGradient(0, 4, 0, h - 6)
    g.addColorStop(0, '#74c0fc'); g.addColorStop(1, '#1864ab')
    c.fillStyle = g
    c.fillRect(AQ_PAD, 4, w - AQ_PAD * 2, h - 10)
    // sand, rocks, seaweed, treasure
    r(c, '#e9d8a6', AQ_PAD, h - 12, w - AQ_PAD * 2, 6)
    for (let x = AQ_PAD + 4; x < w - AQ_PAD - 4; x += 13) {
      for (let k = 0; k < 4; k++) r(c, k % 2 ? '#2f9e44' : '#40c057', x + (k % 2), h - 14 - k * 4, 2, 4)
    }
    r(c, '#868e96', 30, h - 15, 10, 4); r(c, '#adb5bd', 32, h - 17, 6, 2)
    r(c, '#8b5a2b', w - 40, h - 17, 12, 7); r(c, '#ffd43b', w - 40, h - 15, 12, 1); r(c, '#f1c40f', w - 37, h - 19, 6, 2)
    r(c, '#ffd43b', w - 36, h - 13, 2, 2)
    r(c, 'rgba(255,255,255,0.25)', AQ_PAD + 2, 6, 2, h - 20)
    r(c, '#212529', AQ_PAD - 2, 3, 2, h - 8); r(c, '#212529', w - AQ_PAD, 3, 2, h - 8)
    sign(c, w, 'AQUARIUM', '#1971c2')
  },
  hauntedHouse(c, w, h) {
    r(c, '#2b2140', 0, 0, w, h)
    for (let x = 0; x < w; x += 10) r(c, '#33284d', x, 2, 5, h - 5)
    r(c, '#3a3a46', 0, 0, w, 2)
    for (let x = 0; x < w; x += 6) r(c, (x / 6) % 2 ? '#3d2b1f' : '#4a3426', x, h - 3, 6, 3)
    // moonlit window
    r(c, '#111', 18, 20, 20, 22); r(c, '#364fc7', 19, 21, 18, 20)
    c.fillStyle = '#fff3bf'; c.beginPath(); c.arc(28, 28, 5, 0, Math.PI * 2); c.fill()
    r(c, '#111', 27, 21, 2, 20); r(c, '#111', 19, 30, 18, 2)
    // cobwebs
    c.strokeStyle = 'rgba(230,230,240,0.5)'; c.lineWidth = 0.6
    for (const [x0, sx] of [[2, 1], [w - 2, -1]] as const) {
      c.beginPath()
      for (let k = 0; k < 4; k++) { c.moveTo(x0, 2); c.lineTo(x0 + sx * (16 - k * 4), 2 + k * 5) }
      c.moveTo(x0 + sx * 6, 2); c.quadraticCurveTo(x0 + sx * 5, 7, x0, 8)
      c.moveTo(x0 + sx * 12, 2); c.quadraticCurveTo(x0 + sx * 10, 12, x0, 14)
      c.stroke()
    }
    // coffin, candles, pumpkins
    c.fillStyle = '#5c3d2e'
    c.beginPath(); c.moveTo(60, h - 3); c.lineTo(56, h - 16); c.lineTo(62, h - 22); c.lineTo(76, h - 22); c.lineTo(82, h - 16); c.lineTo(78, h - 3); c.fill()
    r(c, '#ced4da', 68, h - 18, 2, 10); r(c, '#ced4da', 65, h - 15, 8, 2)
    for (const x of [95, 104]) { r(c, '#fff', x, h - 12, 2, 9); r(c, '#ffd43b', x, h - 15, 2, 3); r(c, '#ff922b', x, h - 14, 2, 1) }
    for (const x of [44, 118, 136]) {
      c.fillStyle = '#f76707'; c.beginPath(); c.ellipse(x, h - 8, 6, 5, 0, 0, Math.PI * 2); c.fill()
      r(c, '#2b8a3e', x - 1, h - 15, 2, 3)
      r(c, '#ffe066', x - 3, h - 10, 2, 2); r(c, '#ffe066', x + 1, h - 10, 2, 2); r(c, '#ffe066', x - 3, h - 6, 6, 1)
    }
    sign(c, w, 'HAUNTED', '#5f3dc4', '#b2f2bb')
  },
  dinoMuseum(c, w, h, look) {
    const dark = look === 'night'
    shell(c, w, h, '#efe3c8', '#9c7a54', dark)
    sign(c, w, 'DINO MUSEUM', '#2b8a3e')
    const bone = dark ? '#cfc6b0' : '#fbf6ea'
    const B = (x: number, y: number, ww: number, hh: number) => { r(c, '#a89878', x - 1, y - 1, ww + 2, hh + 2) }
    const parts: [number, number, number, number][] = []
    const add = (x: number, y: number, ww: number, hh: number) => parts.push([x, y, ww, hh])
    // T-Rex
    r(c, '#8d6e4f', 16, h - 10, 118, 7); r(c, '#6b4f3a', 16, h - 4, 118, 1)
    add(50, h - 42, 8, 16); add(52, h - 27, 5, 16); add(50, h - 12, 12, 3)
    add(74, h - 44, 8, 18); add(76, h - 27, 5, 16); add(74, h - 12, 12, 3)
    add(40, h - 62, 64, 4)
    for (let i = 0; i < 8; i++) add(48 + i * 6, h - 58, 3, 14 - Math.abs(i - 4))
    for (let i = 0; i < 7; i++) add(36 - i * 4, h - 60 + i * 4, 6, 3)
    add(100, h - 70, 8, 10)
    add(104, h - 84, 26, 12); add(108, h - 70, 20, 4)
    add(96, h - 54, 8, 2); add(102, h - 54, 2, 5)
    // Brontosaurus
    for (const x of [166, 180, 206, 220]) add(x, h - 34, 5, 24)
    add(160, h - 40, 70, 5)
    for (let i = 0; i < 9; i++) add(166 + i * 7, h - 36, 3, 11)
    for (let i = 0; i < 8; i++) add(160 - i * 3, h - 44 - i * 5, 5, 6)
    add(132, h - 86, 12, 6)
    for (let i = 0; i < 6; i++) add(230 + i * 4, h - 40 + i * 4, 5, 3)
    for (const p of parts) B(...p)
    for (const p of parts) r(c, bone, ...p)
    r(c, '#5c4632', 113, h - 81, 4, 4)
    for (let i = 0; i < 5; i++) r(c, '#fff', 110 + i * 4, h - 72, 2, 2)
    r(c, '#5c4632', 135, h - 85, 2, 2)
    // big egg + plaque
    c.fillStyle = '#e9d8a6'; c.beginPath(); c.ellipse(150, h - 13, 6, 8, 0, 0, Math.PI * 2); c.fill()
    r(c, '#ced4da', 143, h - 6, 14, 3)
    for (const [x, y] of [[147, h - 16], [152, h - 12], [148, h - 9]]) r(c, '#adb5bd', x, y, 2, 1)
  },
  rocketPad(c, w, h) {
    // open-air launch deck: concrete pad, hazard stripes, gantry tower
    r(c, '#868e96', 0, h - 8, w, 8)
    for (let x = 0; x < w; x += 8) r(c, '#ffd43b', x, h - 8, 4, 2)
    for (let x = 4; x < w; x += 8) r(c, '#212529', x, h - 8, 4, 2)
    r(c, '#495057', w / 2 - 10, h - 6, 20, 3)
    const gx = 6
    r(c, '#c92a2a', gx, 6, 3, h - 14); r(c, '#c92a2a', gx + 12, 6, 3, h - 14)
    c.strokeStyle = '#e03131'; c.lineWidth = 1
    c.beginPath()
    for (let y = 8; y < h - 10; y += 8) { c.moveTo(gx + 1, y); c.lineTo(gx + 13, y + 8); c.moveTo(gx + 13, y); c.lineTo(gx + 1, y + 8) }
    c.stroke()
    r(c, '#c92a2a', gx, 6, 15, 2)
    r(c, '#868e96', gx + 15, 20, ROCKET_X - gx - 22, 2)
    r(c, '#fff3bf', gx + 6, 2, 3, 4)
    // fuel tanks
    for (const x of [w - 16, w - 8]) { r(c, '#dee2e6', x, h - 22, 6, 14); r(c, '#adb5bd', x, h - 22, 6, 2) }
  },
}

Object.assign(painters, {
  pizza(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#fff4e6', '#8d6e4f', dark)
    for (let x = 0; x < w; x += 4) r(c, dark ? '#5a2a2a' : (x / 4) % 2 ? '#e03131' : '#fff', x, h - 10, 4, 3)
    sign(c, w, 'PIZZA', '#e03131', '#fff')
    // brick oven
    c.fillStyle = '#b5532c'; c.beginPath(); c.arc(16, h - 10, 13, Math.PI, 0); c.fill()
    r(c, '#b5532c', 3, h - 10, 26, 7)
    for (let y = h - 20; y < h - 4; y += 4) for (let x = 5 + ((y / 4) % 2) * 3; x < 28; x += 6) r(c, '#8f3d1f', x, y, 4, 1)
    c.fillStyle = '#1a1010'; c.beginPath(); c.arc(16, h - 7, 6, Math.PI, 0); c.fill()
    // counter + pizza
    r(c, '#ced4da', 36, h - 12, 30, 9); r(c, '#868e96', 36, h - 13, 30, 1)
    c.fillStyle = '#f4c05a'; c.beginPath(); c.ellipse(46, h - 14, 7, 2, 0, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#e8590c'; c.beginPath(); c.ellipse(46, h - 14, 5.5, 1.4, 0, 0, Math.PI * 2); c.fill()
    for (const dx of [-3, 0, 3]) r(c, '#c92a2a', 46 + dx, h - 15, 1, 1)
    // tables with checkered cloths
    for (const x of [74, 94]) {
      for (let i = 0; i < 12; i += 2) { r(c, '#e03131', x + i, h - 12, 1, 2); r(c, '#fff', x + i + 1, h - 12, 1, 2) }
      r(c, '#5c4632', x + 5, h - 10, 2, 7)
    }
  },
  tacos(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#fff3bf', '#c2703d', dark)
    // paper flag bunting
    const flags = ['#e64980', '#fab005', '#12b886', '#4c6ef5', '#fd7e14']
    c.strokeStyle = '#495057'; c.lineWidth = 0.5
    c.beginPath(); c.moveTo(0, 4); c.quadraticCurveTo(w / 2, 9, w, 4); c.stroke()
    for (let i = 0; i < 9; i++) {
      const x = 3 + i * 8.6, y = 4 + Math.sin((i / 8) * Math.PI) * 4
      c.fillStyle = flags[i % flags.length]
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y); c.lineTo(x + 2.5, y + 5); c.fill()
    }
    sign(c, w, 'TACOS', '#f08c00', '#fff')
    // grill counter
    r(c, '#495057', 4, h - 12, 28, 9); r(c, '#212529', 4, h - 13, 28, 2)
    for (let x = 6; x < 30; x += 4) r(c, '#868e96', x, h - 14, 2, 1)
    // giant taco
    c.fillStyle = '#f4c05a'; c.beginPath(); c.arc(w - 18, h - 6, 11, Math.PI, 0); c.fill()
    r(c, '#51cf66', w - 27, h - 12, 18, 2)
    r(c, '#e03131', w - 24, h - 13, 3, 2); r(c, '#ffd43b', w - 18, h - 13, 4, 1); r(c, '#8b5a2b', w - 13, h - 12, 3, 2)
    r(c, '#d9a03f', w - 29, h - 7, 22, 1)
  },
  sushi(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#f3e6cc', '#8d6e4f', dark)
    // noren curtain
    for (let i = 0; i < 5; i++) r(c, '#1c3d6e', 8 + i * 7, 2, 6, 9)
    r(c, '#fff', 20, 5, 6, 3)
    sign(c, w, 'SUSHI', '#c92a2a', '#fff')
    // paper lanterns
    for (const x of [w - 30, w - 14]) { r(c, '#555', x + 2, 2, 1, 4); r(c, '#ff6b6b', x, 6, 5, 7); r(c, '#c92a2a', x, 6, 5, 1); r(c, '#c92a2a', x, 12, 5, 1) }
    // conveyor counter + stools
    r(c, '#8b5a2b', 6, h - 12, w - 12, 9)
    r(c, '#868e96', 6, h - 15, w - 12, 3)
    r(c, '#495057', 6, h - 13, w - 12, 1)
    for (let x = 12; x < w - 10; x += 16) { r(c, '#c92a2a', x, h - 8, 6, 2); r(c, '#495057', x + 2, h - 6, 2, 3) }
  },
  donuts(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#ffe3ec', '#c48b5c', dark)
    for (let x = 0; x < w; x += 6) r(c, dark ? '#4a2a3a' : '#f783ac', x, 2, 3, 3)
    sign(c, w, 'DONUTS', '#ae3ec9', '#fff')
    // display case
    r(c, '#dee2e6', 4, h - 14, 40, 11); r(c, 'rgba(200,240,255,0.6)', 5, h - 13, 38, 6)
    const icing = ['#f783ac', '#8d6e4f', '#fff', '#ffd43b', '#74c0fc', '#b197fc']
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 6
      c.fillStyle = '#d9a03f'; c.beginPath(); c.arc(x, h - 10, 2.6, 0, Math.PI * 2); c.fill()
      c.fillStyle = icing[i]; c.beginPath(); c.arc(x, h - 10.5, 2.1, 0, Math.PI * 2); c.fill()
      r(c, '#f3e6cc', x - 0.5, h - 10.5, 1, 1)
    }
    r(c, '#fff', 50, h - 10, 8, 2); r(c, '#ced4da', 53, h - 8, 2, 5)
  },
  pancakes(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#fff9db', '#a0703f', dark)
    sign(c, w, 'PANCAKES', '#f59f00', '#fff')
    window(c, 6, 6, 14, 10, dark)
    // griddle
    r(c, '#343a40', 6, h - 12, 30, 9); r(c, '#212529', 6, h - 13, 30, 2)
    for (const x of [12, 24]) { c.fillStyle = '#e8b04f'; c.beginPath(); c.ellipse(x, h - 14, 4, 1, 0, 0, Math.PI * 2); c.fill() }
    // booths
    for (const x of [48, 84]) {
      r(c, '#e03131', x, h - 14, 3, 11); r(c, '#e03131', x + 21, h - 14, 3, 11)
      r(c, '#fff', x + 5, h - 11, 14, 2); r(c, '#adb5bd', x + 11, h - 9, 2, 6)
      r(c, '#e8b04f', x + 7, h - 13, 4, 2); r(c, '#fab005', x + 14, h - 14, 2, 3)
    }
    plant(c, w - 8, h - 3)
  },
  candy(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#fff0f6', '#f8c6d8', dark)
    for (let x = 0; x < w; x += 6) r(c, dark ? 'rgba(80,30,50,0.4)' : 'rgba(247,131,172,0.35)', x, 2, 3, h - 13)
    sign(c, w, 'CANDY', '#e64980', '#fff')
    // shelves of jars
    r(c, '#8d6e4f', 4, h - 22, 34, 19)
    const sweets = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b', '#fff', '#f783ac']
    for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
      const x = 6 + i * 6.4, y = h - 20 + row * 8
      r(c, 'rgba(220,240,255,0.8)', x, y, 5, 6)
      for (let k = 0; k < 4; k++) r(c, sweets[(i + row * 3 + k) % sweets.length], x + 1 + (k % 2) * 2, y + 2 + Math.floor(k / 2) * 2, 2, 2)
      r(c, '#e64980', x, y - 1, 5, 1)
    }
    // lollipop sticks (the swirls spin in the renderer)
    for (const x of CANDY_POPS) r(c, '#fff', x, h - 13, 1, 10)
  },
} satisfies Partial<Record<FacilityKind, Painter>>)

Object.assign(painters, {
  trampoline(c: Ctx, w: number, h: number) {
    shell(c, w, h, '#d0ebff', '#1971c2', false)
    for (let x = 0; x < w; x += 10) r(c, '#a5d8ff', x, 2, 5, h - 12)
    sign(c, w, 'BOUNCE!', '#1c7ed6', '#ffe066')
    for (let i = 0; i < TRAMPS; i++) {
      const x = 6 + i * 26
      r(c, '#212529', x, h - 7, 22, 3); r(c, '#364fc7', x + 2, h - 8, 18, 1)
      for (let k = 0; k < 6; k++) r(c, '#adb5bd', x + 1 + k * 4, h - 6, 1, 2)
      r(c, '#212529', x, h - 4, 2, 1); r(c, '#212529', x + 20, h - 4, 2, 1)
    }
    // foam pit
    const px = w - 50
    r(c, '#495057', px, h - 14, 46, 11)
    const foam = ['#ff8787', '#ffd43b', '#69db7c', '#74c0fc', '#da77f2']
    for (let i = 0; i < 22; i++) r(c, foam[i % 5], px + 2 + (i * 7) % 42, h - 13 + (i % 3) * 3, 4, 3)
  },
  climbing(c: Ctx, w: number, h: number) {
    r(c, '#e9ecef', 0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2)
    for (let f = 1; f < 3; f++) r(c, '#ced4da', 0, f * FH, w, 1)
    r(c, '#5c7c9c', 8, 12, w - 16, h - 18)
    for (let x = 8; x < w - 8; x += 20) r(c, '#4a6a8a', x, 12, 1, h - 18)
    const holds = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b']
    for (let i = 0; i < 46; i++) r(c, holds[i % 6], 10 + ((i * 37) % (w - 22)), 14 + ((i * 53) % (h - 26)), 3, 2)
    // bell + anchors + crash mat
    r(c, '#868e96', w / 2 - 20, 9, 40, 1)
    r(c, '#fab005', w / 2 - 3, 5, 6, 5); r(c, '#e67700', w / 2 - 1, 10, 2, 1)
    r(c, '#e03131', 4, h - 6, w - 8, 4)
    sign(c, w, 'CLIMB', '#e8590c')
  },
  miniGolf(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#d3f9d8', '#2f9e44', dark)
    sign(c, w, 'MINI GOLF', '#2f9e44')
    r(c, '#40c057', 4, h - 6, w - 8, 3)
    r(c, '#8b5a2b', 4, h - 7, w - 8, 1)
    c.fillStyle = '#37b24d'; c.beginPath(); c.ellipse(52, h - 6, 14, 3, 0, Math.PI, 0); c.fill()
    // windmill
    r(c, '#e03131', GOLF_MILL - 6, h - 20, 12, 14); c.fillStyle = '#862e9c'
    c.beginPath(); c.moveTo(GOLF_MILL - 8, h - 20); c.lineTo(GOLF_MILL, h - 27); c.lineTo(GOLF_MILL + 8, h - 20); c.fill()
    r(c, '#212529', GOLF_MILL - 2, h - 10, 4, 4)
    // hole + flag
    r(c, '#111', GOLF_HOLE - 2, h - 6, 4, 1)
    r(c, '#fff', GOLF_HOLE, h - 20, 1, 14)
    r(c, '#ffd43b', GOLF_HOLE + 1, h - 20, 6, 4)
  },
  bowling(c: Ctx, w: number, h: number) {
    r(c, '#1f1638', 0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2)
    for (let i = 0; i < 12; i++) r(c, i % 2 ? '#f06595' : '#22b8cf', 10 + i * 18, 6 + (i % 3) * 3, 2, 2)
    sign(c, w, 'BOWLING', '#f06595', '#fff')
    r(c, '#d9a86c', 0, h - 8, w, 5); r(c, '#b5834c', 0, h - 3, w, 3)
    for (let x = 0; x < w; x += 12) r(c, '#c9965a', x, h - 8, 1, 5)
    r(c, '#212529', BOWL_PINS - 8, h - 20, 2, 12)
    // ball return
    r(c, '#495057', 8, h - 14, 14, 6)
    for (const [x, col] of [[10, '#e03131'], [15, '#4dabf7']] as const) { c.fillStyle = col; c.beginPath(); c.arc(x + 2, h - 15, 2.5, 0, Math.PI * 2); c.fill() }
  },
  rollerRink(c: Ctx, w: number, h: number) {
    r(c, '#24123f', 0, 0, w, h)
    r(c, '#3a3a46', 0, 0, w, 2)
    r(c, '#c9965a', 0, h - 6, w, 3); r(c, '#a87a44', 0, h - 3, w, 3)
    for (let x = 0; x < w; x += 4) r(c, (x / 4) % 3 ? '#b88650' : '#d9a86c', x, h - 6, 4, 1)
    r(c, '#ddd', w / 2, 2, 1, 6); r(c, '#ced4da', w / 2 - 4, 8, 9, 8); r(c, '#fff', w / 2 - 2, 10, 2, 2)
    sign(c, w, 'SKATE', '#7048e8', '#ffe066')
    for (const x of [4, w - 8]) r(c, '#f06595', x, 6, 4, h - 12)
  },
} satisfies Partial<Record<FacilityKind, Painter>>)

Object.assign(painters, {
  bookstore(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#f3e6cc', '#8b5a2b', dark)
    sign(c, w, 'BOOKS', '#5c3d2e', '#ffe8a3')
    shelf(c, 4, h - 25, 30, 22)
    shelf(c, w - 34, h - 25, 30, 22)
    // table with a stack, armchair, sleepy shop cat
    r(c, '#8b5a2b', 42, h - 11, 22, 2); r(c, '#5c4632', 44, h - 9, 2, 6); r(c, '#5c4632', 60, h - 9, 2, 6)
    for (let i = 0; i < 4; i++) r(c, ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00'][i], 46 + (i % 2), h - 13 - i * 2, 10, 2)
    r(c, '#c92a2a', 66, h - 12, 10, 9); r(c, '#a61e1e', 66, h - 16, 3, 13)
    r(c, '#ff922b', 58, h - 16, 6, 3); r(c, '#ff922b', 63, h - 18, 2, 2); r(c, '#ff922b', 57, h - 15, 1, 2)
  },
  library(c: Ctx, w: number, h: number, look: Look) {
    const dark = look === 'night'
    shell(c, w, h, '#e6dccb', '#7d4f14', dark)
    r(c, '#5c3d2e', 0, FH - 2, w, 3) // mezzanine
    sign(c, w, 'LIBRARY', '#1864ab', '#fff')
    for (const x of [4, 40, 128, 164]) { shelf(c, x, 6, 26, FH - 9); shelf(c, x, FH + 3, 26, FH - 7) }
    // story-time rug, chairs, lamp
    c.fillStyle = '#ffa8a8'; c.beginPath(); c.ellipse(96, h - 4, 20, 2.5, 0, 0, Math.PI * 2); c.fill()
    r(c, '#2f9e44', 74, h - 12, 7, 8); r(c, '#2f9e44', 74, h - 15, 2, 11)
    r(c, '#fab005', 110, h - 10, 6, 6)
    r(c, '#495057', 100, FH + 8, 1, 10); r(c, '#ffe066', 97, FH + 6, 7, 3)
    plant(c, w - 10, FH - 2)
  },
} satisfies Partial<Record<FacilityKind, Painter>>)

function shelf(c: Ctx, x: number, y: number, w: number, h: number) {
  r(c, '#6b4f3a', x, y, w, h)
  const cols = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0ca678', '#e64980', '#fab005']
  for (let row = 0; row < Math.floor((h - 2) / 7); row++) {
    const yy = y + 1 + row * 7
    for (let i = 0, bx = x + 1; bx < x + w - 2; i++) {
      const bw = 2 + ((x + i * 3 + row) % 2)
      const bh = 4 + ((i + row) % 3 === 0 ? 0 : 1)
      r(c, cols[(i * 5 + row * 3 + x) % cols.length], bx, yy + 6 - bh, bw, bh)
      bx += bw + 0.5
    }
    r(c, '#4a3426', x, yy + 6, w, 1)
  }
}

export const TRAMPS = 4
export const GOLF_MILL = 112
export const GOLF_HOLE = 148
export const BOWL_PINS = 208
export const CANDY_POPS = [50, 64]
export const ARCADE_X =[4, 17, 30, 82, 95]
export const ARCADE_CABS = ARCADE_X.length
export const AQ_PAD = 8
/** Rocket centre, in sprite pixels from the pad's left edge. */
export const ROCKET_X = 62

function mess(c: Ctx, x: number, h: number) {
  r(c, '#868e96', x + 2, h - 6, 3, 2); r(c, '#e9ecef', x + 10, h - 5, 4, 2); r(c, '#a9a9a9', x + 16, h - 15, 5, 1)
}

function hotelRoom(c: Ctx, w: number, h: number, look: Look, beds: number, wall: string) {
  const dark = look === 'night'
  shell(c, w, h, look === 'dirty' ? shade(wall, -0.2) : wall, '#7f5f45', dark)
  // door
  r(c, '#6b4f3a', w - 8, h - 22, 6, 19); r(c, '#ffd43b', w - 4, h - 12, 1, 1)
  for (let i = 0; i < beds; i++) {
    const x = 3 + i * 21
    r(c, '#6b4f3a', x, h - 9, 18, 6)
    r(c, look === 'dirty' ? '#d8cfc4' : '#fff', x, h - 12, 18, 3)
    r(c, look === 'dirty' ? '#9c8f80' : '#4dabf7', x + 5, h - 12, 13, 3)
    r(c, '#fff', x, h - 15, 5, 3)
    r(c, '#6b4f3a', x - 1, h - 17, 2, 14)
    if (look === 'dirty') mess(c, x, h)
  }
  if (beds > 0) {
    r(c, '#ffd43b', w - 14, h - 19, 4, 3)
    r(c, '#6b4f3a', w - 13, h - 16, 2, 13)
  }
}

function lobbyChunk(c: Ctx, w: number, h: number, look: Look, sky: boolean) {
  const dark = look === 'night'
  const g = c.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, sky ? '#d0ebff' : '#fff4e6'); g.addColorStop(1, sky ? '#a5d8ff' : '#ffe8cc')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  if (dark) r(c, 'rgba(255,220,150,0.12)', 0, 0, w, h)
  r(c, '#3a3a46', 0, 0, w, 2)
  // marble floor
  for (let x = 0; x < w; x += 8) r(c, (x / 8) % 2 ? '#f1f3f5' : '#ced4da', x, h - 3, 8, 3)
  // column
  r(c, sky ? '#74c0fc' : '#e8c99b', 2, 2, 5, h - 5); r(c, sky ? '#4dabf7' : '#d9a86c', 1, 2, 7, 2); r(c, sky ? '#4dabf7' : '#d9a86c', 1, h - 5, 7, 2)
  // chandelier
  r(c, '#f1c40f', w / 2 + 4, 2, 1, 4); r(c, '#ffe066', w / 2, 6, 9, 2)
  plant(c, w - 12, h - 3)
}

export function sprite(kind: FacilityKind, width: number, height: number, look: Look, variant = 0): HTMLCanvasElement {
  const key = `${kind}|${width}|${height}|${look}|${variant}`
  const hit = cache.get(key)
  if (hit) return hit
  const w = width * T
  const h = height * FH
  const [cv, c] = mk(w, h)
  pendingSigns = []
  if (kind === 'lobby') lobbyChunk(c, w, h, look, variant === 1)
  else (painters[kind] ?? ((cc: Ctx) => r(cc, '#888', 0, 0, w, h)))(c, w, h, look, variant)
  for (const [sc, sw, text, bg, fg] of pendingSigns) drawSign(sc, sw, text, bg, fg)
  pendingSigns = []
  cache.set(key, cv)
  return cv
}

export const SHIRTS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#9c36b5', '#0ca678', '#e64980', '#495057']
