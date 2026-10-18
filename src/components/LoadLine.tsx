interface Props {
  /** 0..1 — how much of the splash sequence has streamed into memory. */
  progress: number
  done: boolean
  /** True when at least one frame failed, so the plate is only partially cached. */
  degraded: boolean
}

/**
 * Non-blocking boot affordance: a 2px hairline pinned to the very top edge.
 *
 * The workspace below renders and is fully interactive immediately — this only
 * reports splash-cache progress and then fades itself out. It is deliberately
 * plain CSS (no animation library) so its visibility never depends on a
 * requestAnimationFrame tick being available.
 */
export function LoadLine({ progress, done, degraded }: Props) {
  const pct = Math.round(progress * 100)

  return (
    <div
      aria-hidden="true"
      style={{ opacity: done ? 0 : 1 }}
      className="pointer-events-none fixed top-0 left-0 z-[60] h-[2px] w-full transition-opacity duration-500 ease-out"
    >
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{
          width: `${pct}%`,
          background: degraded
            ? 'linear-gradient(90deg, #F59E0B, #FFB199)'
            : 'linear-gradient(90deg, #00F2FE, #F59E0B, #FF0844)',
          boxShadow: degraded ? '0 0 8px rgba(245,158,11,0.45)' : '0 0 8px rgba(0,242,254,0.4)',
        }}
      />
    </div>
  )
}
