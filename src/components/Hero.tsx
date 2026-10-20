import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Clock } from 'lucide-react'
import { PARTNERS, PARTNER_ORDER } from '../lib/constants'
import { dayNumber, formatLong, fromISODate, greeting, isToday, monthShort, relativeDayLabel, toISODate, todayISO, weekdayShort } from '../lib/date'
import { pct } from '../lib/progress'
import { useOrbit } from '../lib/orbit-context'
import { useNow } from '../hooks/useNow'

const EASE = [0.16, 1, 0.3, 1] as const

/** Minimal, transparent hero: just today's readout and a compact stat strip. */
export function Hero() {
  const { viewDate, viewProgress, todayProgress, streak, state, currentUser, live } = useOrbit()
  const now = useNow(20_000)
  const today = toISODate(new Date(now))
  const signalsToday = state.nudges.filter((nudge) => toISODate(new Date(nudge.at)) === today).length
  const isCurrentDay = isToday(viewDate)
  const isDifferentFromToday = formatLong(viewDate) !== formatLong(todayISO())
  void PARTNER_ORDER

  return (
    <section
      aria-label="Daily focus cards"
      className="flex flex-col py-1 sm:py-2"
    >
      <div className="relative">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(12,13,18,0.8),rgba(7,7,9,0.58))] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 right-0 size-64 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.13),transparent_70%)]"
          />

          <div className="relative flex items-center justify-between gap-4">
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

          <div className="relative mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_268px] lg:items-center">
            <div className="min-w-0">
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h1
                    key={viewDate}
                    initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="font-display text-[clamp(42px,8.5vw,78px)] leading-[0.98] font-medium tracking-[-0.04em] text-white drop-shadow-sm"
                  >
                    {relativeDayLabel(viewDate)}
                  </motion.h1>
                </AnimatePresence>
              </div>

          <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="font-mono text-[13px] tracking-[0.22em] uppercase text-white/60 sm:text-[15px]">
              {weekdayShort(viewDate)} · {dayNumber(viewDate)} {monthShort(viewDate)} {new Date(fromISODate(viewDate)).getFullYear()}
            </p>
            <LiveClock />
          </div>

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
          {(() => {
            const partnerKey = currentUser === 'shivam' ? 'noor' : currentUser === 'noor' ? 'shivam' : null
            if (!partnerKey) return null
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
              <div className="mt-4 flex sm:hidden items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 backdrop-blur-md">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex size-2 shrink-0">
                    {isOnline && (
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span
                      className="relative inline-flex size-2 rounded-full"
                      style={{ backgroundColor: isOnline ? color : 'rgba(255,255,255,0.35)' }}
                    />
                  </span>
                  <div className="min-w-0 flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase">
                    <span className="font-semibold text-white/90">{partnerName}</span>
                    <span className="text-white/40">·</span>
                    <span style={{ color: isOnline ? color : 'rgba(255,255,255,0.6)' }}>
                      {isOnline ? 'Online Now' : `Last seen ${timeAgoStr(lastSeen)}`}
                    </span>
                  </div>
                </div>
                {partnerInfo?.currentActivity && isOnline && (
                  <span className="text-[9.5px] text-white/40 truncate max-w-[110px] font-mono">
                    {partnerInfo.currentActivity}
                  </span>
                )}
              </div>
            )
          })()}


          <div
            aria-live="polite"
            className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 backdrop-blur-sm"
          >
            <span
              className={`size-1.5 rounded-full ${
                viewProgress.total > 0 && viewProgress.sync >= 1
                  ? 'bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                  : 'bg-white/30'
              }`}
            />
            <span className="metric text-[10px] tracking-[0.16em] text-white/50">
              {viewProgress.total === 0
                ? 'AWAITING FIRST TASK'
                : viewProgress.sync >= 1
                  ? 'PERFECT SYNC ACHIEVED'
                  : `${viewProgress.total - viewProgress.done} TASKS REMAINING`}
            </span>
          </div>
            </div>

            <DualProgressPanel
              shivam={viewProgress.shivam}
              noor={viewProgress.noor}
              total={viewProgress.total}
              sync={viewProgress.sync}
            />
          </div>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        className="mt-5 flex items-center justify-center gap-2.5"
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      >
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/25" />
        <span className="font-mono text-[9px] tracking-[0.24em] text-white/30 uppercase">
          Scroll to timeline
        </span>
        <ArrowDown className="size-2.5 text-white/30" strokeWidth={1.8} />
      </motion.div>
    </section>
  )
}

