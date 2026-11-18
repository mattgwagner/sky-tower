// Pixel art for the crossover rooms. Characters keep the colors and verbs
// from Midnight Line, Comic Cop, and Creakwood.
import type { Facility, Game } from '../game/state'
import { depotRun, mumblesNow } from '../game/crossover'

type Ctx = CanvasRenderingContext2D
type Look = 'day' | 'night' | 'vacant' | 'dirty'

const px = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function nightWash(c: Ctx, w: number, h: number, look: Look) {
  if (look !== 'night') return
  c.fillStyle = 'rgba(5,8,20,0.28)'
  c.fillRect(0, 0, w, h)
}

export function paintGhostDepot(c: Ctx, w: number, h: number, look: Look) {
  const night = look === 'night'
  c.fillStyle = night ? '#12182a' : '#2a3548'
  c.fillRect(0, 0, w, h)
  c.fillStyle = 'rgba(190,210,220,0.16)'
  c.fillRect(0, 6, w, 8)
  c.fillRect(0, 28, w, 5)
  // upper siding: pumpkin tender, bone car, lantern caboose on display
  rails(c, 18, '#6a5a48')
  pumpkinTender(c, 28, 6)
  boneCar(c, 92, 8)
  lanternCaboose(c, 156, 7)
  // platform and the through-track
  px(c, night ? '#4a3424' : '#8d6e63', 0, h - 22, w, 22)
  for (let x = 0; x < w; x += 10) px(c, night ? '#3e2918' : '#6d4c41', x, h - 22, 1, 22)
  rails(c, h - 16, '#3a3230')
  px(c, '#ffd98a', w / 2 - 28, 2, 56, 8)
  c.fillStyle = '#3b2400'
  c.font = 'bold 5px monospace'
  c.textAlign = 'center'
  c.fillText('DEPOT', w / 2, 8)
  c.textAlign = 'left'
  nightWash(c, w, h, look)
}

function rails(c: Ctx, y: number, tie: string) {
  px(c, tie, 0, y + 3, 240, 2)
  for (let x = 4; x < 240; x += 8) px(c, '#5c5346', x, y, 2, 8)
  px(c, '#c5b8a0', 0, y, 240, 1)
  px(c, '#c5b8a0', 0, y + 7, 240, 1)
}

function pumpkinTender(c: Ctx, x: number, y: number) {
  c.fillStyle = '#e8761f'
  c.beginPath()
  c.ellipse(x + 16, y + 10, 16, 10, 0, 0, Math.PI * 2)
  c.fill()
  px(c, '#2e7a2e', x + 14, y + 1, 4, 5)
  px(c, '#3a1a00', x + 6, y + 8, 4, 3)
  px(c, '#222', x + 4, y + 18, 5, 4)
  px(c, '#222', x + 22, y + 18, 5, 4)
}

function boneCar(c: Ctx, x: number, y: number) {
  px(c, '#ece6d6', x, y, 40, 16)
  px(c, '#bdb4a0', x + 4, y + 6, 32, 2)
  px(c, '#bdb4a0', x + 4, y + 4, 3, 6)
  px(c, '#bdb4a0', x + 33, y + 4, 3, 6)
  px(c, '#222', x + 4, y + 16, 5, 4)
  px(c, '#222', x + 30, y + 16, 5, 4)
}

function lanternCaboose(c: Ctx, x: number, y: number) {
  px(c, '#2d2638', x, y, 36, 18)
  px(c, '#4a3d5c', x + 10, y + 3, 16, 12)
  c.fillStyle = 'rgba(255,200,90,0.45)'
  c.beginPath()
  c.arc(x + 18, y + 9, 7, 0, Math.PI * 2)
  c.fill()
  px(c, '#ffd36a', x + 16, y + 7, 4, 4)
  px(c, '#222', x + 4, y + 18, 5, 4)
  px(c, '#222', x + 26, y + 18, 5, 4)
}

