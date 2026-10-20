import { useEffect } from 'react'
import { play } from '../audio'
import { allStickers, stickerAlbumText } from '../game/stickers'
import type { Sticker } from '../game/stickers'
import type { Controller } from './controller'

function ctl(): Controller {
  return (window as unknown as { skytower: Controller }).skytower
}

function tiltOf(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  const d = (h % 11) - 5
  return d === 0 ? 4 : d
}

function StickerFace({ sticker, earned, text }: { sticker: Sticker; earned: boolean; text: ReturnType<typeof stickerAlbumText> }) {
  return (
    <div
      className={`sticker ${earned ? 'earned' : 'locked'}`}
      style={earned ? { transform: `rotate(${tiltOf(sticker.id)}deg)` } : undefined}
      title={text.title}
    >
      <span className="sticker-emoji">{text.emoji}</span>
      {earned && <span className="shine" />}
    </div>
  )
}

const BITS = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#f783ac', '#da77f2', '#ffa94d']
let sounded = ''

/** One toast at a time, so a handful earned together don't pile up. */
export function StickerToasts() {
  const current = ctl().stickerQueue[0]
  useEffect(() => {
    if (!current) return
    if (sounded !== current.id) { sounded = current.id; play('twinkle') }
    const id = current.id
    const t = window.setTimeout(() => {
      const q = ctl().stickerQueue
      if (q[0]?.id === id) q.shift()
      ctl().emit()
    }, 2600)
    return () => window.clearTimeout(t)
  }, [current])
  if (!current) return null
  return (
    <div className="sticker-toast">
      <span className="sticker-confetti" aria-hidden>
        {BITS.map((c, i) => <i key={i} style={{ left: `${6 + i * 13}%`, background: c, animationDelay: `${i * 0.04}s` }} />)}
      </span>
      <StickerFace sticker={current} earned text={stickerAlbumText(current, true)} />
      <div className="sticker-toast-copy">
        <b>{current.name}</b>
        <small>New sticker!</small>
      </div>
    </div>
  )
}

export function StickerAlbum({ onClose }: { onClose: () => void }) {
  const g = ctl().g
  const all = allStickers()
  const have = new Set(g.stickers)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal album" onClick={(e) => e.stopPropagation()}>
        <h2>📒 Sticker Book</h2>
        <p className="album-count">{have.size} / {all.length} stickers</p>
        <div className="album-grid">
          {all.map((st) => {
            const earned = have.has(st.id)
            const text = stickerAlbumText(st, earned)
            return (
              <div key={st.id} className="album-slot">
                <StickerFace sticker={st} earned={earned} text={text} />
                <small>{text.label}</small>
              </div>
            )
          })}
        </div>
        <div className="row">
          <button className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
