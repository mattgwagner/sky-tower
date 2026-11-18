// Saves live in localStorage, which browsers cap at about 5 MB per site across
// every tower. Raw JSON saves of a big tower ran into that cap, so they are
// gzipped and base64'd before storing (about 6x smaller).
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'

const PREFIX = 'gz1:'

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** JSON → the string stored in localStorage. */
export function pack(json: string): string {
  return PREFIX + toBase64(gzipSync(strToU8(json), { level: 6 }))
}

/** Stored string → JSON. Older saves are plain JSON and pass straight through. */
export function unpack(stored: string): string {
  return stored.startsWith(PREFIX) ? strFromU8(gunzipSync(fromBase64(stored.slice(PREFIX.length)))) : stored
}

export const isPacked = (stored: string) => stored.startsWith(PREFIX)