export function paintPrecinct(c: Ctx, w: number, h: number, look: Look) {
  c.fillStyle = look === 'night' ? '#1a2744' : '#2f4f8a'
  c.fillRect(0, 0, w, h)
  px(c, '#1c2e55', 0, h - 8, w, 8)
  // comic-panel posters
  const panels: [number, string, string][] = [[8, '#ffd93b', '#e8433a'], [28, '#74c0fc', '#1c2e55'], [48, '#ff8fab', '#6a2fa0']]
  for (const [x, bg, ink] of panels) {
    px(c, '#f4f1ea', x, 3, 16, 12)
    px(c, bg, x + 1, 4, 14, 7)
    px(c, ink, x + 3, 12, 10, 2)
  }
  // desk
  px(c, '#6b4a2b', 8, h - 16, 36, 8)
  px(c, '#8d6e63', 10, h - 20, 4, 6)
  px(c, '#8d6e63', 38, h - 20, 4, 6)
  // cell
  px(c, '#222', w - 40, 4, 34, h - 10)
  px(c, '#3a4150', w - 38, 6, 30, h - 14)
  for (let x = w - 38; x < w - 8; x += 4) px(c, '#d7dde3', x, 6, 1, h - 14)
  px(c, '#f4c542', w / 2 - 22, 2, 28, 7)
  c.fillStyle = '#1a2744'
  c.font = 'bold 5px monospace'
  c.textAlign = 'center'
  c.fillText('WOOF', w / 2 - 8, 7)
  c.textAlign = 'left'
  nightWash(c, w, h, look)
}

export function paintClanky(c: Ctx, w: number, h: number, look: Look) {
  c.fillStyle = look === 'night' ? '#2a1c18' : '#4a3028'
  c.fillRect(0, 0, w, h)
  for (let y = h - 10; y < h; y += 5) {
    for (let x = 0; x < w; x += 5) {
      px(c, ((x + y) / 5) % 2 ? '#fff' : '#d6453b', x, y, 5, 5)
    }
  }
  px(c, '#3b2a20', w - 28, 6, 22, h - 16)
  px(c, '#ffb020', w - 24, 10, 14, 8)
  px(c, '#6b4a2b', 8, h - 16, 28, 6)
  nightWash(c, w, h, look)
}

export function paintReadingRoom(c: Ctx, w: number, h: number, look: Look) {
  c.fillStyle = look === 'night' ? '#1a120c' : '#3a2a22'
  c.fillRect(0, 0, w, h)
  px(c, '#5c4030', 0, h - 10, w, 10)
  px(c, '#2a1c14', 0, 0, 6, h)
  px(c, '#2a1c14', w - 6, 0, 6, h)
  // parchment notes pinned to the walls
  const notes = [[16, 8], [40, 18], [70, 6], [100, 16], [130, 8], [150, 20]]
  for (const [x, y] of notes) {
    px(c, '#f3e6c4', x, y, 14, 10)
    px(c, '#c4b48a', x + 2, y + 2, 10, 1)
    px(c, '#c4b48a', x + 2, y + 5, 8, 1)
    px(c, '#a33', x + 6, y - 1, 2, 2)
  }
  px(c, '#ffd23f', w / 2 - 26, 2, 52, 7)
  c.fillStyle = '#3a2a00'
  c.font = 'bold 5px monospace'
  c.textAlign = 'center'
  c.fillText('NOTES', w / 2, 7)
  c.textAlign = 'left'
  nightWash(c, w, h, look)
}

