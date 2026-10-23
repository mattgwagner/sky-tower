// Concert Hall: one show a day, a different act each day of the week, a ticket payday at curtain,
// an encore, and the Mystery Band surprise. Drawing lives in render/concert.ts.
import { RENT_MULT, SHOP_CAPACITY } from './defs'
import type { Facility, Game } from './state'
import { dayOf, minuteOfDay } from './state'
import { bump, defineSticker } from './stickers'
import { sound } from './sim'
import { earn, facilitiesOf, fx, log } from './world'

export type ActId = 'orchestra' | 'jazzCats' | 'choir' | 'robots' | 'rock' | 'popStar' | 'piano' | 'penguins' | 'dragon'
export interface Act { id: ActId; name: string; emoji: string }

/** dayOf % 7: Monday first, Sunday is the matinee. */
export const LINEUP: Act[] = [
  { id: 'orchestra', name: 'Orchestra', emoji: '🎻' },
  { id: 'jazzCats', name: 'Jazz Cats', emoji: '🎷' },
  { id: 'choir', name: 'Kids\' Choir', emoji: '🎶' },
  { id: 'robots', name: 'Robot Band', emoji: '🤖' },
  { id: 'rock', name: 'Rock Night', emoji: '🎸' },
  { id: 'popStar', name: 'Pop Star', emoji: '🌟' },
  { id: 'piano', name: 'Piano Matinee', emoji: '🎹' },
]
/** One-off acts for a Mystery Band night. */
const MYSTERY_ACTS: Act[] = [
  { id: 'penguins', name: 'The Penguin Band', emoji: '🐧' },
  { id: 'dragon', name: 'Dragon on Drums', emoji: '🐉' },
]
const MATINEE_DAY = 6
export const isMatinee = (day: number) => day % 7 === MATINEE_DAY
const AT = (h: number, m = 0) => h * 60 + m

/** Doors open this long before the curtain. */
export const DOORS = 60
/** Curtain to final bow, encore included. */
export const SHOW_LEN = 100
/** The encore is the last part of the show. */
export const ENCORE_AT = 85
/** At least this many in the seats at curtain for a ticket payday. */
const PAYDAY_CROWD = 20
const TICKETS = 30000

export const showAt = (day: number) => (isMatinee(day) ? AT(14) : AT(19, 30))
/** "7:30pm", "2pm" */
export function showLabel(day: number) {
  const m = showAt(day)
  const h = Math.floor(m / 60) % 12 || 12
  return `${h}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${m >= AT(12) ? 'pm' : 'am'}`
}
export const isMystery = (g: Game, day = dayOf(g.time)) => g.flags.concertMystery === day

export function actFor(g: Game, day = dayOf(g.time)): Act {
  return isMystery(g, day) ? MYSTERY_ACTS[day % MYSTERY_ACTS.length] : LINEUP[day % 7]
}

export type ConcertPhase = 'before' | 'doors' | 'dim' | 'show' | 'encore' | 'over'

/** Where today's show is, and how far into that part (0..1). */
export function concertPhase(g: Game): { phase: ConcertPhase; k: number } {
  const m = minuteOfDay(g.time)
  const s = showAt(dayOf(g.time))
  const part = (a: number, b: number) => (m - a) / (b - a)
  if (m < s - DOORS) return { phase: 'before', k: 0 }
  if (m < s - 5) return { phase: 'doors', k: part(s - DOORS, s - 5) }
  if (m < s) return { phase: 'dim', k: part(s - 5, s) }
  if (m < s + ENCORE_AT) return { phase: 'show', k: part(s, s + ENCORE_AT) }
  if (m < s + SHOW_LEN) return { phase: 'encore', k: part(s + ENCORE_AT, s + SHOW_LEN) }
  return { phase: 'over', k: 0 }
}

/** Open from doors to the final bow. */
export function concertOpen(g: Game) {
  const { phase } = concertPhase(g)
  return phase !== 'before' && phase !== 'over'
}

/** Visitors per hour: the crowd files in during the hour before the curtain, twice as fast for a Mystery Band. */
export function concertPerHour(g: Game) {
  return concertPhase(g).phase === 'doors' ? (isMystery(g) ? 180 : 90) : 0
}

/** How many can get through the doors in one minute. A Mystery Band opens twice as many, or the rush would hit the same cap. */
export const concertDoors = (g: Game) => (isMystery(g) ? 6 : 3)

