// Glue between the input layer, the simulation and the renderer.
import { play, setMusic, audioPrefs } from '../audio'
import { FACILITIES, STEPS_PER_SECOND, TOWER_WIDTH, TRANSPORTS } from '../game/defs'
import type { FacilityKind, Mode, ToolId, TransportKind } from '../game/defs'
import { afterBuild, evict, sound, step } from '../game/sim'
import type { Facility, Game } from '../game/state'
import { deserialize, newGame, serialize } from '../game/state'
import { buildStarter } from '../game/starter'
import { checkFacility, checkShaft, demolish, occupantAt, paintRun, placeFacility, placeShaft } from '../game/world'
import type { Camera, Overlay } from '../render/renderer'
import { flashBuild, jumpscare, launchFireworks, personPos, render, screenToWorld } from '../render/renderer'
import { registerPoke } from '../render/poke-fx'
import { pokeFacility } from '../game/poke'
import { catchHuggy } from '../game/sim'
import { FH, T } from '../render/sprites'

const LEGACY_KEY = 'skytower.save.v1'
const INDEX_KEY = 'skytower.towers.v2'
const towerKey = (id: string) => `skytower.tower.${id}`

export interface TowerSummary { id: string; name: string; mode: Mode; stars: number; pop: number; money: number; updated: number }

