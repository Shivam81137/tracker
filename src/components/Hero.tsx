import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { PARTNER_ORDER } from '../lib/constants'
import { dayNumber, formatLong, fromISODate, greeting, isToday, monthShort, relativeDayLabel, toISODate, todayISO, weekdayShort } from '../lib/date'
import { pct } from '../lib/progress'
import { useOrbit } from '../lib/orbit-context'
import { useNow } from '../hooks/useNow'

/** Minimal, transparent hero: just today's readout and a compact stat strip. */
export function Hero() {
  const { viewDate, viewProgress, todayProgress, streak, state } = useOrbit()
  const { viewDate, viewProgress, todayProgress, streak, state, currentUser, live } = useOrbit()
  const now = useNow(20_000)
  const today = toISODate(new Date(now))
  const signalsToday = state.nudges.filter((nudge) => toISODate(new Date(nudge.at)) === today).length
  const isCurrentDay = isToday(viewDate)
  const isDifferentFromToday = formatLong(viewDate) !== formatLong(todayISO())
  void PARTNER_ORDER

  return (
    <section className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-center py-6 sm:min-h-[calc(100svh-4rem)]">
      <div className="relative">
        <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-black/[0.25] p-5 sm:p-7 backdrop-blur-[8px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="size-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
                Dual Progress Hub
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 backdrop-blur-sm">
              <span
                className={`size-1.5 rounded-full ${
                  isCurrentDay ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-white/30'
                }`}
              />
              <span className="metric text-[9.5px] uppercase tracking-[0.16em] text-white/50">
                {isCurrentDay ? 'Live' : 'Archive'}
              </span>
            </div>
          </div>

          <h1 className="mt-4 text-[clamp(28px,5vw,48px)] leading-[1.02] font-medium tracking-[-0.04em] text-white drop-shadow-sm">
            {relativeDayLabel(viewDate)}
          </h1>

          <p className="mt-1 font-mono text-[10px] tracking-[0.24em] uppercase text-white/45">
            {weekdayShort(viewDate)} · {dayNumber(viewDate)} {monthShort(viewDate)} {new Date(fromISODate(viewDate)).getFullYear()}
          </p>

          <p className="mt-3 max-w-[48ch] text-[13px] leading-relaxed font-normal text-white/65">
            {greeting()}, Shivam &amp; Noor.{' '}
            {viewProgress.total === 0 ? (
              <>Both boards are clear — add the first task of the day below.</>
            ) : (
              <>
                <span className="text-white font-medium">{viewProgress.done}</span> of{' '}
                <span className="text-white font-medium">{viewProgress.total}</span> tasks completed.
              </>
            )}
            {isDifferentFromToday && (
              <span className="block mt-1 font-mono text-[10px] text-white/40">
                Viewing record for {formatLong(viewDate)}.
              </span>
            )}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MetricCell label="Today sync" value={pct(todayProgress.sync)} unit="%" />
            <MetricCell label="Streak" value={streak.current} unit="d" highlight="#F59E0B" />
            <MetricCell label="Best run" value={streak.best} unit="d" />
            <MetricCell label="Signals" value={signalsToday} unit="today" />
          </div>

          {/* Mobile Partner Presence & Status Card */}
          <div className="mt-4 flex sm:hidden items-center justify-between rounded-xl border border-white/[0.08] bg-black/30 p-3">
            {(() => {
              const partnerKey = currentUser === 'shivam' ? 'noor' : currentUser === 'noor' ? 'shivam' : null
              if (!partnerKey) {
                return (
                  <span className="text-[11px] text-white/60">
                    Identify your profile in settings to view live partner presence.
                  </span>
                )
              }
              const partnerInfo = live.partnerPresence
              const isOnline = partnerInfo?.isOnline
              const lastSeen = partnerInfo?.lastSeen
              const partnerName = partnerKey === 'shivam' ? 'Shivam' : 'Noor'
              const color = partnerKey === 'shivam' ? '#00F2FE' : '#FF0844'

              const timeAgoStr = (ts?: number) => {
                if (!ts) return 'recently'
                const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
                if (sec < 60) return `${sec}s ago`
                const min = Math.floor(sec / 60)
                if (min < 60) return `${min}m ago`
                const hr = Math.floor(min / 60)
                return `${hr}h ago`
              }

              return (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex size-2.5">
                      {isOnline && (
                        <span
                          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span
                        className="relative inline-flex size-2.5 rounded-full"
                        style={{ backgroundColor: isOnline ? color : 'rgba(255,255,255,0.3)' }}
                      />
                    </span>
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-white/90">
                        {partnerName} {isOnline ? 'Online Now ✨' : `Last Seen ${timeAgoStr(lastSeen)}`}
                      </div>
                      <div className="text-[9.5px] text-white/50">
                        {isOnline ? (partnerInfo?.currentActivity || 'Active on Tracker') : 'Offline'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('top')
                      if (el) el.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/80 border border-white/10"
                  >
                    Sync
                  </button>
                </>
              )
            })()}
          </div>


          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 backdrop-blur-sm">
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

      <motion.div
        aria-hidden="true"
        className="mt-5 flex items-center justify-center gap-2"
        animate={{ opacity: [0.2, 0.55, 0.2] }}
        transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      >
        <span className="font-mono text-[9px] tracking-[0.24em] text-white/25 uppercase">
          Scroll to explore timeline
        </span>
        <ArrowDown className="size-2.5 text-white/25" strokeWidth={1.8} />
      </motion.div>
    </section>
  )
}

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
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12]">
      <span className="label-mono text-[9px] text-white/40">{label}</span>
      <div className="mt-1.5 flex items-baseline gap-0.5">
        <span className="metric text-[17px] font-medium tracking-tight text-white/90" style={highlight ? { color: highlight } : undefined}>
          {value}
        </span>
        {unit && <span className="font-mono text-[9px] text-white/35 uppercase">{unit}</span>}
      </div>
    </div>
  )
}
