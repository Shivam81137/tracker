import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, Sparkles, X } from 'lucide-react'
import { PARTNERS, PRIORITY_MAP } from '../lib/constants'
import { formatTime } from '../lib/date'
import { playSparkle, playTick, playUiTick } from '../lib/audio'
import { burstFromElement } from '../lib/fx'
import { useOrbit } from '../lib/orbit-context'
import type { Task } from '../lib/types'

interface Props {
  task: Task
}

/** Single-line, 48px task row with a custom animated checkbox. */
export function TaskRow({ task }: Props) {
  const { toggleTask, deleteTask, cheerTask } = useOrbit()
  const partner = PARTNERS[task.owner]
  const priority = PRIORITY_MAP[task.priority]

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="group relative flex h-12 items-center gap-2.5 rounded-xl px-2 transition-colors duration-200 hover:bg-white/[0.035]"
    >
      {/* Custom checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`Mark “${task.title}” ${task.done ? 'incomplete' : 'complete'}`}
        onClick={(event) => {
          playTick(!task.done)
          toggleTask(task.id)
          if (!task.done) {
            burstFromElement(event.currentTarget, [partner.from, partner.to, '#F59E0B'], {
              count: 18,
              power: 4.4,
              gravity: 0.08,
            })
          }
        }}
        className="grid size-[20px] shrink-0 place-items-center rounded-[7px] border transition-all duration-200"
        style={{
          borderColor: task.done ? 'transparent' : 'rgba(255,255,255,0.18)',
          background: task.done ? `linear-gradient(135deg, ${partner.from}, ${partner.to})` : 'rgba(255,255,255,0.02)',
          boxShadow: task.done ? `0 0 16px -2px ${partner.from}` : 'none',
        }}
      >
        <AnimatePresence initial={false}>
          {task.done && (
            <motion.span
              key="check"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 26 }}
              className="text-black/85"
            >
              <Check className="size-3.5" strokeWidth={3.4} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Title + meta */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`line-clamp-1 text-[13px] leading-tight tracking-tight transition-all duration-300 ${
            task.done ? 'text-white/30 line-through decoration-white/25' : 'text-white/88'
          }`}
        >
          {task.title}
        </span>

        {task.rolledFrom && (
          <span
            className="metric shrink-0 rounded-full border border-white/[0.08] px-1.5 py-px text-[9px] text-white/35"
            title={`Rolled over from ${task.rolledFrom}`}
          >
            ↪ {task.rolledFrom.slice(5)}
          </span>
        )}

        {task.linkId && (
          <span
            className="metric shrink-0 rounded-full border border-[#F59E0B]/25 px-1.5 py-px text-[9px] text-[#F59E0B]/80"
            title="Linked with your partner's board"
          >
            ⇄ LINKED
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {task.time && (
            <span
              className="metric inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/55"
              title={`Scheduled for ${formatTime(task.time)}`}
            >
              <Clock className="size-2.5" strokeWidth={2.2} />
              {formatTime(task.time)}
            </span>
          )}
          <span
            className="metric rounded-full px-1.5 py-0.5 text-[9px] tracking-[0.1em]"
            style={{
              color: priority.hex,
              background: `color-mix(in oklab, ${priority.hex} 14%, transparent)`,
              border: `1px solid color-mix(in oklab, ${priority.hex} 30%, transparent)`,
            }}
            title={`${priority.label} priority`}
          >
            {priority.short}
          </span>
        </span>
      </div>

      {/* Cheer */}
      <button
        type="button"
        onClick={(event) => {
          playSparkle()
          cheerTask(task.id)
          burstFromElement(event.currentTarget, ['#F59E0B', partner.from, '#FFB199'], {
            count: 14,
            power: 4,
            gravity: 0.05,
          })
        }}
        className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] transition-all duration-200 ${
          task.cheers > 0
            ? 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]'
            : 'border-white/[0.08] text-white/35 hover:border-[#F59E0B]/30 hover:text-[#F59E0B]'
        }`}
        aria-label={`Cheer for “${task.title}”. ${task.cheers} cheers so far.`}
        title="Send a cheer"
      >
        <Sparkles className="size-3" strokeWidth={2.1} />
        {task.cheers > 0 && <span className="metric">{task.cheers}</span>}
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          playUiTick()
          deleteTask(task.id)
        }}
        className="grid size-7 shrink-0 place-items-center rounded-full border border-transparent text-white/25 opacity-0 transition-all duration-200 group-hover:border-white/[0.08] group-hover:text-white/60 hover:border-[#FF0844]/40 hover:text-[#FF0844] focus-visible:opacity-100 max-md:opacity-100"
        aria-label={`Delete “${task.title}”`}
        title="Delete task"
      >
        <X className="size-3.5" strokeWidth={2.2} />
      </button>
    </motion.li>
  )
}
