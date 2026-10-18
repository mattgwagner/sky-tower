// Elevator car logic: a simple SCAN (collective control) per car.
import { TRANSPORTS } from './defs'
import type { Car, Shaft } from './state'

const DOOR_TIME = 22
const BOARD_EVERY = 2

export interface ElevatorHooks {
  destOf(pid: number): number
  onBoard(pid: number, s: Shaft, car: Car): void
  onUnload(pid: number, s: Shaft, floor: number): void
  onDing(s: Shaft, floor: number): void
}

export function joinQueue(s: Shaft, floor: number, dest: number, pid: number): 1 | -1 {
  if (!s.q[floor]) s.q[floor] = { up: [], down: [] }
  const dir = dest > floor ? 1 : -1
  ;(dir === 1 ? s.q[floor].up : s.q[floor].down).push(pid)
  return dir
}

export function leaveQueue(s: Shaft, pid: number) {
  for (const k in s.q) {
    const q = s.q[k]
    let i = q.up.indexOf(pid)
    if (i >= 0) q.up.splice(i, 1)
    i = q.down.indexOf(pid)
    if (i >= 0) q.down.splice(i, 1)
  }
}

export function carPos(s: Shaft, c: Car): number {
  if (c.state !== 'moving') return c.floor
  return c.floor + (c.dir * c.sub) / TRANSPORTS[s.kind].stepsPerFloor
}

function waiting(s: Shaft, f: number, dir: 1 | -1 | 0): number {
  const q = s.q[f]
  if (!q) return 0
  if (dir === 1) return q.up.length
  if (dir === -1) return q.down.length
  return q.up.length + q.down.length
}

function requestsBeyond(s: Shaft, c: Car, from: number, dir: 1 | -1, h: ElevatorHooks): boolean {
  for (const r of c.riders) {
    const d = h.destOf(r)
    if ((d - from) * dir > 0) return true
  }
  for (const k in s.q) {
    const f = +k
    if ((f - from) * dir > 0 && waiting(s, f, 0) > 0) return true
  }
  if (c.target !== null && (c.target - from) * dir > 0) return true
  return false
}

function shouldStop(s: Shaft, c: Car, f: number, h: ElevatorHooks): boolean {
  if (f <= s.lo || f >= s.hi) return true
  if (!s.stops[f]) return false
  if (c.target === f) return true
  for (const r of c.riders) if (h.destOf(r) === f) return true
  const cap = TRANSPORTS[s.kind].capacity
  const dir = c.dir as 1 | -1
  if (c.riders.length < cap && waiting(s, f, dir) > 0) return true
  if (c.riders.length === 0 && waiting(s, f, (-dir) as 1 | -1) > 0 && !requestsBeyond(s, c, f, dir, h)) return true
  return false
}

function arrive(s: Shaft, c: Car, h: ElevatorHooks) {
  c.state = 'doors'
  c.timer = DOOR_TIME
  c.sub = 0
  if (c.target === c.floor) c.target = null
  let dinged = false
  for (let i = c.riders.length - 1; i >= 0; i--) {
    const pid = c.riders[i]
    if (h.destOf(pid) === c.floor) {
      c.riders.splice(i, 1)
      h.onUnload(pid, s, c.floor)
      dinged = true
    }
  }
  if (dinged || waiting(s, c.floor, 0) > 0) h.onDing(s, c.floor)
  pickDir(s, c, h)
}

function pickDir(s: Shaft, c: Car, h: ElevatorHooks) {
  const f = c.floor
  if (c.riders.length) {
    if (c.dir !== 0 && requestsBeyond(s, c, f, c.dir, h)) return
    c.dir = h.destOf(c.riders[0]) > f ? 1 : -1
    return
  }
  if (c.dir !== 0) {
    if (waiting(s, f, c.dir) > 0) return
    if (requestsBeyond(s, c, f, c.dir, h) && waiting(s, f, (-c.dir) as 1 | -1) === 0) return
    if (waiting(s, f, (-c.dir) as 1 | -1) > 0) { c.dir = (-c.dir) as 1 | -1; return }
    if (requestsBeyond(s, c, f, (-c.dir) as 1 | -1, h)) { c.dir = (-c.dir) as 1 | -1; return }
    c.dir = 0
    return
  }
  if (waiting(s, f, 1) > 0) c.dir = 1
  else if (waiting(s, f, -1) > 0) c.dir = -1
}

function board(s: Shaft, c: Car, h: ElevatorHooks): boolean {
  const q = s.q[c.floor]
  if (!q || c.dir === 0) return false
  const cap = TRANSPORTS[s.kind].capacity
  if (c.riders.length >= cap) return false
  const list = c.dir === 1 ? q.up : q.down
  const pid = list.shift()
  if (pid === undefined) return false
  c.riders.push(pid)
  h.onBoard(pid, s, c)
  return true
}

export function stepShaft(s: Shaft, h: ElevatorHooks) {
  const spf = TRANSPORTS[s.kind].stepsPerFloor
  for (const c of s.cars) {
    switch (c.state) {
      case 'doors': {
        c.timer--
        if (c.timer % BOARD_EVERY === 0) {
          if (c.dir === 0) pickDir(s, c, h)
          if (board(s, c, h) && c.timer < BOARD_EVERY) c.timer = BOARD_EVERY
        }
        if (c.timer <= 0) {
          pickDir(s, c, h)
          if (c.dir === 0) c.state = 'idle'
          else if (waiting(s, c.floor, c.dir) > 0 && c.riders.length < TRANSPORTS[s.kind].capacity) c.timer = BOARD_EVERY
          else if ((c.dir === 1 && c.floor >= s.hi) || (c.dir === -1 && c.floor <= s.lo)) { c.dir = 0; c.state = 'idle' }
          else { c.state = 'moving'; c.sub = 0 }
        }
        break
      }
      case 'moving': {
        c.sub++
        if (c.sub >= spf) {
          c.floor += c.dir
          c.sub = 0
          if (shouldStop(s, c, c.floor, h)) arrive(s, c, h)
        }
        break
      }
      case 'idle': {
        if (waiting(s, c.floor, 0) > 0) { arrive(s, c, h); break }
        // nearest floor with waiting people that no other car is heading to
        let best = -1e9
        let bestD = 1e9
        for (const k in s.q) {
          const f = +k
          if (waiting(s, f, 0) === 0) continue
          if (s.cars.some((o) => o !== c && (o.target === f || (o.state !== 'idle' && o.floor === f)))) continue
          const d = Math.abs(f - c.floor)
          if (d < bestD) { bestD = d; best = f }
        }
        if (best > -1e9) {
          c.target = best
          c.dir = best > c.floor ? 1 : -1
          c.state = 'moving'
          c.sub = 0
        }
        break
      }
    }
  }
}

export function totalWaiting(s: Shaft): number {
  let n = 0
  for (const k in s.q) n += s.q[k].up.length + s.q[k].down.length
  return n
}
