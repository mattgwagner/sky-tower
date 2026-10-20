// Headless: the starter tower earns First Floor and Going Up, and an old save loads with an empty book.
import { buildStarter } from '../src/game/starter'
import { allStickers, defineSticker, stepStickers } from '../src/game/stickers'
import { deserialize, newGame, serialize } from '../src/game/state'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

export function checkStarterStickers() {
  const g = newGame('family', true)
  buildStarter(g)
  const earned = stepStickers(g).map((s) => s.id)
  assert(earned.includes('first-floor'), `starter missing First Floor, got ${earned.join(',')}`)
  assert(earned.includes('going-up'), `starter missing Going Up, got ${earned.join(',')}`)
  assert(stepStickers(g).length === 0, 'second pass should not earn them again')
  assert(allStickers().length >= 40, `expected about 40 stickers, got ${allStickers().length}`)

  const empty = newGame('sandbox', false)
  empty.time = 12 * 60
  empty.money = 1777
  const secrets = stepStickers(empty).map((s) => s.id)
  assert(secrets.includes('ghost'), `empty noon tower missed Ghost Town: ${secrets.join(',')}`)
  assert(secrets.includes('lucky'), `1777 missed Lucky Number: ${secrets.join(',')}`)

  const raw = JSON.parse(serialize(g)) as Record<string, unknown>
  delete raw.stickers
  delete raw.counters
  const old = deserialize(JSON.stringify(raw))
  assert(old.stickers.length === 0, 'old save should load with an empty sticker set')
  assert(Object.keys(old.counters).length === 0, 'old save should load with empty counters')

  defineSticker({ id: 'test-hook', name: 'Test Hook', emoji: '🧪', hint: 'test', secret: true, check: (gg) => gg.counters.pokes === -1 })
  defineSticker({ id: 'test-hook', name: 'Test Hook', emoji: '🧪', hint: 'test', secret: true, check: () => true })
  assert(allStickers().filter((s) => s.id === 'test-hook').length === 1, 'defineSticker should ignore a duplicate id')
  console.log('stickers ok', earned.join(', '), `book=${allStickers().length - 1}`)
}

if (process.argv[1]?.endsWith('stickercheck.ts')) checkStarterStickers()
