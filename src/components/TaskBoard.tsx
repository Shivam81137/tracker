import { AnimatePresence, motion } from 'framer-motion'
import { PARTNERS } from '../lib/constants'
import { pct } from '../lib/progress'
import { useOrbit } from '../lib/orbit-context'
import type { Person } from '../lib/types'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'

interface Props {
  owner: Person
}

/** One partner's ultra-thin board. Starts empty by design. */
export function TaskBoard({ owner }: Props) {
  const { allTasks, viewDate, viewProgress, currentUser } = useOrbit()
  const partner = PARTNERS[owner]
  const progress = viewProgress[owner]
  const isMine = currentUser === owner
  const tasks = allTasks
    .filter((task) => task.date === viewDate && task.owner === owner)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1
      if (a.time && !b.time) return -1
      if (!a.time && b.time) return 1
      return a.createdAt - b.createdAt
    })

  const complete = progress.total > 0 && progress.done === progress.total

  return (
    <section
      className={`glass glass-interactive group flex flex-col overflow-hidden ${
        isMine ? 'ring-1 ring-white/[0.05]' : ''
      }`}
      aria-label={`${partner.name}'s board`}
    >
      {/* Accent hairline */}
      <div
        className="h-px w-full shrink-0 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${partner.from}, ${partner.to}, transparent)`,
          opacity: isMine ? 1 : 0.55,
        }}
      />

      <header className="flex items-center gap-3 px-4 pt-3.5 pb-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full border text-[11px] font-semibold"
          style={{
            borderColor: `color-mix(in oklab, ${partner.from} 35%, transparent)`,
            color: partner.from,
            background: `color-mix(in oklab, ${partner.from} 10%, transparent)`,
            boxShadow: complete ? `0 0 22px -6px ${partner.from}` : 'none',
          }}
        >
          {partner.initial}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[13px] font-medium tracking-tight text-white/92">
            <span className="truncate">{partner.name}&rsquo;s Orbit</span>
            {isMine && (
              <span
                className="shrink-0 rounded-full border px-1.5 py-px text-[8px] font-semibold tracking-[0.14em] uppercase"
                style={{
                  borderColor: `color-mix(in oklab, ${partner.from} 35%, transparent)`,
                  color: partner.from,
                  background: `color-mix(in oklab, ${partner.from} 10%, transparent)`,
                }}
              >
                You
              </span>
            )}
            <span className="metric text-[10px] text-white/35">
              {progress.done}/{progress.total}
            </span>
          </h3>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full origin-left rounded-full"
              style={{
                background: `linear-gradient(90deg, ${partner.from}, ${partner.to})`,
                boxShadow: `0 0 12px -1px ${partner.from}`,
              }}
              initial={false}
              animate={{ scaleX: progress.ratio }}
              transition={{ type: 'spring', stiffness: 140, damping: 24 }}
            />
          </div>
        </div>

        <span
          aria-live="polite"
          className="font-display shrink-0 text-[12px] font-medium tracking-tight text-white/50"
          style={{ color: progress.ratio > 0 ? partner.from : undefined }}
        >
          {pct(progress.ratio)}%
        </span>
      </header>

      <QuickAdd owner={owner} />

      <div className="min-h-[132px] flex-1 px-1.5 pb-2.5">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.012] px-4 py-6 text-center transition-colors duration-300 group-hover:border-white/[0.12]">
            <span
              className="grid size-7 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px]"
              style={{ color: `color-mix(in oklab, ${partner.from} 65%, transparent)` }}
            >
              ✦
            </span>
            <span className="text-[12px] font-medium tracking-tight text-white/55">Orbit pristine</span>
            <span className="max-w-[26ch] text-[10.5px] leading-relaxed text-white/30">
              Nothing on {partner.name}&rsquo;s board yet — add the first one above.
            </span>
          </div>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial={false} mode="popLayout">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  )
}
