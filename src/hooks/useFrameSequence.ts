import { useEffect, useState } from 'react'
import { FRAME_COUNT, PRELOAD_CONCURRENCY, framePath } from '../lib/constants'

export interface FrameSequence {
  images: HTMLImageElement[]
  loaded: number
  total: number
  /** 0..1 */
  progress: number
  done: boolean
  /** True when at least one frame failed to decode. */
  degraded: boolean
}

/**
 * Streams the extracted splash sequence into an in-memory `HTMLImageElement[]`
 * cache using a fixed-size worker pool, so the first paint never stalls behind
 * 128 parallel decodes.
 *
 * Counting is idempotent: every frame settles exactly once (loaded, errored or
 * verified via `complete`), so the progress readout can never drift.
 */
export function useFrameSequence(enabled = true): FrameSequence {
  // One stable array of image slots for the lifetime of the app.
  const [images] = useState<HTMLImageElement[]>(() =>
    Array.from({ length: FRAME_COUNT }, (_, index) => {
      const img = new Image()
      img.decoding = 'async'
      img.fetchPriority = index < 12 ? 'high' : 'low'
      img.alt = ''
      return img
    }),
  )

  const [loaded, setLoaded] = useState(0)
  const [done, setDone] = useState(false)
  const [degraded, setDegraded] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const settledFlags = new Array<boolean>(FRAME_COUNT).fill(false)
    let settledCount = 0
    let failed = false
    let nextIndex = 0
    let flushQueued = false

    function flush() {
      flushQueued = false
      if (cancelled) return
      setLoaded(settledCount)
      if (failed) setDegraded(true)
      if (settledCount >= FRAME_COUNT) setDone(true)
    }

    function schedule() {
      if (flushQueued || cancelled) return
      flushQueued = true
      // A timeout — not requestAnimationFrame — coalesces state updates and
      // still runs in background tabs where rAF is paused.
      window.setTimeout(flush, 24)
    }

    function mark(index: number, ok: boolean) {
      if (settledFlags[index]) return
      settledFlags[index] = true
      settledCount += 1
      if (!ok) failed = true
      schedule()
    }

    /** One worker: pull indices until it owns an in-flight frame. */
    function loadNext() {
      if (cancelled) return
      while (nextIndex < FRAME_COUNT) {
        const index = nextIndex
        nextIndex += 1
        const img = images[index]

        // Only trust the `complete` fast-path once a source exists — a bare
        // `new Image()` reports complete === true with no data behind it.
        if (img.src !== '' && img.complete) {
          mark(index, img.naturalWidth > 0)
          continue
        }

        img.onload = () => {
          mark(index, true)
          loadNext()
        }
        img.onerror = () => {
          mark(index, false)
          loadNext()
        }
        img.src = framePath(index)
        return
      }
    }

    for (let worker = 0; worker < PRELOAD_CONCURRENCY; worker++) loadNext()

    // Safety net: anything the browser considers complete without firing an
    // event still settles, so the progress line can never stall.
    const verify = window.setInterval(() => {
      if (cancelled) return
      for (let index = 0; index < FRAME_COUNT; index++) {
        if (settledFlags[index]) continue
        const img = images[index]
        if (img.src === '' || !img.complete) continue
        mark(index, img.naturalWidth > 0)
      }
      if (settledCount >= FRAME_COUNT) window.clearInterval(verify)
    }, 400)

    return () => {
      cancelled = true
      window.clearInterval(verify)
      for (const img of images) {
        img.onload = null
        img.onerror = null
      }
    }
  }, [enabled, images])

  return {
    images,
    loaded,
    total: FRAME_COUNT,
    progress: Math.min(1, loaded / FRAME_COUNT),
    done,
    degraded,
  }
}
