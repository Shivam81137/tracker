import { motion } from 'framer-motion'
import { useRef } from 'react'
import { NUDGES, NUDGE_MAP } from '../lib/constants'
import { relativeFromNow } from '../lib/date'
import { playUiTick } from '../lib/audio'
import { useOrbit } from '../lib/orbit-context'
import { clockLabel, useNow } from '../hooks/useNow'

/** One-tap partner signals: chime + toast + particle burst + cross-tab broadcast. */
export function NudgeDock() {
  const { sendNudge, lastNudge, live } = useOrbit()
  const dockRef = useRef<HTMLDivElement | null>(null)
  const now = useNow()

  return (
    <section className="glass p-4 sm:p-5" aria-label="Partner nudge dock">
      <div ref={dockRef} className="flex flex-wrap items-center gap-y-3">
        <div className="mr-auto flex min-w-0 flex-col pr-3">
          <span className="label-mono">Partner nudge</span>
          <span className="mt-0.5 text-[11px] text-white/40">
            {live.supported ? 'Beams instantly to your partner across phones & tabs.' : 'Cloud sync channel unavailable in this browser.'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {NUDGES.map((nudge) => (
            <motion.button
              key={nudge.kind}
              type="button"
              whileTap={{ scale: 0.94 }}
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={(event) => {
                playUiTick()
                sendNudge(nudge.kind, event.currentTarget)
              }}
              className="group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 text-[12px] font-medium tracking-tight text-white/75 backdrop-blur-[20px] transition-colors duration-200 hover:border-[#F59E0B]/35 hover:bg-[#F59E0B]/10 hover:text-white active:border-[#F59E0B]/50"
              aria-label={`Send ${nudge.label} nudge to your partner`}
            >
              <span className="text-[13px] transition-transform duration-300 group-hover:scale-110">{nudge.emoji}</span>
              <span>{nudge.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-2.5">
        <span className="metric text-[10px] tracking-[0.12em] text-white/30">
          {lastNudge
            ? `LAST · ${NUDGE_MAP[lastNudge.kind].label.toUpperCase()} · ${
                lastNudge.source === 'self' ? 'SENT' : 'RECEIVED'
              } · ${relativeFromNow(lastNudge.at)}`
            : 'NO SIGNALS SENT YET'}
        </span>
        <span className="metric hidden text-[10px] tracking-[0.12em] text-white/25 sm:inline" title="Local time">
          {clockLabel(now)}
        </span>
      </div>
    </section>
  )
}
