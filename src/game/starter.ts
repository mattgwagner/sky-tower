// A small pre-built tower so kids can jump straight into the fun.
import type { FacilityKind } from './defs'
import { afterBuild } from './sim'
import type { Game } from './state'
import { addCar, paintRun, placeFacility, placeShaft } from './world'

export function buildStarter(g: Game) {
  const realMode = g.mode
  const money = g.money
  g.mode = 'sandbox'
  paintRun(g, 'lobby', 70, 169, 0)
  const s = placeShaft(g, 'elevator', 116, 0, 8)
  if (s) addCar(g, s)
  for (let f = 1; f <= 4; f++) paintRun(g, 'floor', 70, 164, f)
  for (let f = 5; f <= 7; f++) paintRun(g, 'floor', 84, 151, f)
  paintRun(g, 'floor', 97, 137, 8)
  const row = (f: number, kind: FacilityKind, xs: number[]) => xs.forEach((x) => placeFacility(g, kind, x, f))
  row(1, 'fastFood', [70])
  row(1, 'office', [88, 97, 106, 120, 129, 138, 147, 156])
  for (let f = 2; f <= 4; f++) row(f, 'office', [70, 79, 88, 97, 106, 120, 129, 138, 147, 156])
  for (let f = 5; f <= 7; f++) row(f, 'condo', [84, 100, 120, 136])
  row(8, 'office', [97, 106, 120, 129])
  g.mode = realMode
  g.money = money
  afterBuild(g)
}
