import { useMemo } from 'react'
import { addDays, formatLong, fromISODate, monthShort, todayISO } from '../lib/date'
import { useOrbit } from '../lib/orbit-context'

/** Rolling window shown in the heat map: 52 columns ≈ one year. */
const WEEKS = 52
const CELL = 11
const GAP = 2

const WEEKDAY_ROWS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const

/** Level → flavour, moving from cold cyan through amber to hot coral. */
const LEVEL_CLASS = [
  'bg-white/[0.045]',
  'bg-[#00F2FE]/25',
  'bg-[#00F2FE]/45',
  'bg-[#F59E0B]/70',
  'bg-[#FF0844]/85 shadow-[0_0_10px_rgba(255,8,68,0.55)]',
] as const

function levelFor(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

interface DayCount {
  total: number
  shivam: number
  noor: number
}

/**
 * GitHub-style contribution heat map for completed orbit tasks.
 *
 * Columns are weeks (Monday-first), rows are weekdays, and colour intensity
 * tracks how many tasks landed on that day. Horizontally scrollable with a
 * hidden scrollbar so a full six-month window never widens the page.
 */
export function ActivityHeatMap() {
  const { allTasks } = useOrbit()

  const { weeks, months, counts, today, totalDone, activeDays, bestDay } = useMemo(() => {
    const todayISOString = todayISO()
    const todayDate = fromISODate(todayISOString)
    const mondayIndex = (todayDate.getDay() + 6) % 7
    const endOfWeek = addDays(todayISOString, 6 - mondayIndex)
    const start = addDays(endOfWeek, -(WEEKS * 7 - 1))

    const tally = new Map<string, DayCount>()
    for (const task of allTasks) {
      if (!task.done || task.deleted) continue
      const entry = tally.get(task.date) ?? { total: 0, shivam: 0, noor: 0 }
      entry.total += 1
      if (task.owner === 'shivam') entry.shivam += 1
      else entry.noor += 1
      tally.set(task.date, entry)
    }

    const allDays: string[] = []
    for (let i = 0; i < WEEKS * 7; i += 1) allDays.push(addDays(start, i))

    const weekColumns: string[][] = []
    for (let w = 0; w < WEEKS; w += 1) weekColumns.push(allDays.slice(w * 7, w * 7 + 7))

    const monthSpans: { label: string; start: number; span: number }[] = []
    weekColumns.forEach((week, index) => {
      const label = monthShort(week[0])
      const last = monthSpans[monthSpans.length - 1]
      if (!last || last.label !== label) monthSpans.push({ label, start: index, span: 1 })
      else last.span += 1
    })

    let done = 0
    let active = 0
    let best = 0
    for (const day of allDays) {
      const entry = tally.get(day)
      if (!entry) continue
      done += entry.total
      active += 1
      if (entry.total > best) best = entry.total
    }

    return {
      weeks: weekColumns,
      months: monthSpans,
      counts: tally,
      today: todayISOString,
      totalDone: done,
      activeDays: active,
      bestDay: best,
    }
  }, [allTasks])

  return (
    <section className="glass flex flex-col p-4 sm:p-5" aria-label="Activity heat map">
      <div className="flex items-center gap-3">
        <span className="label-mono">Activity</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="metric text-[10px] tracking-[0.14em] text-white/30">LAST YEAR</span>
      </div>

      <div className="mt-4 flex gap-2.5">
        {/* Weekday gutter — spacer matches the month-label row height. */}
        <div className="flex shrink-0 flex-col">
          <span className="h-4" aria-hidden="true" />
          <div
            className="grid"
            style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
            aria-hidden="true"
          >
            {WEEKDAY_ROWS.map((label, index) => (
              <span
                key={index}
                className="flex items-center font-mono text-[8px] tracking-[0.08em] text-white/25"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="scrollbar-none min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="min-w-max">
            <div
              className="grid h-4"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, ${CELL}px)`, columnGap: GAP }}
              aria-hidden="true"
            >
              {months.map((month) => (
                <span
                  key={`${month.label}-${month.start}`}
                  style={{ gridColumn: `${month.start + 1} / span ${month.span}` }}
                  className="font-mono text-[8px] tracking-[0.14em] text-white/30 uppercase"
                >
                  {month.label}
                </span>
              ))}
            </div>

            <div
              className="grid"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridTemplateColumns: `repeat(${weeks.length}, ${CELL}px)`,
                gridAutoFlow: 'column',
                gap: GAP,
              }}
            >
              {weeks.flatMap((week) =>
                week.map((iso) => {
                  const entry = counts.get(iso)
                  const count = entry?.total ?? 0
                  const future = iso > today
                  const title = entry
                    ? `${formatLong(iso)} · ${count} completed · Shivam ${entry.shivam} · Noor ${entry.noor}`
                    : `${formatLong(iso)} · no tasks completed`
                  return (
                    <span
                      key={iso}
                      title={title}
                      className={`rounded-[3px] transition-colors duration-200 ${LEVEL_CLASS[levelFor(count)]} ${
                        future ? 'opacity-25' : ''
                      }`}
                    />
                  )
                }),
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stat label="Completed" value={totalDone} />
          <Stat label="Active days" value={activeDays} />
          <Stat label="Best day" value={bestDay} />
        </div>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="font-mono text-[8.5px] tracking-[0.12em] text-white/30 uppercase">Less</span>
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={`size-[11px] rounded-[3px] ${cls}`} />
          ))}
          <span className="font-mono text-[8.5px] tracking-[0.12em] text-white/30 uppercase">More</span>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="metric text-[12px] font-medium tracking-tight text-white/85">{value}</span>
      <span className="metric text-[9px] tracking-[0.12em] text-white/30 uppercase">{label}</span>
    </span>
  )
}
