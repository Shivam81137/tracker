import { motion } from 'framer-motion'
import { Activity, ArrowDown } from 'lucide-react'
import { PARTNERS, PARTNER_ORDER } from '../lib/constants'
import { formatLong, greeting, isToday, relativeDayLabel, toISODate, todayISO } from '../lib/date'
import { pct } from '../lib/progress'
import { useOrbit } from '../lib/orbit-context'
import { useNow } from '../hooks/useNow'
import { OrbitRings } from './OrbitRings'

function MetricCell({
  label,
  value,
  unit,
  highlight,
}: {
  label: string
  value: string | number
  unit?: string
  highlight?: string
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-black/10 p-3.5 backdrop-blur-md transition-all duration-300 hover:border-white/[0.18] hover:bg-white/[0.04]">
      <span className="label-mono text-[9.5px] text-white/50">{label}</span>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className="metric text-[20px] font-medium tracking-tight text-white/95"
          style={highlight ? { color: highlight } : undefined}
        >
          {value}
        </span>
        {unit && <span className="font-mono text-[10px] text-white/40 uppercase">{unit}</span>}
      </div>
    </div>
  )
}

/** Unified hero + dual progress hub with executive minimalist styling. */
export function Hero() {
  const { viewDate, viewProgress, todayProgress, streak, state } = useOrbit()
  const now = useNow(20_000)
  const today = toISODate(new Date(now))
  const signalsToday = state.nudges.filter((nudge) => toISODate(new Date(nudge.at)) === today).length
  const isCurrentDay = isToday(viewDate)
  const isDifferentFromToday = formatLong(viewDate) !== formatLong(todayISO())
  const partnerStats = PARTNER_ORDER.map((owner) => viewProgress[owner])

  return (
    <section className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-center py-6 sm:min-h-[calc(100svh-4rem)]">
      <div className="relative">
        {/* Subtle ambient border aura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px -z-10 rounded-[26px] bg-gradient-to-b from-white/[0.12] via-transparent to-transparent opacity-60"
        />

        <div className="overflow-hidden rounded-[24px] border border-white/[0.12] bg-black/[0.18] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.3)] backdrop-blur-[12px] sm:p-8 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[1.18fr_auto] lg:items-center lg:gap-12">
            {/* Left: readout */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                    Dual Progress Hub
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/20 px-2.5 py-1 backdrop-blur-md">
                  <span
                    className={`size-1.5 rounded-full ${
                      isCurrentDay ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/40'
                    }`}
                  />
                  <span className="metric text-[9.5px] uppercase tracking-[0.16em] text-white/60">
                    {isCurrentDay ? 'Live' : 'Archive'}
                  </span>
                </div>
              </div>

              <h1 className="mt-5 text-[clamp(32px,5.5vw,56px)] leading-[1.04] font-medium tracking-[-0.038em] text-white drop-shadow-sm">
                {relativeDayLabel(viewDate)}
              </h1>

              <p className="mt-3.5 max-w-[50ch] text-[13.5px] leading-relaxed font-normal text-white/70">
                {greeting()}, Shivam &amp; Noor.{' '}
                {viewProgress.total === 0 ? (
                  <>Both boards are clear — add the first task of the day below.</>
                ) : (
                  <>
                    <span className="text-white font-medium">{viewProgress.done}</span> of{' '}
                    <span className="text-white font-medium">{viewProgress.total}</span> tasks completed across both orbits.
                  </>
                )}
                {isDifferentFromToday && (
                  <span className="block mt-1 font-mono text-[11px] text-white/45">
                    Viewing record for {formatLong(viewDate)}.
                  </span>
                )}
              </p>

              {/* Per-partner cards */}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {partnerStats.map((stat) => {
                  const partner = PARTNERS[stat.owner]
                  const progressPct = pct(stat.ratio)
                  return (
                    <div
                      key={stat.owner}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.1] bg-black/[0.12] p-4 backdrop-blur-md transition-all duration-300 hover:border-white/[0.2] hover:bg-black/[0.22]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: partner.from,
                              boxShadow: stat.ratio > 0 ? `0 0 10px ${partner.from}` : 'none',
                            }}
                          />
                          <span className="text-[13px] font-medium tracking-tight text-white/95">
                            {partner.name}
                          </span>
                        </div>
                        <span
                          className="metric text-[14px] font-medium"
                          style={{ color: stat.ratio > 0 ? partner.from : 'rgba(255,255,255,0.45)' }}
                        >
                          {progressPct}%
                        </span>
                      </div>

                      <div className="my-3.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.1]">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressPct}%`,
                            background: `linear-gradient(90deg, ${partner.from}, ${partner.to})`,
                            boxShadow: stat.ratio > 0 ? `0 0 8px ${partner.from}` : 'none',
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-white/45">
                        <span className="font-mono text-[10px] tracking-wider uppercase">Status</span>
                        <span className="metric text-[10.5px] text-white/60">
                          {stat.done} <span className="text-white/25">/</span> {stat.total} tasks
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <MetricCell label="Today sync" value={pct(todayProgress.sync)} unit="%" />
                <MetricCell label="Streak" value={streak.current} unit="d" highlight="#F59E0B" />
                <MetricCell label="Best run" value={streak.best} unit="d" />
                <MetricCell label="Signals" value={signalsToday} unit="today" />
              </div>
            </div>

            {/* Right: rings */}
            <div className="flex flex-col items-center justify-center lg:border-l lg:border-white/[0.06] lg:pl-10">
              <OrbitRings progress={viewProgress} isToday={isCurrentDay} />
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 backdrop-blur-md">
                <Activity className="size-3 text-white/40" strokeWidth={2} />
                <span className="metric text-[10px] tracking-[0.16em] text-white/45">
                  {viewProgress.total === 0
                    ? 'AWAITING FIRST TASK'
                    : viewProgress.sync >= 1
                      ? 'PERFECT SYNC ACHIEVED'
                      : `${viewProgress.total - viewProgress.done} TASKS REMAINING`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Minimalist Scroll Indicator */}
      <motion.div
        aria-hidden="true"
        className="mt-6 flex items-center justify-center gap-2"
        animate={{ opacity: [0.25, 0.65, 0.25] }}
        transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      >
        <span className="font-mono text-[9.5px] tracking-[0.24em] text-white/30 uppercase">
          Scroll to explore timeline
        </span>
        <ArrowDown className="size-3 text-white/30" strokeWidth={1.8} />
      </motion.div>
    </section>
  )
}
