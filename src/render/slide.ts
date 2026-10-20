// Mega Slide riders (dots whooshing through the tube) and landing puffs.
import { PUFF_MS, puffs, slidePos, slideProgress } from '../game/slide'
import type { Facility, Game } from '../game/state'
import { FH, SHIRTS, SLIDE_TUBE_DY, T } from './sprites'

/** Screen offset inside the facility box for a point on the tube. */
function tubeXY(f: Facility, k: number) {
  const pos = slidePos(f, k)
  return { x: (pos.tile - f.x) * T, y: Math.max(3, (f.floor + f.height - pos.floor) * FH - SLIDE_TUBE_DY) }
}

export function drawSlide(c: CanvasRenderingContext2D, g: Game, f: Facility, p: { x: number; y: number }, z: number, now: number) {
  for (const person of g.people.values()) {
    if (person.state !== 'climbing' || person.legs[person.leg]?.via !== f.id) continue
    const q = tubeXY(f, slideProgress(person, f))
    c.fillStyle = SHIRTS[person.shirt % SHIRTS.length]
    c.beginPath(); c.arc(p.x + q.x * z, p.y + q.y * z, 2.2 * z, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#ffd8a8'
    c.beginPath(); c.arc(p.x + q.x * z, p.y + (q.y - 2.4) * z, 1.4 * z, 0, Math.PI * 2); c.fill()
  }
  const out = tubeXY(f, 1)
  for (let i = puffs.length - 1; i >= 0; i--) {
    const pf = puffs[i]
    const age = (now - pf.born) / PUFF_MS
    if (age > 1) { puffs.splice(i, 1); continue }
    if (pf.fac !== f.id) continue
    c.globalAlpha = 1 - age
    c.fillStyle = pf.splash ? '#74c0fc' : '#ced4da'
    for (let j = 0; j < 5; j++) {
      const a = Math.PI + (j / 4) * Math.PI
      const d = (3 + age * 9) * z
      c.beginPath(); c.arc(p.x + out.x * z + Math.cos(a) * d, p.y + (out.y + 2) * z + Math.sin(a) * d * 0.6, (pf.splash ? 1.2 : 2) * z, 0, Math.PI * 2); c.fill()
    }
    c.globalAlpha = 1
  }
}
