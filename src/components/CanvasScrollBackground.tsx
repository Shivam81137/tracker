import { useEffect, useRef } from 'react'
import { DECODE_WINDOW, FRAME_COUNT, SCRUB_LERP } from '../lib/constants'
import { damp, onTick } from '../lib/ticker'

interface Props {
  images: HTMLImageElement[]
  /** 0..1 readiness, used to fade the plate in once frames exist. */
  reveal: boolean
  /** Settled frame count — used to force an immediate first paint. */
  loaded: number
}

const MAX_DPR = 2

/**
 * Fixed, full-viewport scroll-scrubbed frame player — the Red Velvet Ice Cream
 * canvas that sits behind every layer of the workspace.
 *
 * - `object-fit: cover` maths keeps the 2226×1440 plate proportional on both
 *   ultrawide desktops and tall mobile viewports (no stretching, ever).
 * - `devicePixelRatio` aware backing store (capped at 2) for Retina sharpness.
 * - `window.scrollY` is mapped to a fractional frame index and eased with
 *   frame-rate independent damping, so scrubbing is smooth in both directions.
 */
export function CanvasScrollBackground({ images, reveal, loaded }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1

    let current = 0
    let target = 0
    let firstPaintDone = false
    let lastDecodeAnchor = -999

    const measure = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1))
      if (width === cssWidth && height === cssHeight && canvas.width === Math.round(width * dpr)) return
      cssWidth = width
      cssHeight = height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      firstPaintDone = false
    }

    measure()

    const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight)

    /** Warm a rolling window of neighbours so scrubbing never shows a blank. */
    const warmNeighbours = (index: number) => {
      if (Math.abs(index - lastDecodeAnchor) < DECODE_WINDOW / 2) return
      lastDecodeAnchor = index
      const from = Math.max(0, index - DECODE_WINDOW)
      const to = Math.min(FRAME_COUNT - 1, index + DECODE_WINDOW)
      for (let i = from; i <= to; i++) {
        const img = images[i]
        if (!img || img.complete) continue
        void img.decode?.().catch(() => {
          /* decode() rejects on abort — the draw path falls back gracefully */
        })
      }
    }

    const draw = () => {
      const img = images[Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(current)))]
      if (!img || !img.complete || img.naturalWidth === 0) return

      const progress = FRAME_COUNT <= 1 ? 0 : current / (FRAME_COUNT - 1)
      // Cinematic settle: the plate eases from a 6% crop to 1:1 as you scrub.
      const zoom = 1.06 - 0.06 * progress
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const scale = Math.max(cssWidth / iw, cssHeight / ih) * zoom
      const dw = iw * scale
      const dh = ih * scale
      const dx = (cssWidth - dw) / 2
      // Gentle vertical parallax gives the splash depth without exposing edges.
      const dy = (cssHeight - dh) / 2 - (progress - 0.5) * dh * 0.035

      ctx.fillStyle = '#070709'
      ctx.fillRect(0, 0, cssWidth, cssHeight)
      ctx.drawImage(img, dx, dy, dw, dh)
      firstPaintDone = true
    }

    const tick = () => {
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll()))
      target = progress * (FRAME_COUNT - 1)
      const next = damp(current, target, SCRUB_LERP, 16.67)
      const settled = Math.abs(next - target) < 0.0005
      const changed = Math.abs(next - current) > 0.0005 || !firstPaintDone
      current = settled ? target : next
      if (!changed) return
      warmNeighbours(Math.round(current))
      draw()
    }

    drawRef.current = () => {
      target = Math.min(1, Math.max(0, window.scrollY / maxScroll())) * (FRAME_COUNT - 1)
      current = target
      warmNeighbours(Math.round(current))
      draw()
    }

    const unobserve = onTick(tick)

    const onResize = () => {
      measure()
      draw()
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    // Content height can change (tasks added, drawers opened) — keep the map honest.
    const ro = new ResizeObserver(() => {
      measure()
      draw()
    })
    ro.observe(document.body)

    return () => {
      unobserve()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      ro.disconnect()
      drawRef.current = null
    }
  }, [images])

  // Paint immediately whenever new frames settle — the first plate appears
  // without waiting for the next animation frame.
  useEffect(() => {
    drawRef.current?.()
  }, [loaded, reveal])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen transition-opacity duration-[1200ms] ease-out"
      style={{ opacity: reveal ? 1 : 0 }}
    />
  )
}
