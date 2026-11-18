// Saves are gzipped + base64'd so big towers fit under the ~5 MB localStorage cap.
import { readFileSync } from 'fs'
import { gunzipSync } from 'zlib'
import { deserialize, serialize } from '../src/game/state'
import { pack, unpack, isPacked } from '../src/game/savecodec'

const fail = (msg: string) => { console.error('savecheck FAIL:', msg); process.exit(1) }

const json = serialize(deserialize(gunzipSync(readFileSync(new URL('./fixtures/v1-save.json.gz', import.meta.url))).toString()))
const stored = pack(json)
if (!isPacked(stored)) fail('pack did not mark the save')
if (unpack(stored) !== json) fail('pack → unpack changed the save')
if (unpack(json) !== json) fail('a plain-JSON save from before compression did not load as-is')
const ratio = json.length / stored.length
if (ratio < 4) fail(`only ${ratio.toFixed(1)}x smaller`)
if (serialize(deserialize(unpack(stored))) !== json) fail('round trip through the game changed the save')
const emoji = JSON.stringify({ name: 'Dean’s 🏰 Tower', s: 'é😀' })
if (unpack(pack(emoji)) !== emoji) fail('non-ASCII text did not survive')
console.log(`savecheck ok: ${json.length} → ${stored.length} chars (${ratio.toFixed(1)}x smaller)`)
