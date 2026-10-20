// Sticker book. Other features add one with defineSticker() — don't edit STICKERS for that.
import { FOOD, MAX_FLOOR, MIN_FLOOR, isHotel } from './defs'
import type { FacilityKind } from './defs'
import { totalWaiting } from './elevators'
import type { Game } from './state'
import { dayOf, minuteOfDay } from './state'
import { weatherFor } from '../render/sky-fx'
import { bottomFloor, log, topFloor } from './world'

/** Passed into every check. Other features can read the camera from here. */
export interface StickerSnap { watchingSky: boolean }

const NO_SNAP: StickerSnap = { watchingSky: false }

export interface Sticker {
  id: string
  name: string
  emoji: string
  hint: string
  secret: boolean
  check: (g: Game, s: StickerSnap) => boolean
}

/** Register a sticker from another module. Same id twice is ignored. */
export function defineSticker(st: Sticker) {
  if (STICKERS.some((s) => s.id === st.id)) return
  STICKERS.push(st)
}

export function allStickers(): Sticker[] {
  return STICKERS
}

/** Add n to a counter. `newGame` and `deserialize` always provide the map. */
export function bump(g: Game, key: string, n = 1) {
  g.counters[key] = (g.counters[key] ?? 0) + n
}

export function stickerProgress(g: Game) {
  return { have: g.stickers.length, total: STICKERS.length }
}

/** Album copy. A secret stays blank until it is earned. */
export function stickerAlbumText(st: Sticker, earned: boolean): { emoji: string; title: string; label: string } {
  if (earned) return { emoji: st.emoji, title: st.name, label: st.name }
  if (st.secret) return { emoji: '?', title: 'Secret sticker', label: '' }
  return { emoji: '?', title: st.hint, label: st.hint }
}

function sticker(id: string, name: string, emoji: string, hint: string, check: Sticker['check'], secret = false): Sticker {
  return { id, name, emoji, hint, secret, check }
}

const cnt = (g: Game, key: string) => g.counters[key] ?? 0

interface Rooms {
  count: Map<FacilityKind, number>
  condo: boolean
  shop: boolean
  hotel: boolean
  cathedral: boolean
  roaches: boolean
}

// One pass per stepStickers call. Cleared at the start so a later minute sees new rooms.
let rooms: Rooms | null = null
let lifts: { any: boolean; express: boolean } | null = null
let roof: number | null = null
let sky: ReturnType<typeof weatherFor> | null = null

function roomScan(g: Game): Rooms {
  if (rooms) return rooms
  const count = new Map<FacilityKind, number>()
  const found: Rooms = { count, condo: false, shop: false, hotel: false, cathedral: false, roaches: false }
  for (const f of g.facilities.values()) {
    count.set(f.kind, (count.get(f.kind) ?? 0) + 1)
    if (f.kind === 'condo' && f.occupied) found.condo = true
    if (!found.shop && (f.kind === 'shop' || FOOD.includes(f.kind))) found.shop = true
    if (!found.hotel && isHotel(f.kind) && (f.booked || f.occupied)) found.hotel = true
    if (!found.cathedral && f.kind === 'cathedral' && f.floor + f.height - 1 === MAX_FLOOR) found.cathedral = true
    if (f.roaches) found.roaches = true
  }
  rooms = found
  return found
}

function shaftScan(g: Game): { any: boolean; express: boolean } {
  if (lifts) return lifts
  let any = false
  let express = false
  for (const s of g.shafts.values()) {
    if (s.kind === 'expressElevator') express = true
    if (s.kind === 'elevator' || s.kind === 'expressElevator' || s.kind === 'serviceElevator') any = true
  }
  lifts = { any, express }
  return lifts
}

function hasKind(g: Game, kind: FacilityKind) {
  return (roomScan(g).count.get(kind) ?? 0) > 0
}

function countKind(g: Game, kind: FacilityKind) {
  return roomScan(g).count.get(kind) ?? 0
}

function hasLift(g: Game) {
  return shaftScan(g).any
}

function hasExpress(g: Game) {
  return shaftScan(g).express
}

