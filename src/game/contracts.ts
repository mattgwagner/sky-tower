// Contracts: a board of 1–3 short goals with a cash reward. A new one each morning. Build / earn
// contracts check real game state; math contracts ask about this tower's own numbers, frozen when
// drawn, and never expire. Scheduled, not random, so nothing here goes through surprises.ts; the
// daily pick only borrows its seeded hash so a reload doesn't re-roll the board.
import { FACILITIES, FOOD, HOTEL_NIGHT, OFFICE_RENT, RENT_MULT, starRules } from './defs'
import type { FacilityKind } from './defs'
import type { Contract, ContractBook, ContractType, Game, Skill } from './state'
import { dayOf, minuteOfDay } from './state'
import { defineSticker } from './stickers'
import { surpriseHash } from './surprises'
import { hoursOf, starProgress, TRAIN_EVERY } from './sim'
import { facilitiesOf, log, topFloor, unlocked } from './world'

export type { Contract, ContractBook, ContractType, Skill }

export const MAX_OPEN = 3
const DRAW_HOUR = 6
const DAYS = 3
const REWARD = [0, 25_000, 50_000, 100_000, 200_000, 400_000]
const SALT = 1900

/** Set by the UI to toast a finished contract. */
export const contractFx = {
  done: (_c: Contract, _paid: number) => {},
}

const money = (v: number) => `$${v.toLocaleString('en-US')}`

export function rewardFor(g: Game, type: ContractType) {
  const base = REWARD[Math.min(5, Math.max(1, g.stars))]
  return type === 'build' || type === 'pop' || type === 'above' ? base * 2 : base
}

function plural(name: string, n: number) {
  if (n === 1) return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`
  if (/[^aeiou]y$/.test(name)) return `${n} ${name.slice(0, -1)}ies`
  if (/(s|sh|ch|x)$/.test(name)) return `${n} ${name}es`
  return `${n} ${name}s`
}

/** Strip trailing zeros: 3000 → [3, 1000]. Null when it isn't a times-table fact. */
function times(v: number): [number, number] | null {
  if (!Number.isInteger(v) || v <= 0) return null
  let p = 1
  while (v % 10 === 0) { v /= 10; p *= 10 }
  return v <= 12 ? [v, p] : null
}

/** What one room pays for a night, the same sum `guestGone` hands to `earn` (VIP aside). */
export function hotelNight(g: Game, kind: FacilityKind, rent: number) {
  return Math.round((HOTEL_NIGHT[kind] ?? 0) * RENT_MULT[rent] * (g.mode === 'family' ? 1.25 : 1))
}

/** What one office pays each quarter, as `quarterTick` hands it to `earn`. */
export function officeRent(g: Game, rent: number) {
  return Math.round(OFFICE_RENT * RENT_MULT[rent] * (g.mode === 'family' ? 1.25 : 1))
}

export function clockText(hhmm: number) {
  const h = Math.floor(hhmm / 100), m = hhmm % 100
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`
}

function hourText(h: number) {
  if (h === 12) return 'noon'
  if (h === 24 || h === 0) return 'midnight'
  if (h < 12) return `${h} in the morning`
  if (h < 18) return `${h - 12} in the afternoon`
  return `${h - 12} at night`
}

export type Roll = (salt: number) => number
export type Draft = Omit<Contract, 'id' | 'day' | 'reward'>

const BUILD_SKIP: FacilityKind[] = ['metro', 'cathedral']

// ---------- build / earn ----------

