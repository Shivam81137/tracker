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
  const { allTasks, viewDate, viewProgress } = useOrbit()
  const partner = PARTNERS[owner]
  const progress = viewProgress[owner]
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
    <section className="glass flex flex-col overflow-hidden" aria-label={`${partner.name}'s board`}>
      {/* Accent hairline */}
      <div
        className="h-px w-full shrink-0"
        style={{ background: `linear-gradient(90deg, transparent, ${partner.from}, ${partner.to}, transparent)` }}
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
          <h3 className="flex items-baseline gap-2 text-[13px] font-medium tracking-tight text-white/92">
            <span className="truncate">{partner.name}&rsquo;s Orbit</span>
            <span className="metric text-[10px] text-white/35">
              {progress.done}/{progress.total}
            </span>
          </h3>
          <div className="mt-1.5 h-px w-full overflow-hidden bg-white/[0.07]">
            <motion.div
              className="h-full origin-left"
              style={{ background: `linear-gradient(90deg, ${partner.from}, ${partner.to})` }}
              initial={false}
              animate={{ scaleX: progress.ratio }}
              transition={{ type: 'spring', stiffness: 140, damping: 24 }}
            />
          </div>
        </div>

        <span className="metric shrink-0 text-[11px] text-white/45" style={{ color: progress.ratio > 0 ? partner.from : undefined }}>
          {pct(progress.ratio)}%
        </span>
      </header>

      <QuickAdd owner={owner} />

      <div className="min-h-[132px] flex-1 px-1.5 pb-2.5">
        {tasks.length === 0 ? (
          <div className="flex h-full min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.07] px-4 py-6 text-center">
            <span className="text-[13px]" style={{ color: `color-mix(in oklab, ${partner.from} 60%, transparent)` }}>
              ✦
            </span>
            <span className="text-[12px] tracking-tight text-white/45">Orbit pristine</span>
            <span className="text-[10.5px] text-white/25">Nothing on {partner.name}&rsquo;s board yet — add the first one above.</span>
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
