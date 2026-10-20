// Path finding across floors using elevators, stairs and escalators.
import { FACILITIES, TOWER_WIDTH, TRANSPORTS, isConnector } from './defs'
import type { Game, Leg } from './state'

interface Node {
  via: number
  floor: number
  x: number
  kind: 'shaft' | 'conn'
  spf: number // steps per floor for riding cost
  staffOnly: boolean
  connLo: number // connector bottom floor
  isEsc: boolean
  downOnly: boolean // fireman pole, mega slide: you can slide down but not climb up
  perFloor: number // connector riding cost per floor
}

interface Graph {
  game: Game
  version: number
  nodes: Node[]
  byFloor: Map<number, number[]>
  byVia: Map<number, number[]>
  seg: Map<number, Int32Array>
}

let graph: Graph | null = null
const cache = new Map<string, Leg[] | null>()

const WALK = 1 // cost per tile walked
const WAIT = 70 // expected elevator wait
const TRANSFER = 40
const STAIR = 90 // per floor
const ESC = 45
const POLE = 15
const SLIDE = 12

function buildGraph(g: Game): Graph {
  const nodes: Node[] = []
  const byFloor = new Map<number, number[]>()
  const byVia = new Map<number, number[]>()
  const add = (n: Node) => {
    const i = nodes.length
    nodes.push(n)
    if (!byFloor.has(n.floor)) byFloor.set(n.floor, [])
    byFloor.get(n.floor)!.push(i)
    if (!byVia.has(n.via)) byVia.set(n.via, [])
    byVia.get(n.via)!.push(i)
  }
  for (const s of g.shafts.values()) {
    const def = TRANSPORTS[s.kind]
    for (let f = s.lo; f <= s.hi; f++) {
      if (!s.stops[f]) continue
      add({ via: s.id, floor: f, x: s.x + def.width / 2, kind: 'shaft', spf: def.stepsPerFloor, staffOnly: s.kind === 'serviceElevator', connLo: 0, isEsc: false, downOnly: false, perFloor: 0 })
    }
  }
  for (const fac of g.facilities.values()) {
    if (!isConnector(fac.kind)) continue
    const x = fac.x + FACILITIES[fac.kind].width / 2
    const isEsc = fac.kind === 'escalator'
    const downOnly = fac.kind === 'firePole' || fac.kind === 'megaSlide'
    const perFloor = fac.kind === 'megaSlide' ? SLIDE : fac.kind === 'firePole' ? POLE : isEsc ? ESC : STAIR
    // a connector links its bottom floor to the floor above its top, in one leg
    add({ via: fac.id, floor: fac.floor, x, kind: 'conn', spf: 0, staffOnly: false, connLo: fac.floor, isEsc, downOnly, perFloor })
    add({ via: fac.id, floor: fac.floor + fac.height, x, kind: 'conn', spf: 0, staffOnly: false, connLo: fac.floor, isEsc, downOnly, perFloor })
  }
  // walkable segments per floor
  const seg = new Map<number, Int32Array>()
  for (const [f, r] of g.floors) {
    const s = new Int32Array(TOWER_WIDTH).fill(-1)
    let id = 0
    for (let i = 0; i < TOWER_WIDTH; i++) {
      if (r[i] === -1) continue
      if (i === 0 || r[i - 1] === -1) id++
      s[i] = id
    }
    seg.set(f, s)
  }
  return { game: g, version: g.buildVersion, nodes, byFloor, byVia, seg }
}

function ensure(g: Game): Graph {
  if (!graph || graph.game !== g || graph.version !== g.buildVersion) {
    graph = buildGraph(g)
    cache.clear()
  }
  return graph
}

export function sameSegment(g: Game, f: number, x1: number, x2: number): boolean {
  const gr = ensure(g)
  const s = gr.seg.get(f)
  if (!s) return false
  const a = s[Math.max(0, Math.min(TOWER_WIDTH - 1, Math.floor(x1)))]
  const b = s[Math.max(0, Math.min(TOWER_WIDTH - 1, Math.floor(x2)))]
  return a >= 0 && a === b
}