export function goalDrafts(g: Game, day: number, r: Roll): Draft[] {
  const out: Draft[] = []
  const sandbox = g.mode === 'sandbox'
  const kinds = (Object.keys(FACILITIES) as FacilityKind[]).filter((k) => {
    const d = FACILITIES[k]
    return d.category !== 'build' && !BUILD_SKIP.includes(k) && unlocked(g, d.stars) && (sandbox || d.cost <= g.money / 3)
  })
  if (kinds.length) {
    const kind = kinds[Math.floor(r(1) * kinds.length)]
    const d = FACILITIES[kind]
    const cheap = sandbox || d.cost <= g.money / 10
    const n = cheap ? 1 + Math.floor(r(2) * (g.stars <= 1 ? 2 : 3)) : 1
    out.push({ type: 'build', until: day + DAYS - 1, emoji: d.emoji, text: `Build ${n === 1 ? plural(d.name, 1) : `${n} more ${plural(d.name, n).replace(/^\d+ /, '')}`}`, kind, n, base: facilitiesOf(g, kind).length })
  }
  const y = g.contracts.earnedYesterday
  if (y >= 5000) {
    const goal = Math.max(5000, Math.round((y * 1.25) / 5000) * 5000)
    out.push({ type: 'earn', until: day, emoji: '💰', text: `Earn ${money(goal)} today`, goal })
  }
  if (g.pop >= 20) {
    let goal = Math.ceil((g.pop * 1.2) / 50) * 50
    const next = starRules(g.mode)[g.stars]?.pop
    if (next && g.pop < next) goal = Math.min(goal, next)
    if (goal > g.pop) out.push({ type: 'pop', until: day + DAYS - 1, emoji: '👥', text: `Get ${goal.toLocaleString('en-US')} people in your tower`, goal })
  }
  const top = topFloor(g)
  const floor = Math.floor((top - 1) / 5) * 5
  if (floor >= 5) {
    const foods = FOOD.filter((k) => unlocked(g, FACILITIES[k].stars) && (sandbox || FACILITIES[k].cost <= g.money / 3)
      && !facilitiesOf(g, k).some((f) => f.floor > floor))
    if (foods.length) {
      const kind = foods[Math.floor(r(3) * foods.length)]
      out.push({ type: 'above', until: day + DAYS - 1, emoji: FACILITIES[kind].emoji, text: `Build ${plural(FACILITIES[kind].name, 1)} above floor ${floor}`, kind, goal: floor })
    }
  }
  return out
}

// ---------- math ----------

const PEOPLE: Partial<Record<FacilityKind, string>> = { office: 'workers', condo: 'people', hotelTwin: 'guests', hotelSuite: 'guests' }