export function drawGhostDepot(c: Ctx, g: Game, f: Facility, p: { x: number; y: number }, z: number, now: number) {
  const beat = depotRun(g.time)
  const s = z
  // Conductor: long coat, cap, glowing eyes, a swinging lantern (his Midnight Line beat).
  const bx = p.x + 16 * s
  const by = p.y + 40 * s
  px(c, '#1c2338', bx, by, 10 * s, 20 * s)
  c.fillStyle = '#c9d6c9'
  c.beginPath()
  c.arc(bx + 5 * s, by - 2 * s, 4.5 * s, 0, Math.PI * 2)
  c.fill()
  px(c, '#11151f', bx - 1 * s, by - 8 * s, 12 * s, 3 * s)
  px(c, '#11151f', bx + 1 * s, by - 10 * s, 8 * s, 3 * s)
  c.fillStyle = '#ffe35a'
  c.beginPath()
  c.arc(bx + 3 * s, by - 2 * s, 1.1 * s, 0, Math.PI * 2)
  c.arc(bx + 7 * s, by - 2 * s, 1.1 * s, 0, Math.PI * 2)
  c.fill()
  const sw = Math.sin(now / 450) * 8 * s
  const lx = bx + 14 * s + sw
  const ly = by + 8 * s
  c.strokeStyle = '#1c2338'
  c.lineWidth = Math.max(1, 2 * s)
  c.beginPath()
  c.moveTo(bx + 10 * s, by + 4 * s)
  c.lineTo(lx, ly)
  c.stroke()
  c.fillStyle = 'rgba(255,210,100,0.35)'
  c.beginPath()
  c.arc(lx, ly + 3 * s, 7 * s, 0, Math.PI * 2)
  c.fill()
  px(c, '#ffd36a', lx - 2 * s, ly, 5 * s, 6 * s)

  if (beat.running) {
    const trainW = 78 * s
    const x = p.x + beat.progress * ((f.width * 8 - 78) * s)
    const y = p.y + 44 * s
    c.save()
    c.globalAlpha = 0.72
    ghostCar(c, x, y, 22 * s, 12 * s)
    ghostCar(c, x + 26 * s, y, 24 * s, 12 * s)
    ghostCar(c, x + 54 * s, y - 2 * s, 22 * s, 14 * s)
    c.fillStyle = '#d8fff0'
    c.fillRect(x + 70 * s, y + 4 * s, 6 * s, 3 * s)
    c.restore()
    c.fillStyle = 'rgba(125,255,176,0.18)'
    c.fillRect(x, y - 4 * s, trainW, 20 * s)
  } else if (beat.crate) {
    const x = p.x + 70 * s
    const y = p.y + 42 * s
    if (beat.crate === 'candy') {
      px(c, '#6b3a2a', x, y, 16 * s, 10 * s)
      px(c, '#ffb020', x + 2 * s, y + 2 * s, 4 * s, 4 * s)
      px(c, '#f06a12', x + 7 * s, y + 2 * s, 4 * s, 4 * s)
      px(c, '#fff4d6', x + 4 * s, y + 6 * s, 8 * s, 2 * s)
    } else {
      const rattle = Math.sin(now / 80) * 1.2 * s
      px(c, '#3a4150', x + rattle, y, 16 * s, 12 * s)
      for (let i = 0; i < 4; i++) px(c, '#d7dde3', x + rattle + (2 + i * 4) * s, y, 1 * s, 12 * s)
      px(c, '#9aa0ad', x + rattle + 4 * s, y + 4 * s, 7 * s, 4 * s)
      px(c, '#ff2b2b', x + rattle + 5 * s, y + 5 * s, 2 * s, 2 * s)
    }
  }
}

function ghostCar(c: Ctx, x: number, y: number, w: number, h: number) {
  c.fillStyle = 'rgba(150,255,195,0.55)'
  c.fillRect(x, y, w, h)
  c.strokeStyle = 'rgba(210,255,230,0.9)'
  c.lineWidth = 1
  c.strokeRect(x, y, w, h)
}

