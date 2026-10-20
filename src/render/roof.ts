// Motion on the roof: telescope, helicopter, turbine blades, pigeons, the spinning donut, the night beacon.
import type { FacilityKind } from '../game/defs'
import { heliPhase, turbineRate } from '../game/roof'
import type { Facility, Game } from '../game/state'

const nightAt = (m: number) => m >= 20 * 60 || m < 6 * 60

export function drawRoofTopper(
  c: CanvasRenderingContext2D, g: Game, f: Facility,
  p: { x: number; y: number }, w: number, h: number, z: number, now: number, m: number,
) {
  switch (f.kind as FacilityKind) {
    case 'observatory': return drawObservatory(c, p, w, h, z, now, m)
    case 'helipad': return drawHelicopter(c, g, p, w, z, now)
    case 'turbine': return drawBlades(c, g, p, w, z, now)
    case 'waterTower': return drawPigeons(c, g, f, p, w, z, now)
    case 'giantDonut': return drawDonut(c, p, w, h, z, now)
    case 'antenna': return drawBeacon(c, p, w, z, now, m)
    default: return
  }
}

function drawObservatory(c: CanvasRenderingContext2D, p: { x: number; y: number }, w: number, h: number, z: number, now: number, m: number) {
  if (!nightAt(m)) return
  const cx = p.x + w / 2
  const radius = w * 0.46
  const base = p.y + h - 6 * z
  const top = base - radius
  c.fillStyle = '#14141f'
  c.fillRect(cx - 2 * z, top + 3 * z, 4 * z, radius * 0.72)
  const ang = Math.sin(now / 1800) * 0.85
  c.save()
  c.translate(cx, top + radius * 0.55)
  c.rotate(ang)
  c.fillStyle = '#f8f9fa'
  c.fillRect(2 * z, -2 * z, 18 * z, 4 * z)
  c.fillStyle = '#4dabf7'
  c.fillRect(16 * z, -2.4 * z, 5 * z, 4.8 * z)
  c.restore()
}

