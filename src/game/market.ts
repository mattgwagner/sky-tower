// Food market: one hall, four stands. The stand a visitor picks is a costume, not a second simulation.

export type MarketPhase = 'morning' | 'day' | 'night' | 'closed'

/** 7–11 farmers market, 11–6 everything open, 6–10 night market. */
export function marketPhase(minute: number): MarketPhase {
  if (minute >= 7 * 60 && minute < 11 * 60) return 'morning'
  if (minute >= 11 * 60 && minute < 18 * 60) return 'day'
  if (minute >= 18 * 60 && minute < 22 * 60) return 'night'
  return 'closed'
}

const SIGNS: Record<MarketPhase, string> = {
  morning: 'FARMERS MARKET',
  day: 'FOOD MARKET',
  night: 'NIGHT MARKET',
  closed: 'CLOSED',
}

const PANELS: Record<MarketPhase, string> = {
  morning: 'Farmers market is open!',
  day: 'Every stand is open!',
  night: 'Night market! 🏮',
  closed: 'Closed until morning',
}

export function marketSign(phase: MarketPhase): string {
  return SIGNS[phase]
}

export function marketPanel(phase: MarketPhase): string {
  return PANELS[phase]
}

/** Grill stays dark until lunch. Its morning crowd splits between fruit and lemonade. At night most of the line drifts to the skewers. */
export function standFor(id: number, phase: MarketPhase): number {
  const roll = id % 4
  if (phase === 'morning') {
    // id % 4 === 1 is always odd, so id % 2 cannot split them.
    if (roll === 1) return (id >> 2) % 2 === 0 ? 0 : 3
    return roll
  }
  if (phase === 'night') {
    if (roll === 0 || roll === 3) return id % 3 === 0 ? roll : 1
    return roll
  }
  return roll
}

export function grillLit(phase: MarketPhase): boolean {
  return phase === 'day' || phase === 'night'
}

function weekdayRush(minute: number): number {
  switch (marketPhase(minute)) {
    case 'morning': return 7
    case 'day': return minute < 14 * 60 ? 12 : 7
    case 'night': return 9
    case 'closed': return 0
  }
}

/** Visitors per hour. Lunch is the rush; weekends are busier the whole time it is open. */
export function marketRush(minute: number, weekend: boolean): number {
  const per = weekdayRush(minute)
  return weekend ? Math.round(per * 1.5) : per
}