function readIndex(): TowerSummary[] {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as TowerSummary[] } catch { return [] }
}
function writeIndex(list: TowerSummary[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export type Speed = 0 | 1 | 2 | 4 | 8

export class Controller {
  g: Game
  cam: Camera = { x: (TOWER_WIDTH * T) / 2, y: -FH * 4, zoom: 1.5 }
  speed: Speed = 1
  tool: ToolId = 'inspect'
  ov: Overlay = {}
  selected = 0
  person = 0
  towerId = ''
  follow = false
  private lastStars = 1
  private fwYear = 0
  listeners = new Set<() => void>()
  private acc = 0
  private lastFrame = 0
  private lastSaveDay = -1
  private drag: null | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number; moved: boolean } | { kind: 'run'; x0: number; floor: number } | { kind: 'shaft'; x: number; f0: number } | { kind: 'stamp'; floor: number } = null
  private mouse = { sx: 0, sy: 0 }
  private pointers = new Map<number, { x: number; y: number }>()
  private pinch: { d: number; zoom: number } | null = null
  canvas: HTMLCanvasElement | null = null
  W = 0
  H = 0
  confirmDemolish: ((id: number) => void) | null = null
  onBuildFail: ((reason: string) => void) | null = null

  constructor() {
    this.g = newGame('family', false)
    sound.play = (n) => play(n)
  }

  emit() { this.listeners.forEach((l) => l()) }

  // ---------- game lifecycle ----------
  start(mode: Mode, disasters: boolean, starter: boolean, name = '') {
    this.g = newGame(mode, disasters, name || `Tower #${readIndex().length + 1}`)
    this.towerId = newId()
    if (starter) buildStarter(this.g)
    const zoom = starter ? 1.4 : 1.8
    this.cam = { x: (TOWER_WIDTH * T) / 2 - 90 / zoom, y: starter ? -FH * 5 : -FH * 2.5, zoom }
    this.selected = 0
    this.person = 0
    this.lastStars = 1
    this.speed = 1
    this.tool = starter ? 'inspect' : 'lobby'
    setMusic(true)
    this.save()
    this.emit()
  }

  /** Saved towers, most recently played first. Moves a pre-v2 single save into the list. */
  towers(): TowerSummary[] {
    try {
      const old = localStorage.getItem(LEGACY_KEY)
      if (old) {
        const g = deserialize(old)
        const id = newId()
        localStorage.setItem(towerKey(id), old)
        writeIndex([...readIndex(), this.summary(id, g, g.name?.trim() || 'My First Tower')])
        localStorage.removeItem(LEGACY_KEY)
      }
    } catch { /* unreadable old save: leave it alone */ }
    return readIndex().sort((a, b) => b.updated - a.updated)
  }

  private summary(id: string, g: Game, name = g.name?.trim() || 'My Tower'): TowerSummary {
    return { id, name, mode: g.mode, stars: g.stars, pop: g.pop, money: g.money, updated: Date.now() }
  }

  deleteTower(id: string) {
    try {
      localStorage.removeItem(towerKey(id))
      writeIndex(readIndex().filter((t) => t.id !== id))
    } catch { /* blocked storage */ }
  }

  load(id: string): boolean {
    try {
      const s = localStorage.getItem(towerKey(id))
      if (!s) return false
      this.g = deserialize(s)
      this.towerId = id
      this.lastStars = this.g.stars
      afterBuild(this.g)
      setMusic(true)
      this.emit()
      return true
    } catch { return false }
  }

  /** Returns false when the browser refused to store it (usually: storage full). */
  save(): boolean {
    if (!this.towerId) return false
    try {
      localStorage.setItem(towerKey(this.towerId), serialize(this.g))
      const list = readIndex().filter((t) => t.id !== this.towerId)
      writeIndex([...list, this.summary(this.towerId, this.g)])
      return true
    } catch { return false }
  }

  // ---------- frame loop ----------
  frame(now: number, ctx: CanvasRenderingContext2D, dpr: number) {
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0
    this.lastFrame = now
    if (this.speed > 0) {
      this.acc += dt * STEPS_PER_SECOND * this.speed
      let n = Math.min(Math.floor(this.acc), 900)
      this.acc -= Math.floor(this.acc)
      const t0 = performance.now()
      while (n-- > 0) {
        step(this.g)
        if (performance.now() - t0 > 24) { this.acc = 0; break }
      }
    }
    const day = Math.floor(this.g.time / 1440)
    if (day !== this.lastSaveDay) {
      if (this.lastSaveDay >= 0) this.save()
      this.lastSaveDay = day
    }
    if (this.g.stars > this.lastStars) launchFireworks(now, 8)
    this.lastStars = this.g.stars
    const yr = Math.floor(this.g.time / 1440 / 12)
    if (yr > this.fwYear && this.g.time % (1440 * 12) < 90) { this.fwYear = yr; launchFireworks(now, 10) }
    if (this.person) {
      const p = this.g.people.get(this.person)
      if (!p) { this.person = 0; this.follow = false; this.emit() }
      else if (this.follow) {
        const pos = personPos(this.g, p)
        if (pos) {
          this.cam.x += (pos.tile * T - this.cam.x) * Math.min(1, dt * 4)
          this.cam.y += (-(pos.floor + 0.5) * FH - this.cam.y) * Math.min(1, dt * 4)
        }
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ov.selected = this.selected
    this.ov.person = this.person
    this.ov.mouse = this.mouse
    render(ctx, this.W, this.H, this.g, this.cam, this.ov, now, dt)
  }

  // ---------- camera ----------
  clampCam() {
    const c = this.cam
    c.zoom = Math.max(0.3, Math.min(4, c.zoom))
    c.x = Math.max(-200, Math.min(TOWER_WIDTH * T + 200, c.x))
    c.y = Math.max(-102 * FH, Math.min(12 * FH, c.y))
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const before = screenToWorld(this.cam, this.W, this.H, sx, sy)
    this.cam.zoom *= factor
    this.clampCam()
    const after = screenToWorld(this.cam, this.W, this.H, sx, sy)
    this.cam.x += before.wx - after.wx
    this.cam.y += before.wy - after.wy
    this.clampCam()
  }

  focus(floor: number, x: number) {
    this.cam.x = x * T
    this.cam.y = -(floor + 0.5) * FH
    if (this.cam.zoom < 1.2) this.cam.zoom = 1.6
    this.clampCam()
  }

  // ---------- tools ----------
  setTool(t: ToolId) {
    this.tool = t
    this.ov.ghost = undefined
    this.ov.shaftGhost = undefined
    this.ov.bulldoze = undefined
    play('click')
    this.emit()
  }

  private isShaftTool(): TransportKind | null {
    return this.tool in TRANSPORTS ? (this.tool as TransportKind) : null
  }
  private isFacTool(): FacilityKind | null {
    return this.tool in FACILITIES ? (this.tool as FacilityKind) : null
  }

  private hover(sx: number, sy: number) {
    const w = screenToWorld(this.cam, this.W, this.H, sx, sy)
    const tile = Math.floor(w.tile)
    this.ov.ghost = undefined
    this.ov.shaftGhost = undefined
    this.ov.bulldoze = undefined
    this.ov.hover = undefined
    const fk = this.isFacTool()
    const sk = this.isShaftTool()
    if (this.drag?.kind === 'run' && fk) {
      const a = Math.min(this.drag.x0, tile), b = Math.max(this.drag.x0, tile)
      const chk = checkFacility(this.g, fk, a, this.drag.floor, b - a + 1)
      this.ov.ghost = { kind: fk, x: a, floor: this.drag.floor, w: b - a + 1, h: 1, ok: chk.ok, cost: chk.cost, reason: chk.reason }
      return
    }
    if (this.drag?.kind === 'shaft' && sk) {
      const chk = checkShaft(this.g, sk, this.drag.x, this.drag.f0, w.floor)
      this.ov.shaftGhost = { x: this.drag.x, lo: Math.min(this.drag.f0, w.floor), hi: Math.max(this.drag.f0, w.floor), w: TRANSPORTS[sk].width, ok: chk.ok, cost: chk.cost, reason: chk.reason }
      return
    }
    if (fk) {
      const def = FACILITIES[fk]
      const width = def.drag ? 1 : def.width
      const x = Math.round(w.tile - width / 2)
      const chk = checkFacility(this.g, fk, x, w.floor, width)
      this.ov.ghost = { kind: fk, x, floor: w.floor, w: width, h: def.height, ok: chk.ok, cost: chk.cost, reason: chk.reason }
    } else if (sk) {
      const width = TRANSPORTS[sk].width
      const x = Math.round(w.tile - width / 2)
      const top = this.autoShaftTop(sk, x, w.floor)
      const chk = checkShaft(this.g, sk, x, w.floor, top)
      this.ov.shaftGhost = { x, lo: w.floor, hi: top, w: width, ok: chk.ok, cost: chk.cost, reason: chk.reason }
    } else {
      const o = occupantAt(this.g, w.floor, w.tile)
      const id = o.fac?.id ?? o.shaft?.id
      if (this.tool === 'bulldoze' && id) this.ov.bulldoze = { id }
      else if (id) this.ov.hover = id
    }
  }

  private clickAt(sx: number, sy: number) {
    const w = screenToWorld(this.cam, this.W, this.H, sx, sy)
    const fk = this.isFacTool()
    if (fk && !FACILITIES[fk].drag) {
      const def = FACILITIES[fk]
      const x = Math.round(w.tile - def.width / 2)
      const chk = checkFacility(this.g, fk, x, w.floor)
      if (!chk.ok) { this.fail(chk.reason); return }
      placeFacility(this.g, fk, x, w.floor)
      flashBuild(x, w.floor + def.height - 1, def.width, def.height)
      this.built()
      return
    }
    const o = occupantAt(this.g, w.floor, w.tile)
    const id = o.fac?.id ?? o.shaft?.id ?? 0
    if (this.tool === 'bulldoze') {
      if (id) this.confirmDemolish?.(id)
      return
    }
    if (this.tool === 'inspect') {
      const hg = this.g.flags.huggy
      if (hg) {
        const hx = (hg.x * T - this.cam.x) * this.cam.zoom + this.W / 2
        const hy = ((-(hg.floor + 1) * FH + 10) - this.cam.y) * this.cam.zoom + this.H / 2
        if (Math.hypot(hx - sx, hy - sy) < Math.max(16, 9 * this.cam.zoom)) { catchHuggy(this.g); this.emit(); return }
      }
      const pid = this.personAt(sx, sy)
      if (pid) {
        this.person = pid
        this.selected = 0
        this.follow = true
        play('click')
        this.emit()
        return
      }
      this.person = 0
      this.follow = false
      this.selected = id
      if (id) play('click')
      if (o.fac) this.poke(o.fac)
      this.emit()
    }
  }

  /** Tap a room in Look mode and it does something silly. */
  poke(f: Facility) {
    const now = performance.now()
    const sfx = pokeFacility(this.g, f, now)
    if (sfx === null) return
    registerPoke(f.id, now)
    if (sfx === 'scare') jumpscare(now)
    play(sfx)
  }

  /** For a single click with an elevator tool: reach up through every built floor above. */
  private autoShaftTop(sk: TransportKind, x: number, f0: number): number {
    const def = TRANSPORTS[sk]
    let top = f0
    for (let f = f0 + 1; f <= f0 + def.maxSpan - 1; f++) {
      const r = this.g.floors.get(f)
      if (!r) break
      let built = false
      for (let i = x; i < x + def.width; i++) if (r[i] !== -1) built = true
      if (!built) break
      top = f
    }
    if (top === f0) top = f0 + 1
    return top
  }

  private personAt(sx: number, sy: number): number {
    const z = this.cam.zoom
    let best = 0
    let bestD = Math.max(10, 7 * z)
    const test = (pid: number, tile: number, floor: number) => {
      const wx = tile * T
      const wy = -floor * FH - 3 - 5
      const px = (wx - this.cam.x) * z + this.W / 2
      const py = (wy - this.cam.y) * z + this.H / 2
      const d = Math.hypot(px - sx, py - sy)
      if (d < bestD) { bestD = d; best = pid }
    }
    for (const p of this.g.people.values()) {
      if (p.state !== 'walking' && p.state !== 'climbing' && p.state !== 'riding') continue
      const pos = personPos(this.g, p)
      if (pos) test(p.id, pos.tile, pos.floor)
    }
    for (const s of this.g.shafts.values()) {
      const w = TRANSPORTS[s.kind].width
      for (const k in s.q) {
        const q = s.q[k]
        q.up.slice(0, 14).forEach((pid, i) => test(pid, s.x - (3 + i * 3.2) / T, +k))
        q.down.slice(0, 14).forEach((pid, i) => test(pid, s.x + w + (3 + i * 3.2) / T, +k))
      }
    }
    return best
  }

  private fail(reason?: string) {
    play('bad')
    this.onBuildFail?.(reason ?? 'Can\'t build here')
  }

  private built() {
    play('build')
    afterBuild(this.g)
    this.emit()
  }

  doDemolish(id: number) {
    demolish(this.g, id, (pid) => evict(this.g, pid))
    if (this.selected === id) this.selected = 0
    play('boom')
    afterBuild(this.g)
    this.emit()
  }

  // ---------- pointer input ----------
  pointerDown(e: PointerEvent) {
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY })
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom }
      this.drag = null
      return
    }
    const sx = e.offsetX, sy = e.offsetY
    const w = screenToWorld(this.cam, this.W, this.H, sx, sy)
    const fk = this.isFacTool()
    const sk = this.isShaftTool()
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (this.tool === 'inspect' || this.tool === 'bulldoze'))) {
      this.drag = { kind: 'pan', sx, sy, cx: this.cam.x, cy: this.cam.y, moved: false }
      return
    }
    if (fk && FACILITIES[fk].drag) this.drag = { kind: 'run', x0: Math.floor(w.tile), floor: w.floor }
    else if (sk) this.drag = { kind: 'shaft', x: Math.round(w.tile - TRANSPORTS[sk].width / 2), f0: w.floor }
    else if (fk) { this.clickAt(sx, sy); this.drag = { kind: 'stamp', floor: w.floor } }
    this.hover(sx, sy)
  }

  /** Keep placing the current facility while the button is held and dragged sideways. */
  private stamp(sx: number, sy: number, floor: number) {
    const fk = this.isFacTool()
    if (!fk) return
    const def = FACILITIES[fk]
    const w = screenToWorld(this.cam, this.W, this.H, sx, sy)
    const x = Math.round(w.tile - def.width / 2)
    if (checkFacility(this.g, fk, x, floor).ok) {
      placeFacility(this.g, fk, x, floor)
      flashBuild(x, floor + def.height - 1, def.width, def.height)
      this.built()
    }
  }

  pointerMove(e: PointerEvent) {
    const sx = e.offsetX, sy = e.offsetY
    this.mouse = { sx, sy }
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: sx, y: sy })
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const target = this.pinch.zoom * (d / this.pinch.d)
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / this.cam.zoom)
      return
    }
    if (this.drag?.kind === 'pan') {
      const dx = sx - this.drag.sx, dy = sy - this.drag.sy
      if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true
      if (this.drag.moved) this.follow = false
      this.cam.x = this.drag.cx - dx / this.cam.zoom
      this.cam.y = this.drag.cy - dy / this.cam.zoom
      this.clampCam()
      return
    }
    if (this.drag?.kind === 'stamp') this.stamp(sx, sy, this.drag.floor)
    this.hover(sx, sy)
  }

  pointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId)
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return }
    const sx = e.offsetX, sy = e.offsetY
    const d = this.drag
    this.drag = null
    if (!d) return
    const w = screenToWorld(this.cam, this.W, this.H, sx, sy)
    if (d.kind === 'pan') {
      if (!d.moved && e.button === 0) this.clickAt(sx, sy)
      return
    }
    if (d.kind === 'run') {
      const fk = this.isFacTool() as 'lobby' | 'floor'
      const a = Math.min(d.x0, Math.floor(w.tile)), b = Math.max(d.x0, Math.floor(w.tile))
      const chk = checkFacility(this.g, fk, a, d.floor, b - a + 1)
      const before = this.g.money
      paintRun(this.g, fk, a, b, d.floor)
      if (this.g.money === before && this.g.mode !== 'sandbox') this.fail(chk.reason)
      else { flashBuild(a, d.floor, b - a + 1, 1); this.built() }
    }
    if (d.kind === 'shaft') {
      const sk = this.isShaftTool()!
      let f1 = w.floor
      if (f1 === d.f0) f1 = this.autoShaftTop(sk, d.x, d.f0)
      const chk = checkShaft(this.g, sk, d.x, d.f0, f1)
      w.floor = f1
      if (!chk.ok) this.fail(chk.reason)
      else {
        placeShaft(this.g, sk, d.x, d.f0, w.floor)
        flashBuild(d.x, Math.max(d.f0, w.floor), TRANSPORTS[sk].width, Math.abs(d.f0 - w.floor) + 1)
        this.built()
      }
    }
    this.hover(sx, sy)
  }

  wheel(e: WheelEvent) {
    e.preventDefault()
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5 && !e.shiftKey) {
      this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)))
    } else {
      this.cam.x += (e.shiftKey ? e.deltaY : e.deltaX) / this.cam.zoom
      this.clampCam()
    }
  }

  key(e: KeyboardEvent) {
    const pan = 60 / this.cam.zoom
    switch (e.key) {
      case ' ': this.speed = this.speed === 0 ? 1 : 0; this.emit(); e.preventDefault(); break
      case '1': this.speed = 1; this.emit(); break
      case '2': this.speed = 2; this.emit(); break
      case '3': this.speed = 4; this.emit(); break
      case '4': this.speed = 8; this.emit(); break
      case 'Escape': this.setTool('inspect'); this.selected = 0; this.emit(); break
      case 'b': case 'B': this.setTool('bulldoze'); break
      case 'ArrowLeft': case 'a': this.cam.x -= pan; break
      case 'ArrowRight': case 'd': this.cam.x += pan; break
      case 'ArrowUp': case 'w': this.cam.y -= pan; break
      case 'ArrowDown': case 's': this.cam.y += pan; break
      case '+': case '=': this.zoomAt(this.W / 2, this.H / 2, 1.2); break
      case '-': case '_': this.zoomAt(this.W / 2, this.H / 2, 1 / 1.2); break
      case 'm': case 'M': this.ov.moodView = !this.ov.moodView; this.emit(); break
    }
    this.clampCam()
  }

  toggleMusic() { setMusic(!audioPrefs.music); this.emit() }
  toggleSfx() { audioPrefs.sfx = !audioPrefs.sfx; this.emit() }
}