export function mathDrafts(g: Game, r: Roll): Draft[] {
  const out: Draft[] = []
  const pickOf = <T,>(arr: T[], salt: number) => arr[Math.floor(r(salt) * arr.length)]

  // × people: count × how many each one holds
  const holders = (Object.keys(PEOPLE) as FacilityKind[]).filter((k) => {
    const n = facilitiesOf(g, k).length
    return n >= 2 && n <= 12
  })
  if (holders.length) {
    const k = pickOf(holders, 11)
    const n = facilitiesOf(g, k).length, each = FACILITIES[k].pop
    out.push({ type: 'math', skill: 'mul', emoji: '✖️', kind: k, answer: n * each, hint: `${n} groups of ${each}`,
      text: `You have ${n} ${plural(FACILITIES[k].name, n).replace(/^\d+ /, '')}. Each one holds ${each} ${PEOPLE[k]}. When they're all full, how many ${PEOPLE[k]} is that?` })
  }

  // × money: hotel rooms of one kind, all on the same rent
  const hotels = (['hotelSingle', 'hotelTwin', 'hotelSuite'] as FacilityKind[]).filter((k) => {
    const rooms = facilitiesOf(g, k)
    if (rooms.length < 2 || rooms.length > 12 || rooms.some((f) => f.rent !== rooms[0].rent)) return false
    return times(hotelNight(g, k, rooms[0].rent)) !== null
  })
  if (hotels.length) {
    const k = pickOf(hotels, 12)
    const rooms = facilitiesOf(g, k), each = hotelNight(g, k, rooms[0].rent), n = rooms.length
    out.push({ type: 'math', skill: 'mul', emoji: '🛏️', kind: k, dollars: true, answer: n * each, hint: `${n} groups of ${money(each)}`,
      text: `You have ${n} ${plural(FACILITIES[k].name, n).replace(/^\d+ /, '')}. Each one pays ${money(each)} a night. If they all fill up, how much do you make tonight?` })
  }

  // × money: rented offices on the same rent
  const offices = facilitiesOf(g, 'office').filter((f) => f.occupied)
  if (offices.length >= 2 && offices.length <= 12 && offices.every((f) => f.rent === offices[0].rent) && times(officeRent(g, offices[0].rent))) {
    const n = offices.length, each = officeRent(g, offices[0].rent)
    out.push({ type: 'math', skill: 'mul', emoji: '💼', kind: 'office', dollars: true, answer: n * each, hint: `${n} groups of ${money(each)}`,
      text: `${n} offices are rented. Each one pays ${money(each)} rent every 3 days. How much rent is that?` })
  }

  // − : people still needed for the next star
  const next = starProgress(g)
  if (next && g.pop < next.pop && next.pop <= 9999 && next.pop - g.pop >= 10) {
    out.push({ type: 'math', skill: 'sub', emoji: '⭐', answer: next.pop - g.pop, hint: `Count up from ${g.pop} to ${next.pop}`,
      text: `Your next star needs ${next.pop.toLocaleString('en-US')} people. You have ${g.pop.toLocaleString('en-US')}. How many more people do you need?` })
  }

  // + / − : people moving in or heading home
  if (g.pop >= 10 && g.pop <= 9000) {
    const steps = g.pop >= 1000 ? [100, 150, 200, 250, 500, 750] : [20, 25, 30, 45, 50, 75, 100]
    const more = pickOf(steps, 13)
    out.push({ type: 'math', skill: 'add', emoji: '➕', answer: g.pop + more, hint: `${g.pop} + ${more}: add the ones, then the tens, then the hundreds`,
      text: `${g.pop.toLocaleString('en-US')} people are in your tower. If ${more} more move in, how many is that?` })
    const fewer = pickOf(steps.filter((s) => s < g.pop), 14)
    if (fewer) {
      out.push({ type: 'math', skill: 'sub', emoji: '➖', answer: g.pop - fewer, hint: `${g.pop} − ${fewer}: take away the ones, then the tens, then the hundreds`,
        text: `${g.pop.toLocaleString('en-US')} people are in your tower. If ${fewer} go home for the night, how many are left?` })
    }
  }

  // $ : two things he can build right now
  const priced = (Object.keys(FACILITIES) as FacilityKind[]).filter((k) => {
    const d = FACILITIES[k]
    return d.category !== 'build' && unlocked(g, d.stars) && d.cost % 1000 === 0 && d.cost <= 500_000
  })
  if (priced.length >= 2) {
    const a = pickOf(priced, 15)
    const b = pickOf(priced.filter((k) => k !== a), 16)
    const ca = FACILITIES[a].cost, cb = FACILITIES[b].cost
    out.push({ type: 'math', skill: 'money', emoji: '💵', dollars: true, answer: ca + cb, hint: `${ca / 1000} thousand + ${cb / 1000} thousand`,
      text: `${plural(FACILITIES[a].name, 1).replace(/^a/, 'A')} costs ${money(ca)} and ${plural(FACILITIES[b].name, 1)} costs ${money(cb)}. How much for both?` })
  }

  // 🕒 : hours a room he built is open
  const opens = [...new Set([...g.facilities.values()].map((f) => f.kind))].filter((k) => {
    const w = hoursOf(k)
    return w.length === 1 && w[0][0] % 60 === 0 && w[0][1] % 60 === 0 && w[0][1] - w[0][0] >= 120
  })
  if (opens.length) {
    const k = pickOf(opens, 17)
    const [a, b] = hoursOf(k)[0].map((m) => m / 60)
    out.push({ type: 'math', skill: 'time', emoji: '🕒', kind: k, answer: b - a, hint: a < 12 && b > 12 ? 'Count up to 12 first, then keep going' : `Count the hours from ${hourText(a)} to ${hourText(b)}`,
      text: `Your ${FACILITIES[k].name} opens at ${hourText(a)} and closes at ${hourText(b)}. How many hours is it open?` })
  }

  // 🕒 : the next metro train
  if (facilitiesOf(g, 'metro').length) {
    const slots = Math.floor((23 * 60 - 5 * 60) / TRAIN_EVERY)
    const left = 5 * 60 + Math.floor(r(18) * slots) * TRAIN_EVERY
    const now = left + 5 * (1 + Math.floor(r(19) * (TRAIN_EVERY / 5 - 1)))
    const nxt = left + TRAIN_EVERY
    // 12-hour, as he'd type it off a clock face: 3:00pm is 300
    const hhmm = (m: number) => ((Math.floor(m / 60) % 12) || 12) * 100 + (m % 60)
    out.push({ type: 'math', skill: 'time', emoji: '🚇', clock: true, answer: hhmm(nxt), hint: `Trains come every ${TRAIN_EVERY} minutes. Which one comes after ${clockText(hhmm(now))}?`,
      text: `Metro trains come every ${TRAIN_EVERY} minutes, starting at 5:00. It's ${clockText(hhmm(now))} now. When's the next train?` })
  }
  return out
}

// ---------- the board ----------

/** Called every game hour. Draws the morning contract once a day, from 6am. */
export function contractsHour(g: Game, m: number) {
  const book = g.contracts
  const day = dayOf(g.time)
  if (book.lastDay === day || m < DRAW_HOUR * 60) return
  book.lastDay = day
  book.open = book.open.filter((c) => c.until === undefined || c.until >= day)
  if (book.open.length >= MAX_OPEN) return
  g.flags.seed ??= Math.floor(Math.random() * 2 ** 31)
  const r: Roll = (salt) => surpriseHash(g, day, SALT + salt) / 2 ** 32
  const math = book.open.filter((c) => c.type === 'math').length
  const other = book.open.length - math
  const wantMath = math < other ? true : math > other ? false : r(0) < 0.5
  const goals = goalDrafts(g, day, r).filter((d) => !book.open.some((c) => c.type === d.type))
  const maths = mathDrafts(g, r).filter((d) => !book.open.some((c) => c.text === d.text))
  const pool = wantMath ? (maths.length ? maths : goals) : (goals.length ? goals : maths)
  if (!pool.length) return
  const draft = pool[0].type === 'math' ? weighted(book, pool, r(4)) : pool[Math.floor(r(5) * pool.length)]
  book.open.push({ ...draft, id: book.nextId++, day, reward: rewardFor(g, draft.type) })
}

