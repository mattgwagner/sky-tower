// Sky wonders: shooting stars at night, a rainbow after the rain, lightning in a storm.
import { play } from '../audio'
import type { Game } from '../game/state'
import { dayOf, minuteOfDay } from '../game/state'

function dayHash(d: number) {
  let x = (d + 1) * 2654435761
  x ^= x >>> 13
  return (x >>> 0) % 100
}

export interface Weather { rain: boolean; snow: boolean; storm: boolean; rainbow: boolean }

/** What the sky is doing right now. Rain is 10am–6pm on a rainy day; a third of rainy days are storms. */
export function weatherFor(g: Game): Weather {
  const d = dayOf(g.time)
  const h = dayHash(d)
  const q = Math.floor(d / 3) % 4
  const m = minuteOfDay(g.time)
  const snow = q === 3 && h < 55
  const rainy = !snow && h < 18
  const rain = rainy && m > 600 && m < 1080
  const storm = rain && h < 6
  const rainbow = rainy && m >= 1080 && m < 1170
  return { rain, snow, storm, rainbow }
}

// ---------- rainbow ----------

const BOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#845ef7', '#da77f2']

/** A rainbow arching behind the tower for an hour and a half after the rain, fading in and out. */
export function drawRainbow(c: CanvasRenderingContext2D, W: number, H: number, g: Game) {
  const w = weatherFor(g)
  if (!w.rainbow) return
  const m = minuteOfDay(g.time)
  const k = m < 1095 ? (m - 1080) / 15 : m > 1155 ? (1170 - m) / 15 : 1
  const cx = W * 0.5, cy = H * 0.95
  const R = Math.max(W, H) * 0.62
  c.save()
  c.globalAlpha = 0.32 * k
  c.lineWidth = Math.max(6, W / 110)
  for (let i = 0; i < BOW.length; i++) {
    c.strokeStyle = BOW[i]
    c.beginPath()
    c.arc(cx, cy, R - i * c.lineWidth, Math.PI, Math.PI * 2)
    c.stroke()
  }
  c.restore()
}

// ---------- shooting stars ----------

interface Streak { x: number; y: number; vx: number; vy: number; born: number; life: number }
let streaks: Streak[] = []
let nextStreak = 0
let wishes = 0

/** Dev hook: how many shooting stars have fallen tonight. */
export function shootingStarCount() { return wishes }

/** Occasional streaks across the night sky. Returns how many stars have fallen tonight. */
export function drawShootingStars(c: CanvasRenderingContext2D, W: number, H: number, now: number, night: number) {
  if (night < 0.6) { streaks = []; nextStreak = now + 4000 + Math.random() * 8000; wishes = 0; return 0 }
  if (now >= nextStreak) {
    nextStreak = now + 7000 + Math.random() * 16000
    const fromLeft = Math.random() < 0.5
    const sp = 900 + Math.random() * 500
    streaks.push({ x: fromLeft ? W * (0.05 + Math.random() * 0.3) : W * (0.65 + Math.random() * 0.3), y: H * (0.02 + Math.random() * 0.2), vx: (fromLeft ? 1 : -1) * sp, vy: sp * 0.42, born: now, life: 650 + Math.random() * 400 })
    wishes++
    play('twinkle')
  }
  for (let i = streaks.length - 1; i >= 0; i--) {
    const s = streaks[i]
    const age = now - s.born
    if (age > s.life) { streaks.splice(i, 1); continue }
    const t = age / 1000
    const x = s.x + s.vx * t, y = s.y + s.vy * t
    const fade = 1 - age / s.life
    const len = 70
    const nx = -s.vx / Math.hypot(s.vx, s.vy), ny = -s.vy / Math.hypot(s.vx, s.vy)
    const grd = c.createLinearGradient(x, y, x + nx * len, y + ny * len)
    grd.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`)
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    c.strokeStyle = grd
    c.lineWidth = 2
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + nx * len, y + ny * len); c.stroke()
    c.fillStyle = `rgba(255,255,230,${fade})`
    c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill()
    // sparkle
    c.fillStyle = `rgba(255,255,255,${0.7 * fade})`
    c.fillRect(x - 5, y - 0.5, 10, 1); c.fillRect(x - 0.5, y - 5, 1, 10)
  }
  return wishes
}

// ---------- lightning ----------

let flashUntil = 0
let bolt: { pts: [number, number][]; until: number } | null = null
let nextBolt = 0

/** Storm days: a bolt forks down from the clouds now and then, with a white flash and thunder. */
export function drawLightning(c: CanvasRenderingContext2D, W: number, H: number, g: Game, now: number) {
  const w = weatherFor(g)
  if (!w.storm) { bolt = null; nextBolt = now + 3000; return }
  if (now >= nextBolt) {
    nextBolt = now + 5000 + Math.random() * 12000
    const x0 = W * (0.1 + Math.random() * 0.8)
    const pts: [number, number][] = [[x0, 0]]
    let x = x0, y = 0
    const yEnd = H * (0.35 + Math.random() * 0.3)
    while (y < yEnd) {
      y += 18 + Math.random() * 30
      x += (Math.random() - 0.5) * 50
      pts.push([x, y])
    }
    bolt = { pts, until: now + 260 }
    flashUntil = now + 180
    play('thunder')
  }
  if (bolt && now < bolt.until) {
    const k = (bolt.until - now) / 260
    c.save()
    c.strokeStyle = `rgba(255,255,255,${0.9 * k})`
    c.lineWidth = 3
    c.shadowColor = '#b197fc'; c.shadowBlur = 18
    c.beginPath()
    bolt.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.stroke()
    c.lineWidth = 1
    c.strokeStyle = `rgba(230,220,255,${k})`
    c.stroke()
    c.restore()
  }
  if (now < flashUntil) {
    c.fillStyle = `rgba(255,255,255,${0.45 * ((flashUntil - now) / 180)})`
    c.fillRect(0, 0, W, H)
  }
}
