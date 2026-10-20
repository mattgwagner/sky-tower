// Tiny WebAudio synth: sound effects + an easygoing lobby-music loop.
export type Sfx = 'ding' | 'cash' | 'build' | 'star' | 'alarm' | 'boom' | 'party' | 'move' | 'bad' | 'click' | 'rocket' | 'roar' | 'spooky' | 'ufo' | 'boing'
  | 'splash' | 'strike' | 'bell' | 'honk' | 'arcade' | 'thunder' | 'shutter' | 'twinkle' | 'meow' | 'woof' | 'train' | 'pop' | 'scare' | 'rush' | 'flicker' | 'heartbeat' | 'whistle'

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

function noise(start: number, dur: number, vol = 0.3, cutoff = 900) {
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
  f.frequency.value = cutoff
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
    case 'rocket': noise(t, 2.6, 0.7, 500); tone(70, t, 2.4, 'sawtooth', 0.12, undefined, 260); break
    case 'roar': noise(t, 0.9, 0.5, 400); tone(190, t, 0.9, 'sawtooth', 0.18, undefined, 55); tone(140, t + 0.05, 0.9, 'square', 0.08, undefined, 45); break
    case 'spooky': tone(392, t, 0.9, 'sine', 0.14, undefined, 262); tone(370, t + 0.7, 1.1, 'sine', 0.12, undefined, 220); break
    case 'ufo': for (let i = 0; i < 6; i++) tone(i % 2 ? 900 : 620, t + i * 0.16, 0.18, 'sine', 0.1, undefined, i % 2 ? 620 : 900); break
    case 'boing': tone(220, t, 0.3, 'sine', 0.2, undefined, 660); break
    case 'star': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.11, i === 6 ? 0.6 : 0.16, 'square', 0.09)); break
    case 'splash': noise(t, 0.35, 0.5, 1800); tone(900, t, 0.25, 'sine', 0.1, undefined, 200); for (let i = 0; i < 4; i++) tone(1400 + i * 300, t + 0.12 + i * 0.07, 0.1, 'sine', 0.05); break
    case 'strike': tone(120, t, 0.18, 'triangle', 0.3, undefined, 60); for (let i = 0; i < 6; i++) { noise(t + 0.12 + i * 0.05, 0.08, 0.25, 3000); tone(1800 + (i * 530) % 900, t + 0.12 + i * 0.05, 0.09, 'square', 0.04) } break
    case 'bell': for (let i = 0; i < 3; i++) { tone(392, t + i * 0.55, 1.4, 'sine', 0.16); tone(784, t + i * 0.55, 0.9, 'sine', 0.06); tone(1175, t + i * 0.55, 0.5, 'triangle', 0.03) } break
    case 'honk': tone(330, t, 0.16, 'sawtooth', 0.1); tone(415, t, 0.16, 'sawtooth', 0.08); tone(330, t + 0.22, 0.22, 'sawtooth', 0.1); tone(415, t + 0.22, 0.22, 'sawtooth', 0.08); break
    case 'arcade': [660, 880, 1100, 1320, 1760].forEach((f, i) => tone(f, t + i * 0.05, 0.08, 'square', 0.07)); tone(1760, t + 0.3, 0.3, 'square', 0.07, undefined, 2600); break
    case 'thunder': noise(t, 2.4, 0.9, 220); noise(t + 0.3, 1.6, 0.5, 120); tone(45, t, 2, 'sine', 0.4, undefined, 25); break
    case 'shutter': noise(t, 0.05, 0.4, 4000); tone(1400, t, 0.03, 'square', 0.08); noise(t + 0.09, 0.07, 0.3, 2500); break
    case 'twinkle': [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, t + i * 0.07, 0.35, 'sine', 0.05)); break
    case 'meow': tone(700, t, 0.35, 'sawtooth', 0.06, undefined, 1100); tone(1100, t + 0.3, 0.3, 'sawtooth', 0.05, undefined, 600); break
    case 'woof': tone(220, t, 0.12, 'sawtooth', 0.14, undefined, 140); noise(t, 0.1, 0.2, 600); tone(240, t + 0.18, 0.12, 'sawtooth', 0.12, undefined, 150); break
    case 'rush': noise(t, 1.8, 0.9, 300); noise(t + 0.4, 1.0, 0.6, 1200); tone(55, t, 1.8, 'sawtooth', 0.15, undefined, 110); break
    case 'flicker': for (let i = 0; i < 5; i++) { noise(t + i * 0.11 + (i % 2) * 0.05, 0.04, 0.4, 3000); tone(120, t + i * 0.11, 0.05, 'square', 0.05) } break
    case 'heartbeat': for (let i = 0; i < 3; i++) { tone(60, t + i * 0.7, 0.15, 'sine', 0.5, undefined, 40); tone(55, t + i * 0.7 + 0.22, 0.15, 'sine', 0.4, undefined, 38) } break
    case 'scare': noise(t, 0.7, 0.6, 2400); tone(300, t, 0.7, 'sawtooth', 0.12, undefined, 1400); tone(310, t, 0.7, 'square', 0.06, undefined, 1500); break
    case 'train': for (let i = 0; i < 4; i++) noise(t + i * 0.13, 0.08, 0.3, 700); tone(440, t + 0.5, 0.5, 'square', 0.07); tone(554, t + 0.5, 0.5, 'square', 0.07); break
    case 'whistle': tone(1600, t, 0.55, 'sine', 0.1, undefined, 380); noise(t + 0.45, 0.2, 0.25, 700); break
    case 'pop': tone(500, t, 0.07, 'sine', 0.18, undefined, 1400); break
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