function waiting(g: Game) {
  let n = 0
  for (const s of g.shafts.values()) n += totalWaiting(s)
  return n
}

function carMax(g: Game) {
  let m = 0
  for (const k in g.counters) if (k.startsWith('car:') && g.counters[k] > m) m = g.counters[k]
  return m
}

function condoSold(g: Game) {
  return roomScan(g).condo
}

function shopOpen(g: Game) {
  return roomScan(g).shop
}

function guestIn(g: Game) {
  if (roomScan(g).hotel) return true
  for (const p of g.people.values()) if (p.kind === 'guest' || p.kind === 'vip') return true
  return false
}

function cathedralTop(g: Game) {
  return roomScan(g).cathedral
}

function bugs(g: Game) {
  return roomScan(g).roaches
}

function top(g: Game) {
  if (roof === null) roof = topFloor(g)
  return roof
}

function weather(g: Game) {
  if (!sky) sky = weatherFor(g)
  return sky
}

function clearScans() {
  rooms = null
  lifts = null
  roof = null
  sky = null
}

/** Remember log lines that scroll away, so a fire put out still counts later. */
function noteLog(g: Game) {
  const c = g.counters
  if (c.liftoff && c.fires && c.bombs) return
  const entries = g.log
  if (!entries?.length) return
  const seen = c._log ?? 0
  const last = entries[entries.length - 1]
  if (last.id <= seen) return
  for (let i = entries.length - 1; i >= 0; i--) {
    const m = entries[i]
    if (m.id <= seen) break
    if (!c.liftoff && m.text.includes('LIFTOFF')) c.liftoff = 1
    if (!c.fires && m.text.includes('put out the fire')) c.fires = 1
    if (!c.bombs && m.text.includes('defused the bomb')) c.bombs = 1
  }
  c._log = last.id
}

const minute = (g: Game) => Math.floor(minuteOfDay(g.time))