function weighted(book: ContractBook, pool: Draft[], roll: number) {
  const w = pool.map((d) => 1 + Math.min(4, book.misses[d.skill!] ?? 0))
  let x = roll * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) < 0) return pool[i]
  return pool[pool.length - 1]
}

/** How far along a build / earn contract is, for the card. */
export function contractProgress(g: Game, c: Contract): { have: number; need: number } | null {
  switch (c.type) {
    case 'build': return { have: Math.max(0, facilitiesOf(g, c.kind!).length - c.base!), need: c.n! }
    case 'earn': return { have: Math.min(c.goal!, g.contracts.earnedToday), need: c.goal! }
    case 'pop': return { have: Math.min(c.goal!, g.pop), need: c.goal! }
    case 'above': return { have: facilitiesOf(g, c.kind!).some((f) => f.floor > c.goal!) ? 1 : 0, need: 1 }
    default: return null
  }
}

function finish(g: Game, c: Contract) {
  const book = g.contracts
  book.open = book.open.filter((o) => o.id !== c.id)
  // paid as shown on the card: no family bonus, and not counted as the tower's earnings
  g.money += c.reward
  g.stats.income += c.reward
  book.done++
  log(g, `📋 Contract done: ${c.type === 'math' ? 'math question' : c.text}! +${money(c.reward)}`, 'good')
  contractFx.done(c, c.reward)
}

/** Called every game minute. Pays out any build / earn contract that's met. */
export function contractsMinute(g: Game) {
  const day = dayOf(g.time)
  for (const c of [...g.contracts.open]) {
    if (c.type === 'math' || (c.until !== undefined && c.until < day)) continue
    const p = contractProgress(g, c)
    if (p && p.have >= p.need) finish(g, c)
  }
}

export function contractsDay(g: Game) {
  const book = g.contracts
  book.earnedYesterday = book.earnedToday
  book.earnedToday = 0
  // a missed deadline just drops off, no penalty
  book.open = book.open.filter((c) => c.until === undefined || c.until >= dayOf(g.time))
}

/** Turn the number pad's text into the stored answer form. Clock times compare on digits. */
export function parseAnswer(text: string) {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : NaN
}

export function answerContract(g: Game, id: number, text: string): 'right' | 'wrong' | 'gone' {
  const book = g.contracts
  const c = book.open.find((o) => o.id === id && o.type === 'math')
  if (!c) return 'gone'
  const skill = c.skill!
  if (parseAnswer(text) !== c.answer) {
    if (!c.missed) {
      c.missed = true
      book.misses[skill] = (book.misses[skill] ?? 0) + 1
      book.streak = 0
    }
    return 'wrong'
  }
  if (!c.missed) {
    book.misses[skill] = Math.max(0, (book.misses[skill] ?? 0) - 1)
    book.streak++
    book.best = Math.max(book.best, book.streak)
  }
  finish(g, c)
  return 'right'
}

/** "Today", "2 days left": build / earn deadlines in the HUD's terms. */
export function dueText(g: Game, c: Contract) {
  if (c.until === undefined) return ''
  const left = c.until - dayOf(g.time)
  if (left <= 0) return minuteOfDay(g.time) >= 18 * 60 ? 'Ends tonight' : 'Today'
  return `${left + 1} days left`
}

/** Exactly the clock answer as the pad would show it, for tests. */
export function answerText(c: Contract) {
  return c.clock ? clockText(c.answer!) : String(c.answer)
}

defineSticker({ id: 'contract-1', name: 'First Contract', emoji: '📋', hint: 'Finish a contract', secret: false, check: (g) => g.contracts.done >= 1 })
defineSticker({ id: 'contract-10', name: 'Ten Jobs', emoji: '🏗️', hint: 'Finish 10 contracts', secret: false, check: (g) => g.contracts.done >= 10 })
defineSticker({ id: 'math-whiz', name: 'Math Whiz', emoji: '🧮', hint: 'Get 5 math contracts right in a row, first try', secret: false, check: (g) => g.contracts.best >= 5 })
