import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { BRAND } from '../lib/constants'
import { activeDates } from '../lib/storage'
import { useOrbit } from '../lib/orbit-context'
import { addDays, todayISO, weekdayShort } from '../lib/date'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 sm:border-l sm:border-white/[0.06] sm:pl-5 sm:first:border-l-0 sm:first:pl-0">
      <div className="label-mono text-[9.5px] text-white/45">{label}</div>
      <div
        className="font-display mt-2.5 text-[clamp(26px,5vw,38px)] leading-none font-medium"
        style={{ color: tone ?? 'rgba(255,255,255,0.95)' }}
      >
        {value}
      </div>
    </div>
  )
}

/** Compact seven-day sparkline of completed tasks. */
function WeekRhythm() {
  const { allTasks } = useOrbit()

  const days = useMemo(() => {
    const today = todayISO()
    const tally = new Map<string, number>()
    for (const task of allTasks) {
      if (!task.done || task.deleted) continue
      tally.set(task.date, (tally.get(task.date) ?? 0) + 1)
    }
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(today, i - 6)
      return { iso, count: tally.get(iso) ?? 0 }
    })
  }, [allTasks])

  const max = Math.max(1, ...days.map((day) => day.count))
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const label = days.map((day) => `${weekdayShort(day.iso)} ${day.count}`).join(', ')

  return (
    <div className="mt-5 border-t border-white/[0.07] pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono text-[9px]">Last 7 days</span>
        <span className="metric text-[9px] tracking-[0.12em] text-white/30 uppercase">{total} done</span>
      </div>

      <div
        role="img"
        aria-label={`Completed tasks over the last seven days: ${label}`}
        className="mt-3 flex items-end justify-between gap-1.5"
      >
        {days.map((day, index) => {
          const isToday = index === days.length - 1
          return (
            <div key={day.iso} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${weekdayShort(day.iso)} · ${day.count} done`}>
              <div className="flex h-11 w-full items-end">
                <motion.span
                  initial={{ scaleY: 0.12, opacity: 0.4 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
                  className="w-full origin-bottom rounded-[3px]"
                  style={{
                    height: `${Math.max(12, (day.count / max) * 100)}%`,
                    background:
                      day.count > 0
                        ? 'linear-gradient(180deg, #F59E0B, rgba(0,242,254,0.55))'
                        : 'rgba(255,255,255,0.14)',
                    boxShadow: day.count > 0 ? '0 0 12px -4px rgba(245,158,11,0.7)' : undefined,
                  }}
                />
              </div>
              <span
                className={`metric text-[8px] tracking-[0.08em] uppercase ${
                  isToday ? 'text-[#F59E0B]' : 'text-white/35'
                }`}
              >
                {weekdayShort(day.iso).slice(0, 1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Closing orbit log.
 *
 * Shares the same frosted surface as the rest of the bento so the all-time
 * figures read as part of the system rather than a separate plate. Only labels
 * and figures: no explanatory copy competing with the splash.
 */
export function OrbitLog() {
  const { allTasks, streak } = useOrbit()
  const tracked = activeDates(allTasks).length
  const completed = allTasks.filter((task) => task.done).length

  return (
    <section
      aria-label="Orbit log"
      className="glass glass-interactive p-4 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="label-mono">Orbit log</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="metric text-[10px] tracking-[0.14em] text-white/30">ALL TIME</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="Current streak" value={String(streak.current)} tone="#F59E0B" />
        <Stat label="Best run" value={String(streak.best)} />
        <Stat label="Active days" value={String(tracked)} />
        <Stat label="Completed" value={String(completed)} />
      </div>

      <WeekRhythm />
    </section>
  )
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.07] bg-black/[0.18] backdrop-blur-[6px]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 text-[11px] tracking-tight text-white/40">
          <img src="/logo.png" alt="SyncOrbit" className="size-4 object-contain" />
          <span className="font-display tracking-[0.2em] uppercase">{BRAND.name}</span>
          <span className="hidden text-white/20 sm:inline">— {BRAND.tagline}</span>
        </span>

        <span className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] text-white/25 uppercase sm:inline-flex">
            <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1 py-px text-[8px] text-white/45">N</kbd>
            new task
            <span className="text-white/15">·</span>
            <kbd className="rounded border border-white/[0.1] bg-white/[0.04] px-1 py-px text-[8px] text-white/45">T</kbd>
            today
          </span>

          <a
            href="#top"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-tight text-white/45 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white/80"
          >
            Top
            <ArrowUp className="size-3" strokeWidth={2.2} />
          </a>
        </span>
      </div>
    </footer>
  )
}