/** Minutes a visitor stays: to the end of the show, or a little while if they come late. */
export function concertStay(g: Game) {
  return Math.max(15, showAt(dayOf(g.time)) + SHOW_LEN - minuteOfDay(g.time))
}

export const soldOut = (g: Game) => g.flags.concertSoldOut === dayOf(g.time)

/** Curtain: tickets, the marquee, stickers. Encore: the crowd cheers. Called every sim minute. */
export function concertMinute(g: Game, m: number) {
  const day = dayOf(g.time)
  const s = showAt(day)
  const halls = facilitiesOf(g, 'concertHall').filter((f) => f.reachable && !f.fire && f.inside > 0)
  if (m === s + ENCORE_AT) {
    for (const f of halls) fx(g, f.x + f.width / 2, f.floor + f.height, 'ENCORE! ENCORE! 👏', '#ffd43b')
    if (halls.length) sound.play('party')
    return
  }
  if (m !== s) return
  const act = actFor(g, day)
  let news = false
  for (const f of halls) {
    const cx = f.x + f.width / 2
    g.flags.concertActs = (g.flags.concertActs ?? 0) | actBit(act.id)
    bump(g, 'concert:shows')
    if (isMystery(g, day)) bump(g, 'concert:mystery')
    if (f.inside >= (SHOP_CAPACITY.concertHall ?? 90)) {
      g.flags.concertSoldOut = day
      bump(g, 'concert:soldOut')
    }
    if (f.inside >= PAYDAY_CROWD) {
      const v = earn(g, TICKETS * RENT_MULT[f.rent] * (isMystery(g, day) ? 2 : 1))
      f.incomeToday += v
      f.incomeTotal += v
      fx(g, cx, f.floor + f.height, `🎤 +$${v.toLocaleString()}`, '#ff8787')
      sound.play('party')
    }
    if (!news) {
      news = true
      log(g, `🎤 Curtain up! ${act.name} ${act.emoji} is playing the Concert Hall${soldOut(g) ? ' — SOLD OUT!' : ''}`, 'event', f.floor + 1, cx)
    }
  }
}

/** The Mystery Band surprise: tonight's act is a secret one-off. */
export function startMysteryBand(g: Game) {
  const hall = facilitiesOf(g, 'concertHall').find((f) => f.reachable) ?? facilitiesOf(g, 'concertHall')[0]
  if (!hall) return
  const day = dayOf(g.time)
  g.flags.concertMystery = day
  log(g, `🎤 ??? MYSTERY GUEST ??? at the Concert Hall, ${showLabel(day)}. Who could it be?!`, 'event', hall.floor + 1, hall.x + hall.width / 2)
}

/** Room panel line. */
export function concertStatus(g: Game, f: Facility): string | null {
  if (f.fire || !f.reachable) return null
  const day = dayOf(g.time)
  const { phase } = concertPhase(g)
  if (phase === 'show' || phase === 'encore') {
    const act = actFor(g, day)
    return `Now playing: ${act.name} ${act.emoji}${soldOut(g) ? ' · SOLD OUT!' : ''}`
  }
  if (phase === 'over') return 'Show\'s over, see you tomorrow'
  const when = showLabel(day)
  if (isMystery(g, day)) return `Tonight: ??? MYSTERY GUEST ??? at ${when}`
  const act = actFor(g, day)
  return `${isMatinee(day) ? 'Today' : 'Tonight'}: ${act.name} ${act.emoji} at ${when}`
}

const actBit = (id: ActId) => {
  const i = LINEUP.findIndex((a) => a.id === id)
  return i < 0 ? 0 : 1 << i
}
const ALL_SEVEN = (1 << LINEUP.length) - 1
const cnt = (g: Game, key: string) => g.counters[key] ?? 0

defineSticker({ id: 'concert-first', name: 'Opening Night', emoji: '🎤', hint: 'Put on a show at the Concert Hall', secret: false, check: (g) => cnt(g, 'concert:shows') > 0 })
defineSticker({ id: 'concert-sold-out', name: 'SOLD OUT!', emoji: '🎟️', hint: 'Fill every seat in the Concert Hall', secret: false, check: (g) => cnt(g, 'concert:soldOut') > 0 })
defineSticker({ id: 'concert-all-acts', name: 'Seen Them All', emoji: '🎸', hint: 'See all seven Concert Hall acts', secret: false, check: (g) => g.flags.concertActs === ALL_SEVEN })
defineSticker({ id: 'concert-mystery', name: 'Mystery Guest', emoji: '🐧', hint: '', secret: true, check: (g) => cnt(g, 'concert:mystery') > 0 })
