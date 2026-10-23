// Party Elevator: neon shaft strips, and a car that's a tiny nightclub with a DJ, mirror ball and dance floor.
import type { Car, Game } from '../game/state'
import { minuteOfDay } from '../game/state'
import { FH, SHIRTS, T } from './sprites'

/** After 8pm the party gets louder: faster colours, pulsing neon, a light trail. */
export function partyNight(g: Game) {
  const m = minuteOfDay(g.time)
  return m >= 20 * 60 || m < 6 * 60
}

const hue = (now: number, night: boolean, off = 0) => (now / (night ? 8 : 60) + off) % 360

/** Glowing neon edge strips on one floor of the shaft. */
export function drawPartyShaft(c: CanvasRenderingContext2D, g: Game, x: number, y: number, w: number, z: number, now: number) {
  const night = partyNight(g)
  const pulse = night ? 0.55 + 0.45 * Math.abs(Math.sin(now / 230)) : 0.6
  c.globalAlpha = pulse
  c.fillStyle = `hsl(${hue(now, night)}, 95%, 62%)`
  c.fillRect(x + 2 * z, y, z, FH * z)
  c.fillRect(x + w - 3 * z, y, z, FH * z)
  c.globalAlpha = 1
}

/** The car interior. Drawn over the plain car, under the doors. shaftTop/shaftBot (screen y) keep the night trail inside the shaft. */
export function drawPartyCar(c: CanvasRenderingContext2D, g: Game, car: Car, cx: number, cy: number, cw: number, ch: number, z: number, now: number, shaftTop: number, shaftBot: number) {
  const night = partyNight(g)
  const h0 = hue(now, night)
  // night trail behind a moving car
  if (night && car.state === 'moving' && car.dir !== 0) {
    const len = FH * z
    const ty = car.dir > 0 ? cy + ch : cy - len
    c.save()
    c.beginPath(); c.rect(cx, shaftTop, cw, shaftBot - shaftTop); c.clip()
    const grad = c.createLinearGradient(0, car.dir > 0 ? ty : ty + len, 0, car.dir > 0 ? ty + len : ty)
    grad.addColorStop(0, `hsla(${h0}, 95%, 65%, 0.22)`)
    grad.addColorStop(1, `hsla(${h0}, 95%, 65%, 0)`)
    c.fillStyle = grad
    c.fillRect(cx, ty, cw, len)
    c.restore()
  }
  // dark club walls
  c.fillStyle = night ? '#1a1033' : '#3b2a5c'
  c.fillRect(cx, cy, cw, ch)
  // light-up dance floor
  const tile = 3 * z
  const beat = Math.floor(now / (night ? 220 : 700))
  for (let i = 0; i * tile < cw; i++) {
    c.fillStyle = `hsl(${(h0 + ((i + beat) % 4) * 90) % 360}, 90%, ${night ? 62 : 55}%)`
    c.fillRect(cx + i * tile, cy + ch - 2 * z, Math.min(tile - 0.5 * z, cw - i * tile), 2 * z)
  }
  // mirror ball and the light dots it throws on the walls
  const bx = cx + cw / 2
  const by = cy + 3 * z
  c.fillStyle = '#868e96'
  c.fillRect(bx - 0.25 * z, cy, 0.5 * z, z)
  c.fillStyle = '#dee2e6'
  c.beginPath(); c.arc(bx, by, 1.8 * z, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#fff'
  const glint = Math.floor(now / 120) % 3
  c.fillRect(bx - z + glint * 0.6 * z, by - z, 0.6 * z, 0.6 * z)
  const spin = now / (night ? 500 : 1400)
  for (let i = 0; i < 7; i++) {
    const a = spin + i * 0.9
    c.globalAlpha = night ? 0.85 : 0.5
    c.fillStyle = `hsl(${(h0 + i * 50) % 360}, 100%, 75%)`
    c.fillRect(bx + Math.cos(a) * cw * 0.42, cy + ch * 0.45 + Math.sin(a * 1.3) * ch * 0.3, 0.8 * z, 0.8 * z)
  }
  c.globalAlpha = 1
  // DJ booth on the right, DJ in headphones behind it
  const boothW = 7 * z
  const bxL = cx + cw - boothW
  const floorY = cy + ch - 2 * z
  const nod = night ? Math.abs(Math.sin(now / 140)) * z : Math.abs(Math.sin(now / 420)) * 0.6 * z
  const djx = bxL + 2.5 * z
  c.fillStyle = '#212529' // DJ's shirt
  c.fillRect(djx, floorY - 8 * z, 2.5 * z, 4 * z)
  c.fillStyle = '#c68642'
  c.fillRect(djx + 0.25 * z, floorY - 10.5 * z + nod, 2 * z, 2 * z)
  c.fillStyle = '#ff6b6b' // headphones
  c.fillRect(djx, floorY - 11 * z + nod, 2.5 * z, 0.5 * z)
  c.fillRect(djx - 0.4 * z, floorY - 10 * z + nod, 0.7 * z, 1.2 * z)
  c.fillRect(djx + 2.2 * z, floorY - 10 * z + nod, 0.7 * z, 1.2 * z)
  c.fillStyle = '#343a40'
  c.fillRect(bxL, floorY - 5 * z, boothW, 5 * z)
  c.fillStyle = `hsl(${(h0 + 180) % 360}, 90%, 60%)`
  c.fillRect(bxL, floorY - 3 * z, boothW, 0.8 * z)
  // turntable, with a scratching hand
  c.fillStyle = '#111'
  c.fillRect(bxL + 0.5 * z, floorY - 5.6 * z, 3 * z, 0.6 * z)
  c.fillStyle = '#c68642'
  c.fillRect(bxL + 1.2 * z + Math.sin(now / (night ? 70 : 200)) * 0.8 * z, floorY - 6.4 * z, 0.8 * z, 0.8 * z)
  // dancing riders, arms up
  const room = cw - boothW - z
  const per = Math.max(1, Math.floor(room / (2.5 * z)))
  const n = Math.min(car.riders.length, per * 2)
  for (let i = 0; i < n; i++) {
    const bob = Math.abs(Math.sin(now / (night ? 160 : 300) + i * 1.7)) * 1.5 * z
    const rx = cx + 0.5 * z + (i % per) * 2.5 * z
    const ry = floorY - 3 * z - Math.floor(i / per) * 3.5 * z - bob
    c.fillStyle = SHIRTS[(car.riders[i] ?? 0) % SHIRTS.length]
    c.fillRect(rx, ry, 2 * z, 3 * z)
    const up = (Math.floor(now / 250) + i) % 2 === 0
    c.fillRect(rx - 0.5 * z, ry - (up ? 1.5 : 0.5) * z, 0.5 * z, 1.5 * z)
    c.fillRect(rx + 2 * z, ry - (up ? 0.5 : 1.5) * z, 0.5 * z, 1.5 * z)
    c.fillStyle = '#f1c27d'
    c.fillRect(rx, ry - 1.5 * z, 2 * z, 1.5 * z)
  }
}

/** Doors open: a beam of coloured light spills onto the floor, with confetti and a 🎵. */
export function drawPartyDoors(c: CanvasRenderingContext2D, g: Game, car: Car, sx: number, cy: number, sw: number, ch: number, z: number, now: number, open: number) {
  if (car.state !== 'doors' || open <= 0) return
  const night = partyNight(g)
  const h0 = hue(now, night)
  const reach = 4 * T * z
  const yb = cy + ch
  c.save()
  c.globalAlpha = open * (night ? 0.4 : 0.25)
  c.fillStyle = `hsl(${h0}, 95%, 65%)`
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? sx : sx + sw
    c.beginPath()
    c.moveTo(x0, cy)
    c.lineTo(x0 + side * reach, yb - 2 * z)
    c.lineTo(x0 + side * reach, yb)
    c.lineTo(x0, yb)
    c.closePath()
    c.fill()
  }
  c.globalAlpha = open
  const t = 22 - car.timer // ticks since the doors opened
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1
    const fall = ((now / 700 + i * 0.37) % 1)
    const x = (side < 0 ? sx : sx + sw) + side * (1 + (i * 7) % 13) * 0.25 * reach / 3
    c.fillStyle = `hsl(${(h0 + i * 37) % 360}, 100%, 65%)`
    c.fillRect(x, cy + fall * ch, z, z)
  }
  c.font = `${Math.max(8, Math.round(7 * z))}px sans-serif`
  c.textAlign = 'center'
  c.fillText('🎵', sx + sw + reach * 0.35, yb - 6 * z - Math.min(t, 12) * 0.5 * z)
  c.restore()
}
