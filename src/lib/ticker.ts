/**
 * A single requestAnimationFrame ticker shared by the frame scrubber, the
 * particle field and the nav scrub indicator — one loop instead of three.
 */

type Tick = (dt: number, now: number) => void

const subscribers = new Set<Tick>()
let rafId = 0
let lastTime = 0

function loop(now: number) {
  rafId = requestAnimationFrame(loop)
  const dt = lastTime === 0 ? 16.67 : Math.min(64, now - lastTime)
  lastTime = now
  if (typeof document !== 'undefined' && document.hidden) return
  for (const fn of subscribers) {
    try {
      fn(dt, now)
    } catch (err) {
      // A failing subscriber must never kill the shared loop.
      console.error('[syncorbit] tick subscriber failed', err)
    }
  }
}

function start() {
  if (rafId !== 0) return
  lastTime = 0
  rafId = requestAnimationFrame(loop)
}

function stop() {
  if (rafId === 0) return
  cancelAnimationFrame(rafId)
  rafId = 0
  lastTime = 0
}

/** Subscribe to the shared animation loop. Returns an unsubscribe function. */
export function onTick(fn: Tick): () => void {
  subscribers.add(fn)
  start()
  return () => {
    subscribers.delete(fn)
    if (subscribers.size === 0) stop()
  }
}

/** Generic frame-rate independent interpolation toward a target. */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  const factor = 1 - Math.pow(1 - smoothing, dt / 16.67)
  return current + (target - current) * factor
}
