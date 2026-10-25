import { useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, Sparkles } from 'lucide-react'
import { useNow } from '../hooks/useNow'
import { PARTNERS } from '../lib/constants'
import { formatTime, fromISODate } from '../lib/date'
import { pct } from '../lib/progress'
import { useOrbit } from '../lib/orbit-context'
import type { Person, Task } from '../lib/types'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'

interface Props {
  owner: Person
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
] as const

type BoardFilter = (typeof FILTERS)[number]['id']

function dueAt(task: Task): number | null {
  if (!task.time) return null
  const [hours, minutes] = task.time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  const date = fromISODate(task.date)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

/** One partner's board: accent-tinted glass, live progress and filterable list. */
export function TaskBoard({ owner }: Props) {
  const { allTasks, viewDate, viewProgress, currentUser } = useOrbit()
  const [filter, setFilter] = useState<BoardFilter>('all')
  const now = useNow(30_000)

  const partner = PARTNERS[owner]
  const progress = viewProgress[owner]
  const isMine = currentUser === owner

  const tasks = useMemo(
    () =>
      allTasks
        .filter((task) => task.date === viewDate && task.owner === owner)
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1
          if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1
          if (a.time && !b.time) return -1
          if (!a.time && b.time) return 1
          return a.createdAt - b.createdAt
        }),
    [allTasks, owner, viewDate],
  )

  const { openTasks, doneTasks } = useMemo(
    () => ({
      openTasks: tasks.filter((task) => !task.done),
      doneTasks: tasks.filter((task) => task.done),
    }),
    [tasks],
  )

  const complete = progress.total > 0 && progress.done === progress.total
  const cheers = tasks.reduce((sum, task) => sum + task.cheers, 0)

  const nextTask = useMemo(
    () =>
      openTasks
        .filter((task) => Boolean(task.time))
        .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0],
    [openTasks],
  )
  const nextDue = nextTask ? dueAt(nextTask) : null
  const nextOverdue = Boolean(nextDue && now >= nextDue)

  const status =
    progress.total === 0
      ? 'No tasks yet'
      : complete
        ? 'All clear · everything done'
        : `${openTasks.length} open · ${doneTasks.length} done`

  const visible = filter === 'open' ? openTasks : filter === 'done' ? doneTasks : tasks
  const showGroups = filter === 'all' && openTasks.length > 0 && doneTasks.length > 0

  const theme = {
    '--board-accent': partner.from,
    '--board-accent-2': partner.to,
  } as CSSProperties

  return (
    <section
      className="board-card flex flex-col"
      style={theme}
      data-mine={isMine}
      aria-label={`${partner.name}'s board`}
    >
      {/* Top accent hairline */}
      <div
        aria-hidden="true"
        className="h-px w-full shrink-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${partner.from}, ${partner.to}, transparent)`,
          opacity: isMine ? 1 : 0.6,
        }}
      />

      <header className="relative px-4 pt-4 pb-3 sm:px-5">
        {/* Soft accent bloom behind the identity row */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-10 size-48 rounded-full opacity-70 blur-3xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${partner.from} 22%, transparent), transparent 70%)`,
          }}
        />

        <div className="relative flex items-center gap-3">
          <BoardAvatar owner={owner} ratio={progress.ratio} complete={complete} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-[14px] font-semibold tracking-tight text-white/97">
                {partner.name}&rsquo;s Orbit
              </h3>
              {isMine && (
                <span
                  className="shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold tracking-[0.16em] uppercase"
                  style={{
                    borderColor: `color-mix(in oklab, ${partner.from} 36%, transparent)`,
                    color: partner.from,
                    background: `color-mix(in oklab, ${partner.from} 10%, transparent)`,
                  }}
                >
                  You
                </span>
              )}
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10.5px] leading-none">
              <span
                className="size-1.5 shrink-0 rounded-full transition-colors duration-500"
                style={{
                  background: complete ? '#34D399' : openTasks.length > 0 ? partner.from : 'rgba(255,255,255,0.28)',
                  boxShadow: complete
                    ? '0 0 8px rgba(52,211,153,0.8)'
                    : openTasks.length > 0
                      ? `0 0 7px ${partner.from}99`
                      : undefined,
                }}
              />
              <span className="truncate text-white/60">{status}</span>
              {nextTask && (
                <>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span
                    className={`metric inline-flex shrink-0 items-center gap-1 ${
                      nextOverdue ? 'text-[#FF0844]' : 'text-white/60'
                    }`}
                    title={
                      nextOverdue
                        ? `Past its reminder — was due at ${formatTime(nextTask.time ?? '')}`
                        : `Next reminder at ${formatTime(nextTask.time ?? '')}`
                    }
                  >
                    <Clock className="size-2.5" strokeWidth={2.2} />
                    <span className="hidden min-[360px]:inline">{nextOverdue ? 'Due' : 'Next'}</span>
                    {formatTime(nextTask.time ?? '')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end">
            <div className="flex items-baseline gap-0.5">
              <motion.span
                key={pct(progress.ratio)}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="font-display text-[22px] leading-none font-semibold tracking-tight tabular-nums"
                style={{ color: progress.ratio > 0 ? partner.from : 'rgba(255,255,255,0.78)' }}
              >
                {pct(progress.ratio)}
              </motion.span>
              <span className="text-[10px] font-medium text-white/50">%</span>
            </div>
            <span className="metric mt-1.5 text-[9px] tracking-[0.12em] text-white/45 uppercase">
              {progress.done}/{progress.total} done
            </span>
          </div>
        </div>

        {/* Progress rail with a live light sweep */}
        <div className="relative mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.03] ring-inset">
          <motion.div
            className="relative h-full overflow-hidden rounded-full"
            initial={false}
            animate={{ width: `${Math.max(progress.ratio > 0 ? 2 : 0, progress.ratio * 100)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            style={{
              background: `linear-gradient(90deg, ${partner.from}, ${partner.to})`,
              boxShadow: `0 0 14px -2px ${partner.from}`,
            }}
          >
            {progress.ratio > 0 && (
              <span
                aria-hidden="true"
                className="animate-sweep absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]"
              />
            )}
          </motion.div>
        </div>
      </header>

      <QuickAdd owner={owner} />

      {tasks.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 pt-1 pb-2">
          <div
            className="segmented relative flex items-center gap-0.5 rounded-full p-0.5"
            role="group"
            aria-label={`Filter ${partner.name}'s tasks`}
          >
            {FILTERS.map((option) => {
              const count =
                option.id === 'all' ? tasks.length : option.id === 'open' ? openTasks.length : doneTasks.length
              const active = filter === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(option.id)}
                  className={`relative inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium tracking-tight transition-colors duration-200 ${
                    active ? 'text-white' : 'text-white/55 hover:text-white/84'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={`board-filter-${owner}`}
                      className="absolute inset-0 rounded-full border border-white/[0.1] bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    />
                  )}
                  <span className="relative">{option.label}</span>
                  <span className={`metric relative text-[9px] ${active ? 'text-white/72' : 'text-white/38'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            {cheers > 0 && (
              <motion.span
                key={cheers}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="metric inline-flex items-center gap-1 text-[9px] text-[#F59E0B]/75"
                title={`${cheers} cheers across this board`}
              >
                <Sparkles className="size-2.5" strokeWidth={2.2} />
                {cheers}
              </motion.span>
            )}
            <span
              className="metric hidden text-[9px] tracking-[0.12em] text-white/35 uppercase min-[380px]:inline"
              title="Sorted by status, then reminder time"
            >
              By time
            </span>
          </div>
        </div>
      )}

      <div className="min-h-[132px] flex-1 px-2 pb-2.5">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-7 text-center">
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
              className="grid size-9 place-items-center rounded-full border text-[13px]"
              style={{
                borderColor: `color-mix(in oklab, ${partner.from} 26%, transparent)`,
                color: `color-mix(in oklab, ${partner.from} 75%, transparent)`,
                background: `color-mix(in oklab, ${partner.from} 7%, transparent)`,
              }}
            >
              ✦
            </motion.span>
            <span className="text-[12px] font-medium tracking-tight text-white/72">Orbit pristine</span>
            <span className="max-w-[30ch] text-[10.5px] leading-relaxed text-white/46">
              Nothing on {partner.name}&rsquo;s board yet — add the first task above.
            </span>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('syncorbit:focus-add', { detail: { owner } }))
              }
              className="mt-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-tight text-white/76 transition-colors hover:border-white/[0.2] hover:text-white"
            >
              ＋ Add first task
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.07] bg-white/[0.008] px-4 py-6 text-center">
            <span className="label-mono text-[9px]">
              {filter === 'done' ? 'No completed tasks' : 'Nothing open'}
            </span>
            <span className="max-w-[28ch] text-[10.5px] leading-relaxed text-white/45">
              {filter === 'done'
                ? 'Tick a task off and it will land here.'
                : 'Everything on this board is done. Nice work.'}
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-tight text-white/76 transition-colors hover:border-white/[0.2] hover:text-white"
            >
              Show all
            </button>
          </div>
        ) : (
          <motion.ul layout data-filter={filter} className="flex flex-col" role="list">
            <AnimatePresence initial={false}>
              {showGroups && (
                <GroupLabel key="group-open" label="In progress" count={openTasks.length} />
              )}

              {(filter === 'done' ? [] : openTasks).map((task) => (
                <TaskRow key={task.id} task={task} now={now} />
              ))}

              {showGroups && <GroupLabel key="group-done" label="Completed" count={doneTasks.length} muted />}

              {(filter === 'open' ? [] : doneTasks).map((task) => (
                <TaskRow key={task.id} task={task} now={now} />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="mt-auto flex items-center gap-2 border-t border-white/[0.05] px-4 py-2">
          <span className="relative flex size-1.5 shrink-0">
            {complete && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34D399] opacity-60" />
            )}
            <span
              className="relative inline-flex size-1.5 rounded-full"
              style={{ background: complete ? '#34D399' : `${partner.from}aa` }}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-white/50">
            {complete ? (
              'Board cleared — everything done'
            ) : nextTask ? (
              <>
                Next up · <span className="text-white/80">{nextTask.title}</span>
              </>
            ) : (
              `${openTasks.length} task${openTasks.length === 1 ? '' : 's'} left`
            )}
          </span>
          <span className="metric shrink-0 text-[9px] tracking-[0.14em] text-white/35 uppercase">
            {progress.total} total
          </span>
        </div>
      )}
    </section>
  )
}

