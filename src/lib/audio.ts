/**
 * Synthesised UI sound — pure Web Audio, no assets, no network.
 * The context is created lazily on the first user gesture so browsers
 * never block us with an autoplay policy violation.
 */

type Ctx = AudioContext & { __orbitMaster?: GainNode }

let ctx: Ctx | null = null
let master: GainNode | null = null
let enabled = true

function getCtx(): Ctx | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor() as Ctx
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

/** Call from any user gesture to unlock audio on iOS/Safari. */
export function primeAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume()
}

export function setSoundEnabled(next: boolean): void {
  enabled = next
  if (master && ctx) master.gain.setTargetAtTime(next ? 0.5 : 0, ctx.currentTime, 0.02)
}

export function isSoundEnabled(): boolean {
  return enabled
}

interface ToneOptions {
  freq: number
  start: number
  duration: number
  type?: OscillatorType
  gain?: number
  /** End frequency for a glide. */
  glideTo?: number
  attack?: number
}

function tone(c: Ctx, out: GainNode, opts: ToneOptions): void {
  const { freq, start, duration, type = 'sine', gain = 0.2, glideTo, attack = 0.012 } = opts
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glideTo && glideTo !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), start + duration)
  }
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(env)
  env.connect(out)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function ready(): { c: Ctx; out: GainNode } | null {
  if (!enabled) return null
  const c = getCtx()
  if (!c || !master) return null
  if (c.state === 'suspended') void c.resume()
  return { c, out: master }
}

/**
 * Harmonic chime for a partner nudge: fundamental + fifth + octave + a soft
 * third partial, with a gentle upward shimmer.
 */
export function playChime(root: number): void {
  const r = ready()
  if (!r) return
  const { c, out } = r
  const t0 = c.currentTime + 0.01
  const partials: Array<[number, number, number, OscillatorType]> = [
    [root, 0.24, 0.9, 'sine'],
    [root * 1.5, 0.15, 0.72, 'triangle'],
    [root * 2, 0.1, 0.6, 'sine'],
    [root * 3, 0.045, 0.42, 'sine'],
  ]
  for (const [freq, gain, dur, type] of partials) {
    tone(c, out, { freq, start: t0, duration: dur, type, gain, attack: 0.008 })
  }
  // Sparkle tail
  tone(c, out, { freq: root * 4, start: t0 + 0.06, duration: 0.5, type: 'sine', gain: 0.035 })
}

/** Micro click for checkbox interactions: rising when done, falling when undone. */
export function playTick(done: boolean): void {
  const r = ready()
  if (!r) return
  const { c, out } = r
  const t0 = c.currentTime + 0.005
  if (done) {
    tone(c, out, { freq: 1180, glideTo: 1680, start: t0, duration: 0.11, type: 'sine', gain: 0.16, attack: 0.004 })
    tone(c, out, { freq: 2360, start: t0 + 0.01, duration: 0.07, type: 'sine', gain: 0.05 })
  } else {
    tone(c, out, { freq: 900, glideTo: 560, start: t0, duration: 0.1, type: 'sine', gain: 0.13, attack: 0.004 })
  }
}

/** Cheer sparkle — a short bright arpeggio. */
export function playSparkle(): void {
  const r = ready()
  if (!r) return
  const { c, out } = r
  const t0 = c.currentTime + 0.005
  ;[1318.5, 1760, 2093.0].forEach((freq, i) => {
    tone(c, out, { freq, start: t0 + i * 0.045, duration: 0.24, type: 'triangle', gain: 0.09, attack: 0.005 })
  })
}

/** Soft swipe used by the rollover migration. */
export function playRollover(): void {
  const r = ready()
  if (!r) return
  const { c, out } = r
  const t0 = c.currentTime + 0.005
  tone(c, out, { freq: 240, glideTo: 720, start: t0, duration: 0.34, type: 'triangle', gain: 0.11, attack: 0.02 })
  tone(c, out, { freq: 360, glideTo: 1080, start: t0 + 0.05, duration: 0.3, type: 'sine', gain: 0.07 })
}

/** Reward motif when a shared 100% sync is reached. */
export function playFanfare(): void {
  const r = ready()
  if (!r) return
  const { c, out } = r
  const t0 = c.currentTime + 0.01
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
  notes.forEach((freq, i) => {
    tone(c, out, { freq, start: t0 + i * 0.075, duration: 0.6, type: 'sine', gain: 0.14, attack: 0.008 })
    tone(c, out, { freq: freq * 2, start: t0 + i * 0.075, duration: 0.35, type: 'triangle', gain: 0.045 })
  })
}

/** Subtle interface tick for non-primary affordances. */
export function playUiTick(): void {
  const r = ready()
  if (!r) return
  const { c, out } = r
  tone(c, out, { freq: 1560, start: c.currentTime + 0.004, duration: 0.05, type: 'sine', gain: 0.06, attack: 0.003 })
}
