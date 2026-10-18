// A quick jelly wobble for a room that just got poked.
const pokes = new Map<number, number>()

export function registerPoke(id: number, now: number) {
  pokes.set(id, now)
}

/** Scale/rotation offsets for a poked room, or null once the wobble is over. */
export function pokeWobble(id: number, now: number): { sx: number; sy: number; rot: number } | null {
  const t0 = pokes.get(id)
  if (t0 === undefined) return null
  const t = (now - t0) / 1000
  if (t > 0.55) { pokes.delete(id); return null }
  const decay = Math.exp(-t * 6)
  const w = Math.sin(t * 40) * decay
  return { sx: w * 0.06, sy: -w * 0.08, rot: w * 0.012 }
}
