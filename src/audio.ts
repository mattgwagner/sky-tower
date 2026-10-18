// Tiny WebAudio synth: sound effects + an easygoing lobby-music loop.
type Sfx = 'ding' | 'cash' | 'build' | 'star' | 'alarm' | 'boom' | 'party' | 'move' | 'bad' | 'click'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicGain: GainNode | null = null
let musicTimer: number | null = null
export const audioPrefs = { sfx: true, music: false }

function ac() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.12
    musicGain.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.2, dest?: AudioNode, slide?: number) {
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, start + dur)
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(vol, start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g)
  g.connect(dest ?? master!)
  o.start(start)
  o.stop(start + dur + 0.05)
}

function noise(start: number, dur: number, vol = 0.3) {
  const c = ac()
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = c.createBufferSource()
  s.buffer = buf
  const g = c.createGain()
  g.gain.value = vol
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 900
  s.connect(f); f.connect(g); g.connect(master!)
  s.start(start)
}

const last: Record<string, number> = {}

export function play(name: Sfx) {
  if (!audioPrefs.sfx) return
  const c = ac()
  const t = c.currentTime
  if (last[name] && t - last[name] < 0.08) return
  last[name] = t
  switch (name) {
    case 'ding': tone(1318, t, 0.5, 'sine', 0.12); tone(1046, t + 0.15, 0.6, 'sine', 0.1); break
    case 'cash': tone(1568, t, 0.08, 'square', 0.08); tone(2093, t + 0.07, 0.25, 'square', 0.08); break
    case 'build': noise(t, 0.12, 0.35); tone(140, t, 0.12, 'triangle', 0.3, undefined, 70); break
    case 'click': tone(880, t, 0.04, 'square', 0.05); break
    case 'move': tone(660, t, 0.08, 'triangle', 0.12); tone(990, t + 0.08, 0.12, 'triangle', 0.12); break
    case 'bad': tone(330, t, 0.18, 'sawtooth', 0.08); tone(247, t + 0.16, 0.3, 'sawtooth', 0.08); break
    case 'alarm': for (let i = 0; i < 4; i++) { tone(880, t + i * 0.3, 0.14, 'square', 0.1); tone(660, t + i * 0.3 + 0.15, 0.14, 'square', 0.1) } break
    case 'boom': noise(t, 1.2, 0.8); tone(80, t, 1, 'sine', 0.5, undefined, 30); break
    case 'party': [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.08, 0.2, 'square', 0.07)); break
    case 'star': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.11, i === 6 ? 0.6 : 0.16, 'square', 0.09)); break
  }
}

// --- lobby music: a gentle bossa-ish loop in C major pentatonic ---
const CHORDS = [
  [261.6, 329.6, 392.0, 493.9], // Cmaj7
  [220.0, 261.6, 329.6, 392.0], // Am7
  [293.7, 349.2, 440.0, 523.3], // Dm7
  [196.0, 246.9, 293.7, 349.2], // G7
]
const MELODY = [784, 659, 587, 659, 784, 880, 784, 659, 587, 523, 587, 659, 587, 523, 440, 523]

function scheduleBar(bar: number) {
  const c = ac()
  const t0 = c.currentTime + 0.05
  const beat = 0.42
  const ch = CHORDS[bar % 4]
  tone(ch[0] / 2, t0, beat * 1.6, 'triangle', 0.35, musicGain!)
  tone(ch[0] / 2 * 1.5, t0 + beat * 2, beat * 1.6, 'triangle', 0.3, musicGain!)
  for (let i = 0; i < 4; i++) {
    const at = t0 + i * beat + (i % 2 ? beat * 0.5 : 0)
    ch.slice(1).forEach((f) => tone(f, at, beat * 0.5, 'sine', 0.09, musicGain!))
  }
  for (let i = 0; i < 4; i++) {
    const n = MELODY[(bar * 4 + i) % MELODY.length]
    if ((bar + i) % 3 !== 2) tone(n, t0 + i * beat, beat * 0.9, 'sine', 0.13, musicGain!)
  }
}

export function setMusic(on: boolean) {
  audioPrefs.music = on
  if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null }
  if (!on) return
  ac()
  let bar = 0
  scheduleBar(bar++)
  musicTimer = window.setInterval(() => scheduleBar(bar++), 0.42 * 4 * 1000)
}

export function unlockAudio() {
  ac()
}