export const STICKERS: Sticker[] = [
  sticker('first-floor', 'First Floor', '🏗️', 'Build a floor above the lobby', (g) => top(g) >= 1),
  sticker('moving-in', 'Moving In', '🏠', 'Sell your first condo', condoSold),
  sticker('open-for-business', 'Open for Business', '🏪', 'Build a shop', shopOpen),
  sticker('checking-in', 'Checking In', '🛎️', 'A hotel guest stays the night', guestIn),
  sticker('going-up', 'Going Up', '🛗', 'Build an elevator', hasLift),
  sticker('sky-high', 'Sky High', '🌤️', 'Reach floor 30', (g) => top(g) >= 30),
  sticker('cloud-buster', 'Cloud Buster', '☁️', 'Reach floor 60', (g) => top(g) >= 60),
  sticker('top-of-the-world', 'Top of the World', '🌏', 'Reach floor 100', (g) => top(g) >= 100),

  sticker('pizza-party', 'Pizza Party', '🍕', 'Sell 100 pizzas', (g) => cnt(g, 'sold:pizza') >= 100),
  sticker('donut-dozen', 'Donut Dozen', '🍩', 'Build 12 donut shops', (g) => countKind(g, 'donuts') >= 12),
  sticker('full-house', 'Full House', '👥', 'Have 1,000 people', (g) => g.pop >= 1000),
  sticker('rush-hour', 'Rush Hour', '😣', '50 people waiting at once', (g) => waiting(g) >= 50),
  sticker('elevator-hero', 'Elevator Hero', '🦸', 'One elevator car carries 500 riders', (g) => carMax(g) >= 500),

  sticker('blast-off', 'Blast Off', '🚀', 'Launch a rocket', (g) => cnt(g, 'liftoff') > 0),
  sticker('close-encounter', 'Close Encounter', '🛸', 'Spot the UFO', (g, s) => s.watchingSky && g.flags.ufoDay === dayOf(g.time)),
  sticker('wish', 'Wish Upon a Star', '🌠', 'Watch a shooting star', (g) => cnt(g, 'wishes') > 0),
  sticker('rainbow-day', 'Rainbow Day', '🌈', 'See a rainbow', (g) => weather(g).rainbow),
  sticker('snow-day', 'Snow Day', '❄️', 'Wake up to snow', (g) => weather(g).snow),
  sticker('caught-you', 'Caught You!', '🧸', 'Find Huggy', (g) => g.flags.huggyFound != null),
  sticker('brave', 'Brave', '💨', 'Survive a Rush night', (g) => !!g.flags.guided),
  sticker('ho-ho-ho', 'Ho Ho Ho', '🎅', 'Have a Santa day', (g) => g.flags.santaDay >= 0),
  sticker('firefighter', 'Firefighter', '🧯', 'Put a fire out', (g) => cnt(g, 'fires') > 0),
  sticker('bomb-squad', 'Bomb Squad', '💣', 'Defuse a bomb', (g) => cnt(g, 'bombs') > 0),

  sticker('poke-master', 'Poke Master', '👉', 'Poke 100 rooms', (g) => cnt(g, 'pokes') >= 100),
  sticker('dino-tamer', 'Dino Tamer', '🦖', 'Poke the T-Rex 10 times', (g) => cnt(g, 'poke:dinoMuseum') >= 10),
  sticker('shhh', 'Shhh', '🤫', 'Poke the library 5 times', (g) => cnt(g, 'poke:library') >= 5),
  sticker('night-owl', 'Night Owl', '🦉', 'Play at 3:00 AM', (g) => minute(g) === 3 * 60),
  sticker('speedrunner', 'Speedrunner', '⏱️', 'Reach 2 stars in 2 days', (g) => g.stars >= 2 && dayOf(g.time) < 2),

  sticker('fancy-guest', 'Fancy Guest', '🎩', 'Impress a VIP', (g) => g.flags.vip),
  sticker('bookworm', 'Bookworm', '📚', 'Build a library', (g) => hasKind(g, 'library')),
  sticker('movie-night', 'Movie Night', '🍿', 'Build a cinema', (g) => hasKind(g, 'cinema')),
  sticker('all-aboard', 'All Aboard', '🚇', 'Build a metro station', (g) => hasKind(g, 'metro')),
  sticker('legendary', 'Legendary', '🏆', 'Earn the TOWER rating', (g) => g.stars >= 6),
  sticker('on-patrol', 'On Patrol', '👮', 'Build a security office', (g) => hasKind(g, 'security')),
  sticker('express', 'Express Lane', '⚡', 'Build an express elevator', hasExpress),

  sticker('lucky', 'Lucky Number', '🎰', 'Your money ended in 777', (g) => Math.abs(Math.round(g.money)) % 1000 === 777, true),
  sticker('ghost', 'Ghost Town', '👻', 'Nobody was here at noon', (g) => g.people.size === 0 && minute(g) === 12 * 60, true),
  sticker('cathedral', 'Cathedral on Top', '⛪', 'A cathedral on the very top floor', cathedralTop, true),
  sticker('gold', 'Strike Gold', '✨', 'You dug up gold', (g) => g.flags.goldFound, true),
  sticker('piggy', 'Uh Oh', '💸', 'The piggy bank went empty', (g) => g.money < 0, true),
  sticker('deep', 'Mole People', '🕳️', 'You dug all the way down', (g) => bottomFloor(g) <= MIN_FLOOR, true),
  sticker('roach', 'Bug Hunt', '🪳', 'Cockroaches moved in', bugs, true),
]

/** Check every sticker once per game minute. Returns the ones just earned. */
export function stepStickers(g: Game, s: StickerSnap = NO_SNAP): Sticker[] {
  clearScans()
  noteLog(g)
  const have = new Set(g.stickers)
  const earned: Sticker[] = []
  for (const st of STICKERS) {
    if (have.has(st.id)) continue
    if (!st.check(g, s)) continue
    g.stickers.push(st.id)
    have.add(st.id)
    earned.push(st)
    log(g, `📒 New sticker: ${st.emoji} ${st.name}!`, 'star')
  }
  return earned
}

/** Dev console: `api.stickers` in a dev build. */
export const stickersApi = {
  all: allStickers,
  step: stepStickers,
  define: defineSticker,
  bump,
  progress: stickerProgress,
}
