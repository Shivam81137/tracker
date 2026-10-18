import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { PARTNERS } from '../lib/constants'
import { pct } from '../lib/progress'
import type { DayProgress } from '../lib/types'

interface Props {
  progress: DayProgress
  /** Whether the readout is for today or an archived day. */
  isToday: boolean
}

const SIZE = 232
const CENTER = SIZE / 2
const OUTER_R = 96
const INNER_R = 68
const OUTER_C = 2 * Math.PI * OUTER_R
const INNER_C = 2 * Math.PI * INNER_R
const SPRING = { type: 'spring', stiffness: 120, damping: 22, mass: 0.9 } as const

/**
 * Interlocking concentric progress rings.
 * Outer = Shivam (cyan), inner = Noor (coral), centre = combined daily sync.
 * Both rings pulse with an amber halo once the day reaches 100%.
 */
export function OrbitRings({ progress, isToday }: Props) {
  const synced = progress.total > 0 && progress.sync >= 1
  const shivam = progress.shivam
  const noor = progress.noor
  const syncPct = pct(progress.sync)

  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

  return (
    <div className="relative flex items-center justify-center">
      {/* Amber halo pulse on full sync */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_52%,rgba(245,158,11,0.28)_70%,transparent_76%)]"
        animate={{
          opacity: synced ? [0.5, 1, 0.5] : 0,
          scale: synced ? [0.96, 1.04, 0.96] : 0.94,
        }}
        transition={{ duration: 3.2, repeat: synced ? Number.POSITIVE_INFINITY : 0, ease: 'easeInOut' }}
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="relative z-10 h-auto w-[clamp(180px,44vw,232px)] overflow-visible"
        role="img"
        aria-label={`Combined sync ${syncPct} percent. ${PARTNERS.shivam.name} ${pct(shivam.ratio)} percent. ${PARTNERS.noor.name} ${pct(noor.ratio)} percent.`}
      >
        <defs>
          <linearGradient id="ring-shivam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#4FACFE" />
          </linearGradient>
          <linearGradient id="ring-noor" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFB199" />
            <stop offset="100%" stopColor="#FF0844" />
          </linearGradient>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Micro tick bezel */}
        <g opacity={0.5}>
          {ticks.map((tick) => {
            const angle = (tick / ticks.length) * Math.PI * 2 - Math.PI / 2
            const outer = OUTER_R + 13
            const inner = OUTER_R + (tick % 5 === 0 ? 7 : 10)
            return (
              <line
                key={tick}
                x1={CENTER + Math.cos(angle) * inner}
                y1={CENTER + Math.sin(angle) * inner}
                x2={CENTER + Math.cos(angle) * outer}
                y2={CENTER + Math.sin(angle) * outer}
                stroke="white"
                strokeOpacity={tick % 5 === 0 ? 0.22 : 0.1}
                strokeWidth={1}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* Tracks */}
        <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
        <circle cx={CENTER} cy={CENTER} r={INNER_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />

        {/* Shivam — outer cyan ring */}
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke="url(#ring-shivam)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={OUTER_C}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          filter={shivam.ratio > 0 ? 'url(#ring-glow)' : undefined}
          initial={false}
          animate={{ strokeDashoffset: OUTER_C * (1 - shivam.ratio) }}
          transition={SPRING}
        />

        {/* Noor — inner coral ring */}
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R}
          fill="none"
          stroke="url(#ring-noor)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={INNER_C}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          filter={noor.ratio > 0 ? 'url(#ring-glow)' : undefined}
          initial={false}
          animate={{ strokeDashoffset: INNER_C * (1 - noor.ratio) }}
          transition={{ ...SPRING, delay: 0.06 }}
        />
      </svg>

      {/* Centre readout */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
        <span
          className={`metric text-[clamp(28px,7vw,40px)] leading-none font-semibold tracking-[-0.03em] ${
            synced ? 'text-[#F59E0B] text-glow-sync' : 'text-white/95'
          }`}
        >
          {syncPct}
          <span className="ml-0.5 text-[0.42em] align-super font-medium">%</span>
        </span>
        <span className={`label-mono mt-1.5 ${synced ? 'text-[#F59E0B]/80' : ''}`}>
          {synced ? 'PERFECT SYNC' : 'SYNC'}
        </span>
        <span className="metric mt-1 text-[10px] text-white/35">
          {progress.done}/{progress.total} {isToday ? 'TODAY' : 'DONE'}
        </span>
      </div>
    </div>
  )
}
