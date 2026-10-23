// Rainforest Frogs: the 7pm dusk chorus, rainy days, and the Frog Chorus sticker.
import { weatherFor } from '../render/sky-fx'
import type { Facility, Game } from './state'
import { dayOf, minuteOfDay } from './state'
import { defineSticker } from './stickers'
import { facilitiesOf, log } from './world'

export const CHORUS_AT = 19 * 60
const CHORUS_MINUTES = 20

/** True while the frogs are singing tonight. */
export function chorusOn(g: Game): boolean {
  const m = minuteOfDay(g.time)
  return g.flags.frogChorus === dayOf(g.time) && m >= CHORUS_AT && m < CHORUS_AT + CHORUS_MINUTES
}

/** Rain outside makes the frogs hoppy. weatherFor only rains 10am to 6pm. */
export function frogsRainy(g: Game): boolean {
  return weatherFor(g).rain
}

/** The dusk chorus starts at 7pm, once a day, if there's a Rainforest. */
export function frogsHour(g: Game, m: number) {
  if (m !== CHORUS_AT) return
  const day = dayOf(g.time)
  if (g.flags.frogChorus === day) return
  const rf = facilitiesOf(g, 'rainforest').find((f) => f.reachable) ?? facilitiesOf(g, 'rainforest')[0]
  if (!rf) return
  g.flags.frogChorus = day
  log(g, 'The frogs are singing at the Rainforest! 🐸🎶', 'event', rf.floor, rf.x + rf.width / 2)
}

/** Room panel line, or null to keep the usual one. */
export function rainforestStatus(g: Game, f: Facility): string | null {
  if (f.fire || !f.reachable) return null
  if (frogsRainy(g)) return 'Rainy day! The frogs LOVE it.'
  return null
}

defineSticker({ id: 'frog-chorus', name: 'Frog Chorus', emoji: '🐸', hint: 'Hear the frogs sing at 7pm', secret: false, check: chorusOn })