/** Live wall clock pinned to Indian Standard Time. */
function LiveClock() {
  const now = useNow(1000)
  const ist = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
    .format(now)
    .toUpperCase()

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 backdrop-blur-sm"
      title="Indian Standard Time (Asia/Kolkata)"
    >
      <Clock className="size-3 text-[#F59E0B]" strokeWidth={2} />
      <span className="metric text-[11px] tracking-[0.08em] text-white/75 tabular-nums">{ist}</span>
      <span className="metric text-[9px] tracking-[0.16em] text-white/35">IST</span>
    </span>
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
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.045]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="label-mono text-[9px] text-white/40">{label}</span>
      <div className="mt-1.5 flex items-baseline gap-0.5">
        <span className="font-display text-[19px] leading-none font-medium tracking-tight text-white/92" style={highlight ? { color: highlight } : undefined}>
          {value}
        </span>
        {unit && <span className="font-mono text-[9px] text-white/35 uppercase">{unit}</span>}
      </div>
    </div>
  )
}

interface OrbitProgress {
  done: number
  total: number
  ratio: number
}

/** One partner's circular completion ring for the desktop hub. */
function OrbitRing({
  id,
  label,
  done,
  total,
  ratio,
  from,
  to,
  delay,
}: {
  id: string
  label: string
  done: number
  total: number
  ratio: number
  from: string
  to: string
  delay: number
}) {
  const radius = 27
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-[68px] shrink-0">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id={`orbit-ring-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={`url(#orbit-ring-${id})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - ratio) }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
            style={{ filter: `drop-shadow(0 0 5px ${from}66)` }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-[12px] font-medium tabular-nums text-white/85">
          {done}/{total}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: from }} />
          <span className="truncate text-[12px] font-medium tracking-tight text-white/85">{label}</span>
        </div>
        <div
          className="mt-1 font-display text-[18px] leading-none font-medium tabular-nums"
          style={{ color: from }}
        >
          {pct(ratio)}%
        </div>
      </div>
    </div>
  )
}

/** Desktop-only right rail: both partners' orbits side by side with the hub. */
function DualProgressPanel({
  shivam,
  noor,
  total,
  sync,
}: {
  shivam: OrbitProgress
  noor: OrbitProgress
  total: number
  sync: number
}) {
  return (
    <div className="hidden flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 backdrop-blur-sm lg:flex">
      <div className="flex items-center justify-between gap-2">
        <span className="label-mono text-[9px]">Partner orbits</span>
        <span className="metric text-[9px] tracking-[0.1em] text-white/25 uppercase">{total} tasks</span>
      </div>

      <OrbitRing
        id="shivam"
        label="Shivam"
        done={shivam.done}
        total={shivam.total}
        ratio={shivam.ratio}
        from={PARTNERS.shivam.from}
        to={PARTNERS.shivam.to}
        delay={0.08}
      />
      <OrbitRing
        id="noor"
        label="Noor"
        done={noor.done}
        total={noor.total}
        ratio={noor.ratio}
        from={PARTNERS.noor.from}
        to={PARTNERS.noor.to}
        delay={0.16}
      />

      <div className="mt-auto flex items-center justify-between border-t border-white/[0.07] pt-3">
        <span className="metric text-[9px] tracking-[0.12em] text-white/30 uppercase">Together</span>
        <span
          className="font-display text-[14px] font-medium tabular-nums"
          style={{ color: total > 0 && sync >= 1 ? '#34D399' : '#F59E0B' }}
        >
          {pct(sync)}%
        </span>
      </div>
    </div>
  )
}