export function drawPrecinct(c: Ctx, _g: Game, _f: Facility, p: { x: number; y: number }, w: number, h: number, z: number, now: number) {
  const s = z
  // Officer Biscuit: navy uniform, gold star, tan dog head, cop hat. Tail wags.
  const x = p.x + 22 * s
  const y = p.y + h - 18 * s
  const wag = Math.sin(now / 180) * 4 * s
  c.strokeStyle = '#c8a36a'
  c.lineWidth = Math.max(1, 2 * s)
  c.beginPath()
  c.moveTo(x - 6 * s, y + 2 * s)
  c.quadraticCurveTo(x - 12 * s, y - 4 * s + wag, x - 4 * s, y - 8 * s)
  c.stroke()
  px(c, '#1f3d86', x - 4 * s, y - 2 * s, 10 * s, 12 * s)
  px(c, '#f4c542', x + 2 * s, y + 2 * s, 3 * s, 3 * s)
  c.fillStyle = '#e6c39a'
  c.beginPath()
  c.arc(x + 1 * s, y - 6 * s, 5 * s, 0, Math.PI * 2)
  c.fill()
  px(c, '#222', x - 4 * s, y - 14 * s, 10 * s, 4 * s)
  px(c, '#1f3d86', x - 6 * s, y - 11 * s, 14 * s, 2 * s)
  c.fillStyle = '#222'
  c.fillRect(x - 1 * s, y - 7 * s, 1.4 * s, 1.4 * s)
  c.fillRect(x + 2.4 * s, y - 7 * s, 1.4 * s, 1.4 * s)
  px(c, '#222', x, y - 4 * s, 3 * s, 1.2 * s)
  // robo-rat in the cell, antenna twitching
  const rx = p.x + w - 28 * s
  const ry = p.y + h - 14 * s
  const twitch = Math.sin(now / 120) * 3 * s
  px(c, '#9aa0ad', rx, ry, 12 * s, 7 * s)
  px(c, '#c6ccd6', rx + 2 * s, ry - 3 * s, 8 * s, 3 * s)
  px(c, '#ff2b2b', rx + 8 * s, ry + 2 * s, 2 * s, 2 * s)
  c.strokeStyle = '#9aa0ad'
  c.lineWidth = Math.max(1, s)
  c.beginPath()
  c.moveTo(rx + 4 * s, ry - 3 * s)
  c.lineTo(rx + 4 * s + twitch, ry - 9 * s)
  c.stroke()
  px(c, '#ff2b2b', rx + 3 * s + twitch, ry - 11 * s, 2 * s, 2 * s)
}

export function drawClanky(c: Ctx, _g: Game, _f: Facility, p: { x: number; y: number }, _w: number, h: number, z: number, now: number) {
  const s = z
  const x = p.x + 36 * s
  const y = p.y + h - 6 * s
  // tan chef body, white hat, red-check apron, glowing eyes. The dough spins.
  px(c, '#8e8a80', x - 8 * s, y - 16 * s, 3 * s, 12 * s)
  px(c, '#8e8a80', x + 6 * s, y - 16 * s, 3 * s, 12 * s)
  px(c, '#d8cfbe', x - 10 * s, y - 28 * s, 22 * s, 14 * s)
  px(c, '#fff', x - 8 * s, y - 26 * s, 18 * s, 10 * s)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2) px(c, '#d6453b', x - 7 * s + col * 4 * s, y - 25 * s + row * 2.4 * s, 4 * s, 2.4 * s)
    }
  }
  px(c, '#e2d6bf', x - 8 * s, y - 38 * s, 16 * s, 10 * s)
  px(c, '#f4f1ea', x - 9 * s, y - 46 * s, 18 * s, 8 * s)
  px(c, '#140c10', x - 5 * s, y - 36 * s, 3 * s, 3 * s)
  px(c, '#140c10', x + 3 * s, y - 36 * s, 3 * s, 3 * s)
  c.fillStyle = '#fff7a1'
  c.fillRect(x - 4 * s, y - 35 * s, 1.4 * s, 1.4 * s)
  c.fillRect(x + 4 * s, y - 35 * s, 1.4 * s, 1.4 * s)
  const spin = now / 280
  c.save()
  c.translate(x + 18 * s, y - 20 * s)
  c.rotate(spin)
  c.fillStyle = '#f3e6c4'
  c.beginPath()
  c.ellipse(0, 0, 8 * s, 3.5 * s, 0, 0, Math.PI * 2)
  c.fill()
  c.restore()
  px(c, '#8e8a80', x + 8 * s, y - 26 * s, 10 * s, 2 * s)
}

