import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { PARTNERS } from '../lib/constants'
import { monthGrid, monthIndexOf, monthName, todayISO, formatLong } from '../lib/date'
import { playUiTick } from '../lib/audio'
import { useOrbit } from '../lib/orbit-context'

export interface MonthCursor {
  year: number
  month: number
}

interface Props {
  open: boolean
  onClose: () => void
  /** Controlled month view, owned by the ribbon so opening always re-centres. */
  cursor: MonthCursor
  onCursorChange: (cursor: MonthCursor) => void
}

const WEEK_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Full month grid for jumping to any historical or future board. */
export function CalendarDrawer({ open, onClose, cursor, onCursorChange }: Props) {
  const { viewDate, setViewDate, allTasks } = useOrbit()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onCursorChange(shiftMonth(cursor, -1))
      if (event.key === 'ArrowRight') onCursorChange(shiftMonth(cursor, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, onCursorChange, cursor])

  const marks = useMemo(() => {
    const map = new Map<string, { s: number; n: number; total: number }>()
    for (const task of allTasks) {
      const entry = map.get(task.date) ?? { s: 0, n: 0, total: 0 }
      entry.total += 1
      if (task.done) {
        if (task.owner === 'shivam') entry.s += 1
        else entry.n += 1
      }
      map.set(task.date, entry)
    }
    return map
  }, [allTasks])

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const today = todayISO()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close calendar"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[10px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a date"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="glass relative z-10 w-full max-w-[400px] p-4"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCursorChange(shiftMonth(cursor, -1))}
                className="icon-btn size-8"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" strokeWidth={2} />
              </button>
              <div className="mr-auto text-center">
                <div className="text-[13px] font-medium tracking-tight text-white/90">
                  {monthName(cursor.month)} {cursor.year}
                </div>
                <div className="label-mono mt-0.5">Jump to any board</div>
              </div>
              <button
                type="button"
                onClick={() => onCursorChange(shiftMonth(cursor, 1))}
                className="icon-btn size-8"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" strokeWidth={2} />
              </button>
              <button type="button" onClick={onClose} className="icon-btn size-8" aria-label="Close calendar">
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1">
              {WEEK_HEADS.map((head, index) => (
                <div key={`${head}-${index}`} className="label-mono flex h-6 items-center justify-center">
                  {head}
                </div>
              ))}

              {cells.map((iso) => {
                const inMonth = monthIndexOf(iso) === cursor.month
                const selected = iso === viewDate
                const isTodayCell = iso === today
                const mark = marks.get(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      playUiTick()
                      setViewDate(iso)
                      onClose()
                    }}
                    aria-pressed={selected}
                    aria-label={`${formatLong(iso)}${mark && mark.total > 0 ? `, ${mark.s + mark.n} of ${mark.total} done` : ', no tasks'}`}
                    className={`relative flex h-10 flex-col items-center justify-center gap-1 rounded-xl border transition-all duration-200 ${
                      selected
                        ? 'border-white/[0.2] bg-white/[0.1]'
                        : isTodayCell
                          ? 'border-[#F59E0B]/35 bg-[#F59E0B]/[0.07]'
                          : 'border-transparent hover:border-white/[0.12] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span
                      className={`metric text-[12px] leading-none ${
                        selected
                          ? 'text-white'
                          : isTodayCell
                            ? 'text-[#F59E0B]'
                            : inMonth
                              ? 'text-white/65'
                              : 'text-white/20'
                      }`}
                    >
                      {Number(iso.slice(8, 10))}
                    </span>
                    <span className="flex h-[4px] items-center gap-[3px]">
                      {mark && mark.s > 0 && (
                        <span
                          className="size-[4px] rounded-full"
                          style={{ background: PARTNERS.shivam.from, boxShadow: `0 0 6px ${PARTNERS.shivam.from}` }}
                        />
                      )}
                      {mark && mark.n > 0 && (
                        <span
                          className="size-[4px] rounded-full"
                          style={{ background: PARTNERS.noor.from, boxShadow: `0 0 6px ${PARTNERS.noor.from}` }}
                        />
                      )}
                      {mark && mark.total > 0 && mark.s === 0 && mark.n === 0 && (
                        <span className="size-[4px] rounded-full border border-white/25" />
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-white/[0.08] pt-3">
              <span className="metric text-[10px] tracking-[0.12em] text-white/25">
                <span className="text-[#00F2FE]">●</span> SHIVAM&nbsp;&nbsp;
                <span className="text-[#FFB199]">●</span> NOOR
              </span>
              <button
                type="button"
                onClick={() => {
                  playUiTick()
                  setViewDate(today)
                  onCursorChange({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })
                  onClose()
                }}
                className="pill pill-hover ml-auto h-8"
              >
                <span className="metric text-[10px] tracking-[0.14em]">TODAY</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = cursor.month + delta
  if (next < 0) return { year: cursor.year - 1, month: 11 }
  if (next > 11) return { year: cursor.year + 1, month: 0 }
  return { year: cursor.year, month: next }
}
