import { motion } from 'framer-motion'
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addDays, dayNumber, formatLong, isToday, relativeDayLabel, todayISO, weekdayShort } from '../lib/date'
import { PARTNERS } from '../lib/constants'
import { playUiTick, playRollover } from '../lib/audio'
import { useOrbit } from '../lib/orbit-context'
import { pct } from '../lib/progress'
import { CalendarDrawer, type MonthCursor } from './CalendarDrawer'

interface DayMark {
  total: number
  done: number
  shivam: number
  noor: number
}

/** Small dual completion dots used on every day pill. */
function StatusDots({ mark }: { mark?: DayMark }) {
  const shivamOn = (mark?.shivam ?? 0) > 0
  const noorOn = (mark?.noor ?? 0) > 0

  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span
        className="size-[5px] rounded-full transition-all duration-300"
        style={{
          background: shivamOn ? PARTNERS.shivam.from : 'transparent',
          boxShadow: shivamOn ? `0 0 8px ${PARTNERS.shivam.from}` : 'none',
          border: shivamOn ? 'none' : '1px solid rgba(255,255,255,0.18)',
        }}
      />
      <span
        className="size-[5px] rounded-full transition-all duration-300"
        style={{
          background: noorOn ? PARTNERS.noor.from : 'transparent',
          boxShadow: noorOn ? `0 0 8px ${PARTNERS.noor.from}` : 'none',
          border: noorOn ? 'none' : '1px solid rgba(255,255,255,0.18)',
        }}
      />
    </span>
  )
}

export function DateRibbon() {
  const { allTasks, viewDate, setViewDate, goToToday, rollover, rolloverCount, viewProgress } = useOrbit()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cursor, setCursor] = useState<MonthCursor>(() => ({
    year: Number(viewDate.slice(0, 4)),
    month: Number(viewDate.slice(5, 7)) - 1,
  }))

  const openDrawer = () => {
    playUiTick()
    // Always re-centre the month view on the day being inspected.
    setCursor({ year: Number(viewDate.slice(0, 4)), month: Number(viewDate.slice(5, 7)) - 1 })
    setDrawerOpen(true)
  }

  const marks = useMemo(() => {
    const map = new Map<string, DayMark>()
    for (const task of allTasks) {
      const entry = map.get(task.date) ?? { total: 0, done: 0, shivam: 0, noor: 0 }
      entry.total += 1
      if (task.done) {
        entry.done += 1
        if (task.owner === 'shivam') entry.shivam += 1
        else entry.noor += 1
      }
      map.set(task.date, entry)
    }
    return map
  }, [allTasks])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(viewDate, i - 3)), [viewDate])
  const viewingToday = isToday(viewDate)

  return (
    <section className="glass p-3 sm:p-4" aria-label="Date navigator">
      {/* Desktop: single row. Mobile: wraps into two. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-0 items-baseline gap-2">
          <span className="label-mono">Timeline</span>
          <span className="truncate text-[12px] font-medium tracking-tight text-white/70">{relativeDayLabel(viewDate)}</span>
          {!viewingToday && (
            <button
              type="button"
              onClick={() => {
                playUiTick()
                goToToday()
              }}
              className="metric rounded-full border border-[#00F2FE]/25 px-2 py-0.5 text-[9px] tracking-[0.14em] text-[#00F2FE] transition-colors hover:bg-[#00F2FE]/10"
            >
              JUMP TO TODAY
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {rolloverCount > 0 ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playRollover()
                rollover()
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 text-[11px] font-medium tracking-tight text-[#F59E0B] transition-colors hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/16"
              title="Migrate unfinished tasks to today's board"
            >
              <RotateCcw className="size-3.5" strokeWidth={2.2} />
              <span>Rollover</span>
              <span className="metric rounded-full bg-[#F59E0B]/20 px-1.5 text-[10px]">{rolloverCount}</span>
            </motion.button>
          ) : (
            <span className="metric hidden h-8 items-center gap-1.5 rounded-full border border-white/[0.06] px-3 text-[10px] tracking-[0.12em] text-white/25 sm:inline-flex">
              ALL CAUGHT UP
            </span>
          )}

          <button
            type="button"
            onClick={openDrawer}
            className="icon-btn size-8"
            aria-label="Open month calendar"
            title="Jump to any date"
          >
            <CalendarDays className="size-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {/* 7-day ribbon */}
      <div className="scrollbar-none mt-3 flex items-stretch gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setViewDate(addDays(viewDate, -7))}
          className="icon-btn size-auto w-7 shrink-0 rounded-xl"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>

        {days.map((iso) => {
          const mark = marks.get(iso)
          const selected = iso === viewDate
          const today = iso === todayISO()
          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                if (iso !== viewDate) playUiTick()
                setViewDate(iso)
              }}
              aria-pressed={selected}
              aria-label={`${formatLong(iso)}${mark ? `, ${mark.done} of ${mark.total} done` : ', no tasks'}`}
              className={`group relative flex min-w-[62px] flex-1 shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-all duration-250 ${
                selected
                  ? 'border-white/[0.18] bg-white/[0.08]'
                  : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]'
              }`}
            >
              <span
                className={`label-mono ${today ? 'text-[#F59E0B]' : selected ? 'text-white/55' : 'text-white/30'}`}
              >
                {today ? 'TODAY' : weekdayShort(iso).toUpperCase()}
              </span>
              <span
                className={`metric text-[15px] leading-none font-medium ${
                  selected ? 'text-white' : today ? 'text-[#F59E0B]/90' : 'text-white/60'
                }`}
              >
                {dayNumber(iso)}
              </span>
              <StatusDots mark={mark} />
              {mark && mark.total > 0 && (
                <span className="metric text-[9px] text-white/25">
                  {mark.done}/{mark.total}
                </span>
              )}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setViewDate(addDays(viewDate, 7))}
          className="icon-btn size-auto w-7 shrink-0 rounded-xl"
          aria-label="Next week"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 border-t border-white/[0.08] pt-2">
        <span className="metric text-[10px] tracking-[0.12em] text-white/25">
          BOARD · {viewProgress.total} TASKS · {pct(viewProgress.sync)}% SYNCED
        </span>
        <span className="metric ml-auto hidden text-[10px] tracking-[0.12em] text-white/20 sm:inline">
          {formatLong(viewDate)}
        </span>
      </div>

      <CalendarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cursor={cursor}
        onCursorChange={setCursor}
      />
    </section>
  )
}