export function drawReadingRoom(c: Ctx, g: Game, f: Facility, p: { x: number; y: number }, _w: number, h: number, z: number, now: number) {
  const s = z
  const roomW = f.width * 8
  const lay = mumblesNow(g.time)
  // yellow raincoat glow, the detective's lantern
  const gx = p.x + 18 * s
  const gy = p.y + h - 16 * s
  c.fillStyle = 'rgba(255,210,60,0.22)'
  c.beginPath()
  c.arc(gx, gy, 16 * s, 0, Math.PI * 2)
  c.fill()
  px(c, '#ffd23f', gx - 6 * s, gy - 18 * s, 10 * s, 16 * s)
  px(c, '#ffd23f', gx - 5 * s, gy - 26 * s, 8 * s, 8 * s)
  px(c, '#ffe28a', gx + 6 * s, gy - 8 * s, 5 * s, 7 * s)
  const pulse = 0.35 + 0.25 * Math.sin(now / 220)
  c.fillStyle = `rgba(255,210,100,${pulse})`
  c.beginPath()
  c.arc(gx + 8 * s, gy - 4 * s, 6 * s, 0, Math.PI * 2)
  c.fill()

  const floorY = p.y + h - 12 * s
  for (const lane of lay.chairs) {
    const x = p.x + lane * roomW * s
    px(c, '#6b4426', x, floorY, 8 * s, 6 * s)
    px(c, '#8d6e63', x + 1 * s, floorY - 7 * s, 6 * s, 7 * s)
  }
  const lx = p.x + lay.lamp * roomW * s
  px(c, '#3a2a22', lx, floorY - 2 * s, 8 * s, 4 * s)
  px(c, '#5c4030', lx + 3 * s, floorY - 12 * s, 2 * s, 10 * s)
  c.fillStyle = 'rgba(255,220,120,0.55)'
  c.beginPath()
  c.arc(lx + 4 * s, floorY - 14 * s, 5 * s, 0, Math.PI * 2)
  c.fill()
  px(c, '#ffe28a', lx + 2 * s, floorY - 16 * s, 4 * s, 5 * s)

  // Mumbles, the sheet ghost, hovering by the lamp and shoving it when he's rearranging.
  const bob = Math.sin(now / 500) * 2 * s
  const shove = lay.moving ? Math.sin(now / 200) * 4 * s : 0
  const mx = lx + shove
  const my = floorY - 28 * s + bob
  c.fillStyle = '#f4f2ff'
  c.beginPath()
  c.moveTo(mx, my + 18 * s)
  c.quadraticCurveTo(mx - 2 * s, my, mx + 8 * s, my)
  c.quadraticCurveTo(mx + 18 * s, my, mx + 16 * s, my + 18 * s)
  for (let i = 0; i < 4; i++) {
    const wave = Math.sin(now / 180 + i) * 2 * s
    c.quadraticCurveTo(mx + 14 * s - i * 4 * s, my + 22 * s + wave, mx + 12 * s - i * 4 * s, my + 18 * s)
  }
  c.closePath()
  c.fill()
  c.strokeStyle = '#1a120c'
  c.lineWidth = Math.max(1, s)
  c.stroke()
  c.fillStyle = '#1a120c'
  c.beginPath()
  c.ellipse(mx + 5 * s, my + 6 * s, 1.6 * s, 2.4 * s, 0, 0, Math.PI * 2)
  c.ellipse(mx + 11 * s, my + 6 * s, 1.6 * s, 2.4 * s, 0, 0, Math.PI * 2)
  c.fill()
}
