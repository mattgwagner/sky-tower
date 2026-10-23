import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { audioPrefs, play, unlockAudio } from '../audio'
import { CATEGORIES, FACILITIES, RENT_LABELS, TRANSPORTS, isCommercial, isConnector, isHotel } from '../game/defs'
import type { Category, FacilityKind, Mode, ToolId, TransportKind } from '../game/defs'
import { bombDecision, setRent, starProgress } from '../game/sim'
import type { Facility, Shaft } from '../game/state'
import type { SurpriseId } from '../game/surprises'
import { clockLabel, dayOf, floorLabel, isWeekend, minuteOfDay, money, quarterOf, yearOf } from '../game/state'
import { addCar, removeCar, resizeShaft, unlocked } from '../game/world'
import { evict } from '../game/sim'
import { holidayBadge } from '../game/holidays'
import { totalWaiting } from '../game/elevators'
import { stickerProgress, stickersApi } from '../game/stickers'
import { Controller } from './controller'
import { StickerAlbum, StickerToasts } from './Stickers'
import { personDoing, personName, personRole, personThought, petLine } from '../game/people-info'
import type { Speed, TowerSummary } from './controller'
import { makePostcard, savePostcard } from './postcard'

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

const ctl = new Controller()
;(window as unknown as { skytower: Controller }).skytower = ctl
if (import.meta.env.DEV) {
  const w = window as unknown as { api: Record<string, unknown> }
  w.api = { stickers: stickersApi }
  void Promise.all([import('../game/world'), import('../game/sim'), import('../render/sky-fx'), import('../game/surprises')]).then(([world, sim, sky, surprises]) => {
    // forceSurprise('ufo') starts that surprise now, for screenshots
    const forceSurprise = (id: SurpriseId) => surprises.forceSurprise(ctl.g, id)
    w.api = { ...world, ...sim, ...sky, stickers: stickersApi, forceSurprise }
  })
}

function useTick(hz: number) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const id = setInterval(force, 1000 / hz)
    const l = () => force()
    ctl.listeners.add(l)
    return () => { clearInterval(id); ctl.listeners.delete(l) }
  }, [hz])
}

export default function App() {
  const [screen, setScreen] = useState<'title' | 'game'>('title')
  return screen === 'title' ? <Title onStart={() => setScreen('game')} /> : <GameScreen onQuit={() => setScreen('title')} />
}

// ---------------- Title ----------------
function Title({ onStart }: { onStart: () => void }) {
  const [mode, setMode] = useState<Mode>('family')
  const [disasters, setDisasters] = useState(false)
  const [starter, setStarter] = useState(true)
  const [name, setName] = useState('')
  const [towers, setTowers] = useState(() => ctl.towers())
  const [doomed, setDoomed] = useState<TowerSummary | null>(null)
  const canContinue = towers.length > 0
  const go = () => { unlockAudio(); play('star'); ctl.start(mode, disasters, starter, name.trim().slice(0, 28)); onStart() }
  const open = (id: string) => { unlockAudio(); if (ctl.load(id)) { play('move'); onStart() } else play('bad') }
  const modes: { id: Mode; name: string; emoji: string; text: string }[] = [
    { id: 'family', name: 'Family', emoji: '👨‍👩‍👧', text: 'Faster money and lower star goals. Great for playing together.' },
    { id: 'classic', name: 'Classic', emoji: '🕹️', text: 'The original challenge: 15,000 people for the Tower rating.' },
    { id: 'sandbox', name: 'Sandbox', emoji: '🧱', text: 'Unlimited money, everything unlocked. Just build!' },
  ]
  return (
    <div className="title">
      <TitleSkyline />
      <div className="title-card">
        <h1 className="logo">SKY<span>TOWER</span></h1>
        <p className="tagline">Build a skyscraper. Keep the elevators moving. Reach the stars.</p>
        {canContinue && (
          <div className="towers">
            <h3>🏙️ My Towers</h3>
            {towers.map((t) => (
              <div key={t.id} className="tower-row">
                <button className="tower-open" onClick={() => open(t.id)}>
                  <b>{t.name}</b>
                  <small>{t.stars >= 6 ? '🏆 TOWER' : '★'.repeat(t.stars)} · 👥 {t.pop.toLocaleString()} · {t.mode === 'sandbox' ? 'Sandbox' : money(t.money)} · {ago(t.updated)}</small>
                </button>
                <button className="tower-del" title="Delete this tower" onClick={() => setDoomed(t)}>🗑️</button>
              </div>
            ))}
          </div>
        )}
        {doomed && (
          <Modal onClose={() => setDoomed(null)}>
            <h2>Delete “{doomed.name}”?</h2>
            <p>This tower will be gone for good.</p>
            <div className="row">
              <button className="danger" onClick={() => { ctl.deleteTower(doomed.id); setTowers(ctl.towers()); setDoomed(null); play('boom') }}>🗑️ Delete it</button>
              <button onClick={() => setDoomed(null)}>Keep it</button>
            </div>
          </Modal>
        )}
        {canContinue && <h3 className="new-head">✨ Start a new tower</h3>}
        <div className="mode-grid">
          {modes.map((m) => (
            <button key={m.id} className={`mode ${mode === m.id ? 'on' : ''}`} onClick={() => { setMode(m.id); setDisasters(m.id === 'classic'); play('click') }}>
              <span className="mode-emoji">{m.emoji}</span>
              <b>{m.name}</b>
              <small>{m.text}</small>
            </button>
          ))}
        </div>
        <label className="name-field">
          <span>🏷️ Name your tower</span>
          <input value={name} maxLength={28} placeholder="The Mega Tower" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="toggles">
          <label><input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} /> Start with a small tower already built</label>
          <label><input type="checkbox" checked={disasters} onChange={(e) => setDisasters(e.target.checked)} /> Disasters (fires 🔥 and bomb threats 💣)</label>
        </div>
        <button className="big primary" onClick={go}>✨ Start building</button>
        <p className="fineprint">Inspired by SimTower (1994). Space pauses · 1–4 set speed · scroll to zoom · drag to look around · build {__BUILD__}</p>
      </div>
    </div>
  )
}