function drawHelicopter(c: CanvasRenderingContext2D, g: Game, p: { x: number; y: number }, w: number, z: number, now: number) {
  const ph = heliPhase(g)
  if (!ph) return
  const cx = p.x + w / 2
  const hoverY = p.y - 36 * z
  const landY = p.y - 8 * z
  let x = cx
  let y = hoverY
  let rate = 0.045
  if (ph.phase === 'in') x = cx - (1 - ph.k) * 140 * z
  else if (ph.phase === 'hover') y = hoverY + Math.sin(now / 180) * 2 * z
  else if (ph.phase === 'land') { y = hoverY + (landY - hoverY) * ph.k; rate = 0.045 * (1 - ph.k) + 0.004 }
  else if (ph.phase === 'sit') { y = landY; rate = 0.004 }
  else { x = cx + ph.k * 150 * z; y = landY - ph.k * (landY - hoverY + 16 * z); rate = 0.01 + ph.k * 0.03 }
  const s = z * 1.7
  c.save()
  c.translate(x, y)
  c.fillStyle = '#343a40'
  c.fillRect(-10 * s, 5 * s, 7 * s, 1.6 * s)
  c.fillRect(3 * s, 5 * s, 7 * s, 1.6 * s)
  c.fillStyle = '#ffd43b'
  c.beginPath()
  c.ellipse(0, 0, 11 * s, 5 * s, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#74c0fc'
  c.fillRect(-3 * s, -3 * s, 7 * s, 4 * s)
  c.fillStyle = '#fab005'
  c.fillRect(9 * s, -1.2 * s, 13 * s, 2.4 * s)
  c.fillRect(20 * s, -5 * s, 2 * s, 6 * s)
  c.save()
  c.rotate(now * rate)
  c.fillStyle = 'rgba(33,37,41,0.9)'
  c.fillRect(-22 * s, -0.8 * s, 44 * s, 1.6 * s)
  c.restore()
  c.fillStyle = '#212529'
  c.fillRect(-1.4 * s, -6 * s, 2.8 * s, 2.4 * s)
  c.restore()
}

function drawBlades(c: CanvasRenderingContext2D, g: Game, p: { x: number; y: number }, w: number, z: number, now: number) {
  const ang = now * turbineRate(g)
  c.save()
  c.translate(p.x + w / 2, p.y + 8 * z)
  c.fillStyle = '#f8f9fa'
  for (let i = 0; i < 3; i++) {
    c.save()
    c.rotate(ang + (i * Math.PI * 2) / 3)
    c.fillRect(-1.1 * z, 1.5 * z, 2.2 * z, 13 * z)
    c.restore()
  }
  c.fillStyle = '#868e96'
  c.beginPath()
  c.arc(0, 0, 2.2 * z, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function drawPigeons(c: CanvasRenderingContext2D, g: Game, f: Facility, p: { x: number; y: number }, w: number, z: number, now: number) {
  const scat = g.flags.pigeon?.id === f.id ? now - g.flags.pigeon.at : 1e9
  const flying = scat >= 0 && scat < 1600
  for (let i = 0; i < 3; i++) {
    const spread = flying ? (i - 1) * scat * 0.05 * z : 0
    const lift = flying ? -Math.min(40 * z, scat * 0.06 * z) : 0
    const x = p.x + w * (0.28 + i * 0.22) + spread
    const y = p.y + 7 * z + lift
    c.fillStyle = '#495057'
    c.fillRect(x, y, 7 * z, 3.2 * z)
    const wing = flying && Math.floor(now / 70 + i) % 2 === 0 ? -4 * z : -1.2 * z
    c.fillStyle = '#868e96'
    c.fillRect(x - 2 * z, y + wing, 3 * z, 2 * z)
    c.fillRect(x + 6 * z, y + wing, 3 * z, 2 * z)
    c.fillStyle = '#fab005'
    c.fillRect(x + 6.4 * z, y + 0.8 * z, 2 * z, 1.3 * z)
  }
}

function drawDonut(c: CanvasRenderingContext2D, p: { x: number; y: number }, w: number, h: number, z: number, now: number) {
  c.save()
  c.translate(p.x + w / 2, p.y + h * 0.34)
  c.rotate(now / 1400)
  c.strokeStyle = '#f783ac'
  c.lineWidth = Math.max(4, 7 * z)
  c.beginPath()
  c.arc(0, 0, 11 * z, 0, Math.PI * 2)
  c.stroke()
  c.strokeStyle = '#fcc2d7'
  c.lineWidth = Math.max(2, 3 * z)
  c.beginPath()
  c.arc(0, 0, 11 * z, 0.4, 2.2)
  c.stroke()
  const colors = ['#ffd43b', '#74c0fc', '#ff8787', '#8ce99a', '#fff', '#da77f2']
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05
    c.fillStyle = colors[i]
    c.fillRect(Math.cos(a) * 11 * z - z, Math.sin(a) * 11 * z - z, 2 * z, 1.4 * z)
  }
  c.restore()
}

function drawBeacon(c: CanvasRenderingContext2D, p: { x: number; y: number }, w: number, z: number, now: number, m: number) {
  const cx = p.x + w / 2
  const y = p.y + 4 * z
  if (nightAt(m)) {
    const ang = (now / 700) % (Math.PI * 2)
    c.save()
    c.translate(cx, y)
    c.rotate(ang)
    c.fillStyle = 'rgba(255, 107, 107, 0.35)'
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(42 * z, -5 * z)
    c.lineTo(42 * z, 5 * z)
    c.fill()
    c.restore()
  }
  const blink = Math.floor(now / 380) % 2 === 0
  c.fillStyle = blink ? '#ff6b6b' : '#5c1a1a'
  c.fillRect(cx - 2 * z, p.y + 2 * z, 4 * z, 4 * z)
  if (blink) {
    c.fillStyle = 'rgba(255, 107, 107, 0.45)'
    c.beginPath()
    c.arc(cx, p.y + 4 * z, 5 * z, 0, Math.PI * 2)
    c.fill()
  }
}
