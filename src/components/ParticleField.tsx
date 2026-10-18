import { useEffect, useRef } from 'react'
import { onBurst, type BurstRequest } from '../lib/fx'
import { onTick } from '../lib/ticker'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: 'spark' | 'confetti' | 'ring'
  rot: number
  vr: number
  gravity: number
  drag: number
}

const MAX_PARTICLES = 900

/**
 * Additive canvas overlay that renders the nudge / sync celebrations. Shares the
 * global rAF ticker and idles completely when no particles are alive.
 */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1

    const measure = () => {
      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    measure()

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const spawn = (req: BurstRequest) => {
      if (reduceMotion) return
      const {
        x,
        y,
        colors,
        count = 36,
        power = 7,
        spread = Math.PI * 2,
        gravity = 0.055,
        style = 'spark',
      } = req
      const list = particlesRef.current
      const scaled = Math.round(count * Math.min(1.35, width / 1280 + 0.55))
      for (let i = 0; i < scaled; i++) {
        if (list.length >= MAX_PARTICLES) break
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread
        const speed = power * (0.35 + Math.random() * 0.9)
        const life = 620 + Math.random() * 900
        list.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          size: style === 'confetti' ? 3 + Math.random() * 5 : 1.4 + Math.random() * 2.6,
          color: colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff',
          shape: style,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.32,
          gravity,
          drag: 0.982,
        })
      }
      // Always pair bursts with a soft expanding ring for a premium feel.
      list.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 520,
        maxLife: 520,
        size: 6,
        color: colors[0] ?? '#ffffff',
        shape: 'ring',
        rot: 0,
        vr: 0,
        gravity: 0,
        drag: 1,
      })
    }

    const unsubscribeBurst = onBurst(spawn)

    const tick = (_dt: number) => {
      const list = particlesRef.current
      if (list.length === 0) {
        if (canvas.dataset.dirty === '1') {
          ctx.clearRect(0, 0, width, height)
          canvas.dataset.dirty = '0'
        }
        return
      }

      canvas.dataset.dirty = '1'
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]
        p.life -= 16.67
        if (p.life <= 0) {
          list.splice(i, 1)
          continue
        }

        const t = p.life / p.maxLife
        const alpha = Math.min(1, t * 1.35)

        if (p.shape === 'ring') {
          const eased = 1 - t
          const radius = p.size + eased * 70
          ctx.globalAlpha = alpha * 0.5
          ctx.strokeStyle = p.color
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
          ctx.stroke()
          continue
        }

        p.vy += p.gravity
        p.vx *= p.drag
        p.vy *= p.drag
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr

        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color

        if (p.shape === 'confetti') {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    const unsubscribeTick = onTick(tick)

    const onResize = () => {
      measure()
      ctx.clearRect(0, 0, width, height)
    }
    window.addEventListener('resize', onResize)

    return () => {
      unsubscribeBurst()
      unsubscribeTick()
      window.removeEventListener('resize', onResize)
      particlesRef.current = []
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 h-screen w-screen"
    />
  )
}
