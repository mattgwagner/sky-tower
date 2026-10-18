// Postcards: a framed snapshot of the whole tower you can save or share.
import { TOWER_WIDTH } from '../game/defs'
import type { Game } from '../game/state'
import { clockLabel, quarterOf, yearOf } from '../game/state'
import { render } from '../render/renderer'
import { FH, T } from '../render/sprites'

const W = 1600, H = 1000
const FRAME = 28
const BAND = 118

function towerBounds(g: Game) {
  let lo = Infinity, hi = -Infinity, x0 = Infinity, x1 = -Infinity
  for (const [f, row] of g.floors) {
    let any = false
    for (let i = 0; i < row.length; i++) if (row[i] !== -1) { any = true; x0 = Math.min(x0, i); x1 = Math.max(x1, i) }
    if (any) { lo = Math.min(lo, f); hi = Math.max(hi, f) }
  }
  if (lo === Infinity) return { lo: 0, hi: 4, x0: TOWER_WIDTH / 2 - 30, x1: TOWER_WIDTH / 2 + 30 }
  return { lo, hi, x0, x1 }
}

/** Draw the tower into a postcard canvas and hand it back. */
export function makePostcard(g: Game): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const c = out.getContext('2d')!
  const picW = W - FRAME * 2, picH = H - FRAME * 2 - BAND
  const b = towerBounds(g)
  const spanX = (b.x1 - b.x0 + 1) * T + 60
  const spanY = (b.hi - b.lo + 1) * FH + FH * 3
  const zoom = Math.max(0.3, Math.min(3, Math.min(picW / spanX, picH / spanY)))
  const cam = { x: ((b.x0 + b.x1 + 1) / 2) * T, y: -((b.hi + 1 + b.lo) / 2) * FH + FH * 0.6, zoom }
  c.save()
  c.translate(FRAME, FRAME)
  c.beginPath(); c.rect(0, 0, picW, picH); c.clip()
  render(c, picW, picH, g, cam, {}, performance.now(), 0)
  c.restore()
  // frame
  c.fillStyle = '#fff8e7'
  c.fillRect(0, 0, W, FRAME); c.fillRect(0, H - FRAME - BAND, W, FRAME + BAND)
  c.fillRect(0, 0, FRAME, H); c.fillRect(W - FRAME, 0, FRAME, H)
  c.strokeStyle = '#e9dcc0'; c.lineWidth = 4
  c.strokeRect(FRAME - 2, FRAME - 2, picW + 4, picH + 4)
  // caption band
  const name = (g.name ?? '').trim() || 'My Tower'
  const by = H - FRAME - BAND
  c.fillStyle = '#1b1033'
  c.font = '900 44px "Nunito", sans-serif'
  c.textBaseline = 'alphabetic'
  c.fillText(name, FRAME + 10, by + 58)
  const stars = g.stars >= 6 ? '🏆 TOWER' : '★'.repeat(g.stars) + '☆'.repeat(5 - g.stars)
  c.fillStyle = '#b07a00'
  c.font = '700 30px "Nunito", sans-serif'
  c.fillText(stars, FRAME + 10, by + 100)
  c.fillStyle = '#5a5470'
  c.font = '700 26px "Nunito", sans-serif'
  const line = `👥 ${g.pop.toLocaleString()} people · ${b.hi - b.lo + 1} floors · Year ${yearOf(g.time)}, Q${quarterOf(g.time)} · ${clockLabel(g.time)}`
  c.textAlign = 'right'
  c.fillText(line, W - FRAME - 10, by + 100)
  // stamp
  c.save()
  c.translate(W - FRAME - 92, by + 36)
  c.rotate(-0.12)
  c.strokeStyle = '#c92a2a'; c.lineWidth = 3
  c.strokeRect(-70, -26, 140, 52)
  c.fillStyle = '#c92a2a'
  c.font = '900 15px "Press Start 2P", monospace'
  c.textAlign = 'center'
  c.fillText('SKY TOWER', 0, -2)
  c.font = '700 14px "Nunito", sans-serif'
  c.fillText('GREETINGS FROM', 0, 16)
  c.restore()
  c.textAlign = 'left'
  return out
}

function fileName(g: Game) {
  const base = ((g.name ?? '').trim() || 'my-tower').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base || 'my-tower'}-postcard.png`
}

async function toBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('no blob'))), 'image/png'))
}

/** Share sheet where there is one (iPad, phones), otherwise a download. Returns what happened. */
export async function savePostcard(g: Game, cv: HTMLCanvasElement): Promise<'shared' | 'downloaded'> {
  const blob = await toBlob(cv)
  const file = new File([blob], fileName(g), { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${(g.name ?? '').trim() || 'My Tower'} — Sky Tower` })
      return 'shared'
    } catch { /* user closed the sheet: fall through to a download */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