function TitleSkyline() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      const W = (c.width = innerWidth), H = (c.height = innerHeight)
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#1d1a4a'); g.addColorStop(0.6, '#7a3f74'); g.addColorStop(1, '#ff9e6d')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 40; i++) {
        const bw = 50 + ((i * 53) % 60), bh = 80 + ((i * 97) % 320)
        const x = ((i * 83 + t * 0.01) % (W + 200)) - 100
        ctx.fillStyle = i % 3 ? '#16163a' : '#221f4f'
        ctx.fillRect(x, H - bh, bw, bh)
        ctx.fillStyle = 'rgba(255,214,120,0.7)'
        for (let wy = H - bh + 8; wy < H - 8; wy += 12) for (let wx = x + 6; wx < x + bw - 6; wx += 10) if (((wx * 7 + wy * 13) | 0) % 4 === 0) ctx.fillRect(wx, wy, 4, 5)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="title-bg" />
}

// ---------------- Game ----------------
function GameScreen({ onQuit }: { onQuit: () => void }) {
  useTick(5)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const [confirm, setConfirm] = useState<number | null>(null)
  const [help, setHelp] = useState(() => {
    try { if (localStorage.getItem('skytower.seenHelp')) return false; localStorage.setItem('skytower.seenHelp', '1') } catch { return false }
    return true
  })
  const [menu, setMenu] = useState(false)
  const [album, setAlbum] = useState(false)
  const [postcard, setPostcard] = useState<HTMLCanvasElement | null>(null)
  const [cat, setCat] = useState<Category>(ctl.tool === 'lobby' ? 'build' : 'homes')
  const [celebrate, setCelebrate] = useState(0)
  const g = ctl.g

  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      ctl.W = c.clientWidth
      ctl.H = c.clientHeight
      c.width = ctl.W * dpr
      c.height = ctl.H * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(c)
    let raf = 0
    const loop = (t: number) => {
      ctl.frame(t, ctx, window.devicePixelRatio || 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const pd = (e: PointerEvent) => { c.setPointerCapture(e.pointerId); ctl.pointerDown(e) }
    const pm = (e: PointerEvent) => ctl.pointerMove(e)
    const pu = (e: PointerEvent) => ctl.pointerUp(e)
    const wh = (e: WheelEvent) => ctl.wheel(e)
    const kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName !== 'INPUT') ctl.key(e) }
    const cm = (e: Event) => e.preventDefault()
    c.addEventListener('pointerdown', pd)
    c.addEventListener('pointermove', pm)
    c.addEventListener('pointerup', pu)
    c.addEventListener('pointercancel', pu)
    c.addEventListener('wheel', wh, { passive: false })
    c.addEventListener('contextmenu', cm)
    window.addEventListener('keydown', kd)
    const vis = () => { if (document.hidden) ctl.save() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('beforeunload', () => ctl.save())
    ctl.confirmDemolish = (id) => setConfirm(id)
    ctl.onBuildFail = (text) => setToast({ text, id: Date.now() })
    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      c.removeEventListener('pointerdown', pd); c.removeEventListener('pointermove', pm); c.removeEventListener('pointerup', pu)
      c.removeEventListener('pointercancel', pu); c.removeEventListener('wheel', wh); c.removeEventListener('contextmenu', cm)
      window.removeEventListener('keydown', kd); document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  // star celebration
  useEffect(() => {
    if (g.starCelebration) {
      g.starCelebration = 0
      setCelebrate(g.stars)
    }
  })
  useEffect(() => {
    if (!celebrate) return
    const id = setTimeout(() => setCelebrate(0), 4500)
    return () => clearTimeout(id)
  }, [celebrate])

  const bombOpen = g.bomb && !g.bomb.decided
  useEffect(() => { if (bombOpen) ctl.speed = 0 }, [bombOpen])

  const sel = ctl.selected ? g.facilities.get(ctl.selected) ?? g.shafts.get(ctl.selected) : undefined
  const stick = stickerProgress(g)
  const snap = () => { play('shutter'); setMenu(false); setPostcard(makePostcard(g)) }

  return (
    <div className="game">
      <canvas ref={canvasRef} className={`view tool-${ctl.tool}`} />
      <TopBar onHelp={() => setHelp(true)} onMenu={() => setMenu(true)} onSnap={snap} onStickers={() => { play('click'); setAlbum(true) }} />
      <StickerToasts />
      <Palette cat={cat} setCat={setCat} />
      <Goals />
      <News />
      {ctl.person ? <PersonPanel /> : sel && ('cars' in sel ? <ShaftPanel s={sel} /> : <FacPanel f={sel} />)}
      {toast && <div className="toast" key={toast.id}>{toast.text}</div>}
      {confirm !== null && (
        <Modal onClose={() => setConfirm(null)}>
          <h2>Demolish this?</h2>
          <p>{nameOf(confirm)} will be torn down. You won't get your money back.</p>
          <div className="row">
            <button className="danger" onClick={() => { ctl.doDemolish(confirm); setConfirm(null) }}>💥 Demolish</button>
            <button onClick={() => setConfirm(null)}>Keep it</button>
          </div>
        </Modal>
      )}
      {bombOpen && g.bomb && (
        <Modal>
          <h2>💣 Bomb threat!</h2>
          <p>Someone says they hid a bomb in your tower. They want <b>{money(g.bomb.ransom)}</b>.</p>
          <p>Or your Security team can search every floor before it goes off. More security offices search faster.</p>
          <div className="row">
            <button className="primary" onClick={() => { bombDecision(g, false); ctl.speed = 1; ctl.emit() }}>👮 Send Security</button>
            <button onClick={() => { bombDecision(g, true); ctl.speed = 1; ctl.emit() }}>💸 Pay {money(g.bomb.ransom)}</button>
          </div>
        </Modal>
      )}
      {g.bomb && g.bomb.decided && !g.bomb.defused && (
        <div className="bomb-timer">💣 {Math.max(0, Math.round((g.bomb.deadline - g.time) / 60 * 10) / 10)}h left · searched {g.bomb.searched.length}/{g.floors.size} floors</div>
      )}
      {celebrate > 0 && <Celebrate stars={celebrate} />}
      {postcard && (
        <Modal onClose={() => setPostcard(null)}>
          <h2>📸 Postcard</h2>
          <img className="postcard" src={postcard.toDataURL('image/png')} alt={`Postcard of ${g.name ?? 'my tower'}`} />
          <div className="row">
            <button className="primary" onClick={() => { void savePostcard(g, postcard).then((how) => { setToast({ text: how === 'shared' ? '📤 Sent!' : '💾 Saved to your downloads!', id: Date.now() }); setPostcard(null) }) }}>💾 Save picture</button>
            <button onClick={() => setPostcard(null)}>Close</button>
          </div>
        </Modal>
      )}
      {help && <Help onClose={() => setHelp(false)} />}
      {album && <StickerAlbum onClose={() => setAlbum(false)} />}
      {menu && (
        <Modal onClose={() => setMenu(false)}>
          <h2>Menu</h2>
          <div className="col">
            <label className="name-field">
              <span>🏷️ Tower name</span>
              <input value={g.name ?? ''} maxLength={28} placeholder="The Mega Tower" onChange={(e) => { g.name = e.target.value; ctl.emit() }} />
            </label>
            <button onClick={snap}>📸 Postcard of my tower</button>
            <button onClick={() => { setMenu(false); setAlbum(true); play('click') }}>📒 Stickers <span className="sticker-count">{stick.have}/{stick.total}</span></button>
            <button onClick={() => { const ok = ctl.save(); setMenu(false); setToast({ text: ok ? `💾 Saved “${g.name}”!` : '⚠️ Couldn\'t save. Try deleting an old tower.', id: Date.now() }) }}>💾 Save now</button>
            <button onClick={() => { ctl.toggleMusic() }}>{audioPrefs.music ? '🎵 Music: on' : '🎵 Music: off'}</button>
            <button onClick={() => { ctl.toggleSfx() }}>{audioPrefs.sfx ? '🔊 Sounds: on' : '🔇 Sounds: off'}</button>
            <button onClick={() => { g.disasters = !g.disasters; ctl.emit() }}>{g.disasters ? '🔥 Disasters: on' : '🛡️ Disasters: off'}</button>
            <button onClick={() => { ctl.save(); setMenu(false); onQuit() }}>🏠 Save & go to title</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function nameOf(id: number) {
  const f = ctl.g.facilities.get(id)
  if (f) return `The ${FACILITIES[f.kind].name} on ${floorLabel(f.floor)}`
  const s = ctl.g.shafts.get(id)
  if (s) return `This ${TRANSPORTS[s.kind].name}`
  return 'This'
}

function Stars({ n }: { n: number }) {
  if (n >= 6) return <span className="stars tower">🏆 TOWER</span>
  return <span className="stars">{'★'.repeat(n)}<span className="dim">{'★'.repeat(5 - n)}</span></span>
}

function TopBar({ onHelp, onMenu, onSnap, onStickers }: { onHelp: () => void; onMenu: () => void; onSnap: () => void; onStickers: () => void }) {
  const g = ctl.g
  const stick = stickerProgress(g)
  const m = minuteOfDay(g.time)
  const night = m < 6 * 60 || m >= 19 * 60
  const speeds: { s: Speed; label: string; title: string }[] = [
    { s: 0, label: '⏸', title: 'Pause (space)' },
    { s: 1, label: '▶', title: 'Normal (1)' },
    { s: 2, label: '▶▶', title: 'Fast (2)' },
    { s: 4, label: '▶▶▶', title: 'Faster (3)' },
    { s: 8, label: '⏩', title: 'Super fast (4)' },
  ]
  const day = dayOf(g.time) % 3
  const badge = holidayBadge(g)
  return (
    <div className="topbar">
      <div className="brand">{g.name?.trim() ? <span className="tower-name">{g.name}</span> : <>SKY<span>TOWER</span></>}</div>
      <Stars n={g.stars} />
      <div className={`stat money ${g.money < 0 ? 'neg' : ''}`} title="Money">💰 {money(g.money)}</div>
      <div className="stat" title="Population">👥 {g.pop.toLocaleString()}</div>
      <div className="stat clock" title="Time">
        {night ? '🌙' : '☀️'} {clockLabel(g.time)}
        <small>{isWeekend(g.time) ? 'Weekend' : `Weekday ${day + 1}`} · Q{quarterOf(g.time)} · Year {yearOf(g.time)}</small>
      </div>
      {badge && <div className="stat holiday" title="Today's holiday">{badge}</div>}
      <div className="speeds">
        {speeds.map((x) => (
          <button key={x.s} title={x.title} className={ctl.speed === x.s ? 'on' : ''} onClick={() => { ctl.speed = x.s; play('click'); ctl.emit() }}>{x.label}</button>
        ))}
      </div>
      <div className="spacer" />
      <button className={`icon ${ctl.ov.moodView ? 'on' : ''}`} title="Happiness view (M)" onClick={() => { ctl.ov.moodView = !ctl.ov.moodView; ctl.emit() }}>😊</button>
      <button className="icon" title="Postcard of my tower" onClick={onSnap}>📸</button>
      <button className="icon" title={audioPrefs.music ? 'Music on' : 'Music off'} onClick={() => ctl.toggleMusic()}>{audioPrefs.music ? '🎵' : '🎶'}</button>
      <button className="sticker-btn" title="Sticker book" onClick={onStickers}>📒 <span className="sticker-count">{stick.have}/{stick.total}</span></button>
      <button className="icon" title="How to play" onClick={onHelp}>❓</button>
      <button className="icon" title="Menu" onClick={onMenu}>☰</button>
    </div>
  )
}

function toolInfo(t: ToolId) {
  if (t in FACILITIES) { const d = FACILITIES[t as FacilityKind]; return { name: d.name, emoji: d.emoji, cost: d.cost, stars: d.stars, blurb: d.blurb, per: d.drag ? '/tile' : '' } }
  const d = TRANSPORTS[t as TransportKind]
  return { name: d.name, emoji: d.emoji, cost: d.cost, stars: d.stars, blurb: d.blurb, per: '+' }
}

const TOOL_GROUPS: Record<Category, { label?: string; tools: ToolId[] }[]> = {
  build: [
    { label: 'Floors', tools: ['lobby', 'floor'] },
    { label: 'Getting around', tools: ['elevator', 'stairs', 'firePole', 'megaSlide', 'escalator', 'expressElevator', 'serviceElevator', 'partyElevator'] },
    { label: 'Roof', tools: ['observatory', 'helipad', 'turbine', 'waterTower', 'giantDonut', 'crown', 'dome', 'antenna'] },
  ],
  homes: [{ tools: ['office', 'condo'] }],
  hotel: [
    { label: 'Rooms', tools: ['hotelSingle', 'hotelTwin', 'hotelSuite'] },
    { label: 'Staff', tools: ['housekeeping'] },
  ],
  food: [
    { label: 'Breakfast & treats', tools: ['donuts', 'pancakes', 'iceCream', 'candy'] },
    { label: 'Lunch & dinner', tools: ['fastFood', 'tacos', 'pizza', 'fazbear', 'restaurant', 'sushi'] },
  ],
  shops: [
    { label: 'Stores', tools: ['shop', 'bookstore', 'library'] },
    { label: 'Shows', tools: ['cinema', 'partyHall'] },
  ],
  fun: [
    { label: 'Chill out', tools: ['park', 'arcade', 'pool', 'aquarium'] },
    { label: 'Get moving', tools: ['trampoline', 'climbing', 'miniGolf', 'bowling', 'rollerRink'] },
    { label: 'Wow!', tools: ['dinoMuseum', 'rocketPad', 'zoo'] },
    { label: 'Spooky 🕯️', tools: ['hauntedHouse', 'toyFactory', 'indigoPark'] },
  ],
  services: [
    { label: 'Keep it safe', tools: ['security', 'medical'] },
    { label: 'Keep it running', tools: ['recycling', 'parking', 'metro'] },
    { label: 'The very top', tools: ['cathedral'] },
  ],
}

function Palette({ cat, setCat }: { cat: Category; setCat: (c: Category) => void }) {
  const [hoverTool, setHoverTool] = useState<ToolId | null>(null)
  const g = ctl.g
  const info = hoverTool ? toolInfo(hoverTool) : ctl.tool !== 'inspect' && ctl.tool !== 'bulldoze' ? toolInfo(ctl.tool) : null
  const current = CATEGORIES.find((c) => c.id === cat)!
  const groups = TOOL_GROUPS[cat]
  const lockedCount = (id: Category) => TOOL_GROUPS[id].flatMap((grp) => grp.tools).filter((t) => !unlocked(g, toolInfo(t).stars)).length
  return (
    <div className="palette">
      <div className="tools-top">
        <button className={`tool-btn small ${ctl.tool === 'inspect' ? 'on' : ''}`} onClick={() => ctl.setTool('inspect')} title="Look, poke & select (Esc)">👆<span>Look</span></button>
        <button className={`tool-btn small ${ctl.tool === 'bulldoze' ? 'on danger' : ''}`} onClick={() => ctl.setTool('bulldoze')} title="Demolish (B)">💥<span>Demolish</span></button>
      </div>
      <div className="cats" role="tablist" aria-label="What to build">
        {CATEGORIES.map((c) => {
          const n = TOOL_GROUPS[c.id].reduce((a, grp) => a + grp.tools.length, 0)
          const locked = lockedCount(c.id)
          return (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={`cat ${c.id} ${cat === c.id ? 'on' : ''}`} onClick={() => { setCat(c.id); play('click') }} title={c.blurb}>
              <span className="cat-emoji">{c.emoji}</span>
              <span className="cat-name">{c.name}</span>
              <small>{locked ? `${n - locked} of ${n}` : n} {n === 1 ? 'thing' : 'things'}</small>
            </button>
          )
        })}
      </div>
      <div className="tool-pane">
        <div className="cat-head">
          <b>{current.emoji} {current.name}</b>
          <p>{current.blurb}</p>
        </div>
        {groups.map((grp, gi) => (
          <div key={gi} className="tool-group">
            {grp.label && <div className="group-label">{grp.label}</div>}
            <div className="tool-list">
              {grp.tools.map((t) => {
                const i = toolInfo(t)
                const locked = !unlocked(g, i.stars)
                return (
                  <button key={t} className={`tool ${ctl.tool === t ? 'on' : ''} ${locked ? 'locked' : ''}`} disabled={locked}
                    onMouseEnter={() => setHoverTool(t)} onMouseLeave={() => setHoverTool(null)}
                    onClick={() => ctl.setTool(t)}>
                    <span className="tool-emoji">{locked ? '🔒' : i.emoji}</span>
                    <span className="tool-name">{i.name}</span>
                    <span className="tool-cost">{locked ? `Unlocks at ${i.stars}★` : `${money(i.cost)}${i.per === '/tile' ? '/tile' : ''}`}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {info && <div className="tool-tip"><b>{info.emoji} {info.name}</b><p>{info.blurb}</p></div>}
      </div>
    </div>
  )
}

function Goals() {
  const g = ctl.g
  const p = starProgress(g)
  const [open, setOpen] = useState(true)
  if (!p) return <div className="goals"><b>🏆 You earned the TOWER rating!</b><p>Keep building — your tower is legendary.</p></div>
  const pct = Math.min(100, (g.pop / p.pop) * 100)
  const next = g.stars === 5 ? 'TOWER' : `${g.stars + 1}★`
  return (
    <div className={`goals ${open ? '' : 'closed'}`} onClick={() => setOpen(!open)}>
      <div className="goal-head"><b>Next: {next}</b><span>{open ? '▾' : '▸'}</span></div>
      {open && (
        <>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
          <div className={`need ${p.popDone ? 'done' : ''}`}>{p.popDone ? '✅' : '⬜'} Population {g.pop.toLocaleString()} / {p.pop.toLocaleString()}</div>
          {p.needs.map((n) => <div key={n.id} className={`need ${n.done ? 'done' : ''}`}>{n.done ? '✅' : '⬜'} {n.label}</div>)}
          <Hint />
        </>
      )}
    </div>
  )
}

function Hint() {
  const g = ctl.g
  const lobbies = [...g.facilities.values()].some((f) => f.kind === 'lobby' && f.floor === 0)
  let hint = ''
  if (!lobbies) hint = 'Pick 🏗️ Basics → Lobby and drag along the ground to start.'
  else if (g.shafts.size === 0 && ![...g.facilities.values()].some((f) => f.kind === 'stairs')) hint = 'Add an 🛗 Elevator: click and drag up from the lobby.'
  else if (![...g.facilities.values()].some((f) => f.kind === 'office' || f.kind === 'condo')) hint = 'Build Offices and Condos on upper floors to bring in people.'
  else if ([...g.facilities.values()].some((f) => !f.reachable && f.kind !== 'parking' && f.kind !== 'lobby')) hint = 'Rooms flashing 🚫 can\'t be reached. Connect them with an elevator or stairs.'
  else if (![...g.facilities.values()].some((f) => FACILITIES[f.kind].category === 'food')) hint = 'Office workers need lunch! Pick 🍕 Food and build a place to eat.'
  else if ([...g.shafts.values()].some((s) => totalWaiting(s) > 25)) hint = 'Long lines! Click an elevator and add more cars.'
  else if (![...g.facilities.values()].some((f) => FACILITIES[f.kind].category === 'fun')) hint = 'Try the 🎪 Fun tab: a trampoline park, an aquarium with a shark, even a rocket!'
  if (!hint) return null
  return <div className="hint">💡 {hint}</div>
}

function News() {
  const g = ctl.g
  const items = g.log.slice(-5).reverse()
  return (
    <div className="news">
      {items.map((m) => (
        <button key={m.id} className={`msg ${m.kind}`} onClick={() => { if (m.floor !== undefined) ctl.focus(m.floor, m.x ?? 120) }}>
          <small>{clockLabel(m.t)}</small> {m.text}
        </button>
      ))}
    </div>
  )
}

function happyFace(h: number) { return h >= 60 ? '😊' : h >= 35 ? '😐' : '😠' }

function FacPanel({ f }: { f: Facility }) {
  const g = ctl.g
  const def = FACILITIES[f.kind]
  const tenant = f.kind === 'office' || f.kind === 'condo'
  const hasRent = tenant || isHotel(f.kind) || isCommercial(f.kind)
  let status = ''
  if (tenant) status = f.occupied ? (f.kind === 'office' ? 'Rented' : 'Sold — family lives here') : f.kind === 'office' ? 'For rent' : 'For sale'
  else if (isHotel(f.kind)) status = f.roaches ? '🪳 Cockroaches!' : f.booked ? 'Guests checked in' : f.dirty ? 'Needs cleaning' : 'Ready for guests'
  else if (isCommercial(f.kind)) status = f.fire ? 'On fire!' : f.reachable ? 'Open for business' : 'Closed — no way to get here'
  else if (f.kind === 'turbine') status = 'Making power'
  else status = f.reachable ? 'Working' : 'Not connected'
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="big-emoji">{def.emoji}</span>
        <div><b>{def.name}</b><small>{floorLabel(f.floor)}{f.height > 1 ? `–${floorLabel(f.floor + f.height - 1)}` : ''}</small></div>
        <button className="x" onClick={() => { ctl.selected = 0; ctl.emit() }}>✕</button>
      </div>
      <div className="status">{status}</div>
      {f.kind !== 'lobby' && !isConnector(f.kind) && (
        <div className="happy">
          <span>{happyFace(f.happiness)}</span>
          <div className="bar"><div style={{ width: `${f.happiness}%`, background: f.happiness >= 60 ? '#40c057' : f.happiness >= 35 ? '#fab005' : '#fa5252' }} /></div>
          <small>{f.happiness}%</small>
        </div>
      )}
      {f.complaints.length > 0 && <ul className="complaints">{f.complaints.map((c) => <li key={c}>{c}</li>)}</ul>}
      <div className="facts">
        {f.inside > 0 && <span>👥 {f.inside} inside</span>}
        {isCommercial(f.kind) && <span>🧾 {f.customersToday} today · {f.customersYesterday} yesterday</span>}
        {f.kind === 'megaSlide' && <span>🛝 {floorLabel(f.floor + f.height)} → {floorLabel(f.floor)} · Rides today: {f.rides ?? 0}</span>}
        {f.incomeTotal > 0 && <span>💰 earned {money(f.incomeTotal)}</span>}
      </div>
      {hasRent && f.kind !== 'parking' && (
        <div className="rent">
          <small>{f.kind === 'condo' ? 'Price' : isCommercial(f.kind) ? 'Prices' : 'Rent'}</small>
          <div className="seg">
            {RENT_LABELS.map((l, i) => (
              <button key={l} className={f.rent === i ? 'on' : ''} onClick={() => { setRent(g, f, i as 0 | 1 | 2 | 3); play('click'); ctl.emit() }}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <button className="danger wide" onClick={() => ctl.confirmDemolish?.(f.id)}>💥 Demolish</button>
    </div>
  )
}

function ShaftPanel({ s }: { s: Shaft }) {
  const g = ctl.g
  const def = TRANSPORTS[s.kind]
  const [err, setErr] = useState('')
  const ev = (pid: number) => evict(g, pid)
  const act = (fn: () => string | null | boolean) => {
    const r = fn()
    if (typeof r === 'string') { setErr(r); play('bad') }
    else if (r === false) { setErr('Not possible right now'); play('bad') }
    else { setErr(''); play('build') }
    g.buildVersion++
    ctl.emit()
  }
  const floors = useMemo(() => { const a: number[] = []; for (let f = s.hi; f >= s.lo; f--) a.push(f); return a }, [s.hi, s.lo])
  const waiting = totalWaiting(s)
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="big-emoji">{def.emoji}</span>
        <div><b>{def.name}</b><small>{floorLabel(s.lo)} to {floorLabel(s.hi)}</small></div>
        <button className="x" onClick={() => { ctl.selected = 0; ctl.emit() }}>✕</button>
      </div>
      <div className={`status ${waiting > 25 ? 'warn' : ''}`}>{waiting} people waiting {waiting > 25 ? '— add cars!' : ''}</div>
      <div className="row between">
        <span>Cars: <b>{s.cars.length}</b>/8</span>
        <div className="row">
          <button onClick={() => act(() => removeCar(g, s, ev))}>−</button>
          <button className="primary" onClick={() => act(() => addCar(g, s))}>+ {money(def.carCost)}</button>
        </div>
      </div>
      <div className="row between">
        <span>Top</span>
        <div className="row"><button onClick={() => act(() => resizeShaft(g, s, 'top', -1, ev))}>▼</button><button onClick={() => act(() => resizeShaft(g, s, 'top', 1, ev))}>▲</button></div>
      </div>
      <div className="row between">
        <span>Bottom</span>
        <div className="row"><button onClick={() => act(() => resizeShaft(g, s, 'bottom', -1, ev))}>▲</button><button onClick={() => act(() => resizeShaft(g, s, 'bottom', 1, ev))}>▼</button></div>
      </div>
      {err && <div className="err">{err}</div>}
      {s.kind !== 'expressElevator' && (
        <>
          <small className="label">Stops (tap to skip a floor)</small>
          <div className="stops">
            {floors.map((f) => (
              <button key={f} className={s.stops[f] ? 'on' : ''} onClick={() => { s.stops[f] = !s.stops[f]; g.buildVersion++; play('click'); ctl.emit() }}>{f === 0 ? 'L' : f < 0 ? `B${-f}` : f}</button>
            ))}
          </div>
        </>
      )}
      <button className="danger wide" onClick={() => ctl.confirmDemolish?.(s.id)}>💥 Demolish</button>
    </div>
  )
}

function PersonPanel() {
  const g = ctl.g
  const p = g.people.get(ctl.person)
  if (!p) return null
  const face = p.mood > 55 ? '😠' : p.mood > 30 ? '😟' : '😊'
  return (
    <div className="panel person">
      <div className="panel-head">
        <span className="big-emoji">{p.kind === 'vip' ? '🎩' : p.kind === 'guard' ? '👮' : p.kind === 'maid' ? '🧹' : p.kind === 'guest' ? '🧳' : p.kind === 'visitor' ? '🛍️' : p.kind === 'resident' ? '🏠' : '💼'}</span>
        <div><b>{personName(p)}</b><small>{personRole(g, p)}</small></div>
        <button className="x" onClick={() => { ctl.person = 0; ctl.follow = false; ctl.emit() }}>✕</button>
      </div>
      <div className="thought">{face} “{personThought(g, p)}”</div>
      <div className="status">{personDoing(g, p)}</div>
      {petLine(p) && <div className="status">{petLine(p)}</div>}
      <button className={`wide ${ctl.follow ? 'on' : ''}`} onClick={() => { ctl.follow = !ctl.follow; ctl.emit() }}>{ctl.follow ? '📍 Following — tap to stop' : '📍 Follow'}</button>
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function Celebrate({ stars }: { stars: number }) {
  const bits = useMemo(() => Array.from({ length: 80 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 1.5, color: ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#f783ac'][i % 5], rot: Math.random() * 360 })), [])
  return (
    <div className="celebrate">
      {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, background: b.color, transform: `rotate(${b.rot}deg)` }} />)}
      <div className="celebrate-card">
        <div className="celebrate-stars">{stars >= 6 ? '🏆' : '★'.repeat(stars)}</div>
        <h2>{stars >= 6 ? 'TOWER RATING!' : `${stars}-Star Tower!`}</h2>
        <p>{stars >= 6 ? 'You built a legendary skyscraper!' : 'New buildings unlocked. Check the toolbar!'}</p>
      </div>
    </div>
  )
}

function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2>How to play</h2>
      <div className="help">
        <p><b>1. Lobby first.</b> Choose 🏗️ Basics → Lobby and drag along the ground. Everyone enters through it.</p>
        <p><b>2. Elevators.</b> Choose 🛗 Elevator, then click and <i>drag up</i> from the lobby. One elevator reaches 30 floors. Click it later to add more cars.</p>
        <p><b>3. Bring people in.</b> Offices 💼 pay rent each quarter. Condos 🏠 sell for a big chunk of money. Rooms flashing 🚫 can't be reached yet.</p>
        <p><b>4. Keep them happy.</b> Watch the colors: <span style={{ color: '#ff9f43' }}>orange</span> and <span style={{ color: '#ff2d2d' }}>red</span> people are fed up with waiting. Press 😊 to see how every room feels. Unhappy tenants move out.</p>
        <p><b>5. Food & fun.</b> Workers want lunch 🍔 and families love breakfast 🥞. Find them all in the 🍕 Food tab. Visitors come for restaurants, shops, and movies. More people means more customers.</p>
        <p><b>6. Hotels.</b> Guests check in at night and leave in the morning. Housekeeping 🧹 cleans rooms. Skip cleaning and you'll get cockroaches 🪳!</p>
        <p><b>7. Go higher.</b> Put sky lobbies on floors 15, 30, 45… then use ⚡ Express elevators to zip between them.</p>
        <p><b>🪩 Party Elevator.</b> Works just like an elevator, but there's a DJ inside and everyone dances. Tap it in Look mode!</p>
        <p><b>👆 Poke things!</b> In Look mode, tap any room to see what it does. The T-Rex roars, the shark splashes, the ghosts say boo. Press 📸 to make a postcard of your tower.</p>
        <p><b>8. Fun 🎪.</b> A trampoline park, bowling, a pool, an aquarium with a shark, a haunted house and a dino museum. Put a 🚀 Rocket Pad on a roof and watch it blast off at noon! Name your tower in the ☰ menu.</p>
        <p><b>9. Stars.</b> Hit the population goal and build what the goal card asks for. Each star unlocks new buildings. The Cathedral on top earns the TOWER rating.</p>
        <p className="keys">Controls: drag to move around · scroll or pinch to zoom · Space pause · 1–4 speed · B demolish · Esc stop building · M happiness view</p>
      </div>
      <button className="primary wide" onClick={onClose}>Let's build!</button>
    </Modal>
  )
}
