/** Tiny pub/sub bridge so any component can fire a particle burst. */

export interface BurstRequest {
  x: number
  y: number
  colors: string[]
  count?: number
  power?: number
  spread?: number
  gravity?: number
  /** Particle shape flavour. */
  style?: 'spark' | 'confetti' | 'ring'
}

type Handler = (burst: BurstRequest) => void

const handlers = new Set<Handler>()

export function onBurst(handler: Handler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

export function fireBurst(request: BurstRequest): void {
  for (const handler of handlers) handler(request)
}

/** Fire a burst anchored to the centre of an element. */
export function burstFromElement(
  el: Element | null | undefined,
  colors: string[],
  options: Omit<BurstRequest, 'x' | 'y' | 'colors'> = {},
): void {
  if (!el) {
    fireBurst({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.4,
      colors,
      ...options,
    })
    return
  }
  const rect = el.getBoundingClientRect()
  fireBurst({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    colors,
    ...options,
  })
}
