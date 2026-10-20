// Sky Zoo: on the days surprises.ts draws it, a monkey escapes, hides on a room, and can be caught.
import { isConnector } from './defs'
import type { Facility, Game } from './state'
import { dayOf } from './state'
import { sound } from './sim'
import { earn, facilitiesOf, fx, log } from './world'

const CATCH_REWARD = 2000
const HOME_MINUTES = 30

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function roomsFor(g: Game, zoo: Facility) {
  return [...g.facilities.values()].filter((f) =>
    f.id !== zoo.id && f.width >= 4 && f.kind !== 'lobby' && !isConnector(f.kind) && f.kind !== 'rocketPad')
}

function dropPeel(g: Game, spot: { floor: number; x: number }) {
  const peels = g.flags.peels ?? []
  peels.push({ floor: spot.floor, x: spot.x, day: dayOf(g.time) })
  g.flags.peels = peels
}

function sitMonkey(g: Game, zoo: Facility): boolean {
  const rooms = roomsFor(g, zoo)
  if (!rooms.length) return false
  const r = pick(rooms)
  g.flags.monkey = {
    floor: r.floor + r.height - 1,
    x: r.x + 1.5 + Math.random() * (r.width - 3),
    since: g.time,
  }
  return true
}

/** True when the loose monkey is sitting on this room. */
export function monkeyOn(g: Game, f: Facility): boolean {
  const m = g.flags.monkey
  if (!m) return false
  return m.floor === f.floor + f.height - 1 && m.x >= f.x && m.x < f.x + f.width
}

/** A loose monkey moves every hour and swings home at 6pm. */
export function zooHour(g: Game, m: number) {
  const day = dayOf(g.time)
  if (g.flags.peels?.length) {
    const keep = g.flags.peels.filter((p) => p.day === day || (p.day === day - 1 && m < 6 * 60))
    g.flags.peels = keep.length ? keep : undefined
  }
  if (g.flags.monkeyCarry && g.time >= g.flags.monkeyCarry.until) g.flags.monkeyCarry = null

  const zoo = facilitiesOf(g, 'zoo').find((f) => f.reachable) ?? facilitiesOf(g, 'zoo')[0]
  if (!zoo) {
    if (g.flags.monkey) g.flags.monkey = null
    return
  }
  if (m === 18 * 60 && g.flags.monkey) {
    dropPeel(g, g.flags.monkey)
    g.flags.monkey = null
    log(g, 'The monkey swung back to the Sky Zoo all by itself.', 'info', zoo.floor, zoo.x + 4)
    return
  }
  // he moves on the hour, but not in the minute he got out
  if (g.flags.monkey && g.time - g.flags.monkey.since >= 1) {
    const prev = g.flags.monkey
    if (sitMonkey(g, zoo)) dropPeel(g, prev)
  }
}

/** A monkey gets out. surprises.ts calls this at 10am on a monkey day. */
export function escapeMonkey(g: Game) {
  const zoo = facilitiesOf(g, 'zoo').find((f) => f.reachable) ?? facilitiesOf(g, 'zoo')[0]
  if (!zoo || g.flags.monkey || !sitMonkey(g, zoo)) return
  log(g, 'A monkey escaped from the Sky Zoo!', 'event', zoo.floor, zoo.x + 4)
  sound.play('pop')
}

/** Tapped the loose monkey: a little prize, and the zookeeper walks it home. */
export function catchMonkey(g: Game) {
  const h = g.flags.monkey
  if (!h) return
  const zoo = facilitiesOf(g, 'zoo')[0]
  dropPeel(g, h)
  const v = earn(g, CATCH_REWARD)
  g.flags.monkey = null
  if (zoo) {
    g.flags.monkeyCarry = {
      floor: h.floor,
      x: h.x,
      zooFloor: zoo.floor + zoo.height - 1,
      zooX: zoo.x + zoo.width / 2,
      start: g.time,
      until: g.time + HOME_MINUTES,
    }
  }
  fx(g, h.x, h.floor, 'Gotcha! 🍌', '#ffd43b')
  log(g, `Gotcha! 🍌 The zookeeper carries the monkey home. +$${v.toLocaleString()}`, 'good', h.floor, h.x)
  sound.play('party')
}