function BoardAvatar({ owner, ratio, complete }: { owner: Person; ratio: number; complete: boolean }) {
  const partner = PARTNERS[owner]
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, ratio))

  return (
    <div className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={`board-avatar-${owner}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={partner.from} />
            <stop offset="100%" stopColor={partner.to} />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <motion.circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={`url(#board-avatar-${owner})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          style={{ filter: `drop-shadow(0 0 4px ${partner.from}80)` }}
        />
      </svg>

      <span
        className="grid size-[30px] place-items-center rounded-full border text-[11px] font-semibold tracking-tight transition-colors duration-500"
        style={{
          borderColor: `color-mix(in oklab, ${partner.from} 38%, transparent)`,
          background: `color-mix(in oklab, ${partner.from} 13%, transparent)`,
          color: partner.from,
          boxShadow: complete ? `0 0 18px -4px ${partner.from}` : undefined,
        }}
      >
        {partner.initial}
      </span>

      <AnimatePresence>
        {complete && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 24 }}
            className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-[#34D399] text-[#041014] shadow-[0_0_10px_rgba(52,211,153,0.75)]"
          >
            <Check className="size-2.5" strokeWidth={3.6} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function GroupLabel({ label, count, muted = false }: { label: string; count: number; muted?: boolean }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
      role="presentation"
    >
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <span className={`label-mono text-[9px] ${muted ? 'text-white/42' : 'text-white/60'}`}>{label}</span>
        <span className="h-px flex-1 bg-white/[0.055]" />
        <span className="metric text-[9px] text-white/38">{count}</span>
      </div>
    </motion.li>
  )
}