// tiny binary heap
class Heap {
  k: number[] = []
  v: number[] = []
  push(key: number, val: number) {
    const k = this.k, v = this.v
    let i = k.length
    k.push(key); v.push(val)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p] <= k[i]) break
      ;[k[p], k[i]] = [k[i], k[p]];[v[p], v[i]] = [v[i], v[p]]
      i = p
    }
  }
  pop(): [number, number] | undefined {
    const k = this.k, v = this.v
    if (!k.length) return undefined
    const top: [number, number] = [k[0], v[0]]
    const lk = k.pop()!, lv = v.pop()!
    if (k.length) {
      k[0] = lk; v[0] = lv
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < k.length && k[l] < k[m]) m = l
        if (r < k.length && k[r] < k[m]) m = r
        if (m === i) break
        ;[k[m], k[i]] = [k[i], k[m]];[v[m], v[i]] = [v[i], v[m]]
        i = m
      }
    }
    return top
  }
}

/**
 * Route from (fromFloor, fromX) to (toFloor, toX). Returns legs (possibly empty for a
 * same-floor walk) or null if unreachable.
 */
export function findRoute(g: Game, fromFloor: number, fromX: number, toFloor: number, toX: number, staff = false): Leg[] | null {
  const gr = ensure(g)
  if (fromFloor === toFloor && sameSegment(g, fromFloor, fromX, toX)) return []
  const key = `${staff ? 1 : 0}|${fromFloor}|${fromX >> 3}|${toFloor}|${toX >> 3}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const res = dijkstra(g, gr, fromFloor, fromX, toFloor, toX, staff)
  if (cache.size > 20000) cache.clear()
  cache.set(key, res)
  return res
}

function dijkstra(g: Game, gr: Graph, fromFloor: number, fromX: number, toFloor: number, toX: number, staff: boolean): Leg[] | null {
  const n = gr.nodes.length
  const dist = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-2) // -1 = from start
  const heap = new Heap()
  const usable = (i: number) => staff || !gr.nodes[i].staffOnly
  for (const i of gr.byFloor.get(fromFloor) ?? []) {
    if (!usable(i)) continue
    const nd = gr.nodes[i]
    if (!sameSegment(g, fromFloor, fromX, nd.x)) continue
    const d = Math.abs(nd.x - fromX) * WALK
    if (d < dist[i]) { dist[i] = d; prev[i] = -1; heap.push(d, i) }
  }
  let best = Infinity
  let bestNode = -1
  for (;;) {
    const top = heap.pop()
    if (!top) break
    const [d, i] = top
    if (d > dist[i]) continue
    if (d >= best) break
    const nd = gr.nodes[i]
    // arrive at goal?
    if (nd.floor === toFloor && sameSegment(g, toFloor, nd.x, toX)) {
      const tot = d + Math.abs(nd.x - toX) * WALK
      if (tot < best) { best = tot; bestNode = i }
    }
    // ride along the same transport
    for (const j of gr.byVia.get(nd.via) ?? []) {
      if (j === i) continue
      const m = gr.nodes[j]
      let c: number
      if (nd.downOnly && m.floor > nd.floor) continue
      if (nd.kind === 'shaft') c = WAIT * (staff && nd.staffOnly ? 0.5 : 1) + Math.abs(m.floor - nd.floor) * nd.spf * 0.6
      else c = nd.perFloor * Math.abs(m.floor - nd.floor)
      const nd2 = d + c
      if (nd2 < dist[j]) { dist[j] = nd2; prev[j] = i; heap.push(nd2, j) }
    }
    // transfer on the same floor (only after arriving via a ride, prev on another floor)
    const p = prev[i]
    if (p >= 0 && gr.nodes[p].via === nd.via) {
      for (const j of gr.byFloor.get(nd.floor) ?? []) {
        const m = gr.nodes[j]
        if (m.via === nd.via || !usable(j)) continue
        if (!sameSegment(g, nd.floor, nd.x, m.x)) continue
        const nd2 = d + Math.abs(m.x - nd.x) * WALK + (m.kind === 'conn' && nd.kind === 'conn' ? 5 : TRANSFER)
        if (nd2 < dist[j]) { dist[j] = nd2; prev[j] = i; heap.push(nd2, j) }
      }
    }
  }
  if (bestNode < 0) return null
  // reconstruct node chain
  const chain: number[] = []
  for (let i = bestNode; i >= 0; i = prev[i]) chain.push(i)
  chain.reverse()
  const legs: Leg[] = []
  for (let k = 0; k + 1 < chain.length; k++) {
    const a = gr.nodes[chain[k]]
    const b = gr.nodes[chain[k + 1]]
    if (a.via === b.via) legs.push({ via: a.via, from: a.floor, to: b.floor, x: a.x })
  }
  if (!legs.length) return null
  return legs
}

export function routeExists(g: Game, fromFloor: number, fromX: number, toFloor: number, toX: number, staff = false) {
  return findRoute(g, fromFloor, fromX, toFloor, toX, staff) !== null
}
