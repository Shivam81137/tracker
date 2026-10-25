import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, Sparkles, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { PARTNERS, PRIORITY_MAP } from '../lib/constants'
import { formatTime, fromISODate } from '../lib/date'
import { playSparkle, playTick, playUiTick } from '../lib/audio'
import { burstFromElement } from '../lib/fx'
import { useOrbit } from '../lib/orbit-context'
import type { Task } from '../lib/types'

interface Props {
  task: Task
  /** Shared wall clock from the board, so rows never open their own interval. */
  now: number
}

function dueTimestamp(task: Task): number | null {
  if (!task.time) return null
  const [hours, minutes] = task.time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  const date = fromISODate(task.date)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

/** Single-line task row: custom checkbox, live meta and hover-revealed actions. */
export function TaskRow({ task, now }: Props) {
  const { toggleTask, deleteTask, cheerTask } = useOrbit()
  const partner = PARTNERS[task.owner]
  const priority = PRIORITY_MAP[task.priority]

  const due = dueTimestamp(task)
  const overdue = Boolean(due && !task.done && now > due)
  const high = task.priority === 'high' && !task.done

  const theme = { '--row-accent': partner.from } as CSSProperties

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        scale: 0.98,
        transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="group/task relative overflow-hidden"
      style={theme}
    >
      <div
        className={`relative flex min-h-[50px] items-center gap-2 rounded-xl px-2 transition-colors duration-200 focus-within:bg-white/[0.045] ${
          task.done ? 'bg-white/[0.012]' : 'hover:bg-white/[0.045]'
        }`}
      >
        {high && (
          <span
            aria-hidden="true"
            className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-[#FF0844]/75 shadow-[0_0_8px_rgba(255,8,68,0.5)]"
          />
        )}

        {/* Custom checkbox */}
        <motion.button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={`Mark “${task.title}” ${task.done ? 'incomplete' : 'complete'}`}
          whileTap={{ scale: 0.86 }}
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
          className="grid size-[21px] shrink-0 place-items-center rounded-[7px] border transition-[border-color,background-color,box-shadow] duration-200 hover:border-[var(--row-accent)]"
          style={{
            borderColor: task.done ? 'transparent' : 'rgba(255,255,255,0.2)',
            background: task.done
              ? `linear-gradient(135deg, ${partner.from}, ${partner.to})`
              : 'rgba(255,255,255,0.025)',
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
        </motion.button>

        {/* Title + metadata */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span
            title={task.title}
            className={`min-w-0 truncate text-[13px] leading-tight tracking-tight transition-colors duration-300 ${
              task.done
                ? 'text-white/45 line-through decoration-white/20 decoration-[1.5px]'
                : 'font-medium text-white/92'
            }`}
          >
            {task.title}
          </span>

          {task.rolledFrom && (
            <span
              className="metric hidden shrink-0 rounded-full border border-white/[0.08] px-1.5 py-px text-[9px] text-white/50 min-[420px]:inline"
              title={`Rolled over from ${task.rolledFrom}`}
            >
              ↪ {task.rolledFrom.slice(5)}
            </span>
          )}

          {task.linkId && (
            <span
              className="metric hidden shrink-0 rounded-full border border-[#F59E0B]/25 px-1.5 py-px text-[9px] text-[#F59E0B]/80 min-[440px]:inline"
              title="Linked with your partner's board"
            >
              ⇄ LINKED
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-1">
            {task.time && (
              <span
                className={`metric inline-flex items-center gap-1 rounded-md border px-1 py-0.5 text-[9.5px] transition-colors duration-300 min-[360px]:px-1.5 min-[360px]:text-[10px] ${
                  overdue
                    ? 'border-[#FF0844]/35 bg-[#FF0844]/10 text-[#FFB199]'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/68'
                }`}
                title={
                  overdue
                    ? `Overdue — was due at ${formatTime(task.time)}`
                    : `Scheduled for ${formatTime(task.time)}`
                }
              >
                <Clock className="hidden size-2.5 min-[360px]:inline" strokeWidth={2.3} />
                {formatTime(task.time)}
              </span>
            )}

            {/* Full priority chip from 400px; a colour dot keeps the signal
                legible on very narrow phones. */}
            <span
              className="metric hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] tracking-[0.1em] transition-opacity duration-300 min-[400px]:inline"
              style={{
                color: priority.hex,
                background: `color-mix(in oklab, ${priority.hex} 13%, transparent)`,
                borderColor: `color-mix(in oklab, ${priority.hex} 28%, transparent)`,
                opacity: task.done ? 0.45 : 1,
              }}
              title={`${priority.label} priority`}
            >
              {priority.short}
            </span>
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full min-[400px]:hidden"
              style={{
                background: priority.hex,
                opacity: task.done ? 0.4 : 0.85,
                boxShadow: task.done ? undefined : `0 0 6px ${priority.hex}80`,
              }}
              title={`${priority.label} priority`}
            />
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
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] transition-all duration-200 active:scale-95 ${
            task.cheers > 0
              ? 'border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]'
              : 'border-white/[0.08] text-white/50 hover:border-[#F59E0B]/30 hover:bg-[#F59E0B]/[0.06] hover:text-[#F59E0B]'
          }`}
          aria-label={`Cheer for “${task.title}”. ${task.cheers} cheers so far.`}
          title="Send a cheer"
        >
          <Sparkles className="size-3" strokeWidth={2.2} />
          {task.cheers > 0 && (
            <span className="metric relative hidden overflow-hidden min-[350px]:inline-flex">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={task.cheers}
                  initial={{ y: 7, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -7, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="inline-block"
                >
                  {task.cheers}
                </motion.span>
              </AnimatePresence>
            </span>
          )}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => {
            playUiTick()
            deleteTask(task.id)
          }}
          className="grid size-7 shrink-0 place-items-center rounded-full border border-transparent text-white/60 transition-all duration-200 hover:border-[#FF0844]/35 hover:bg-[#FF0844]/10 hover:text-[#FF0844] focus-visible:border-[#FF0844]/35 focus-visible:text-[#FF0844] md:border-white/[0.06] md:text-white/45 md:opacity-0 md:group-hover/task:opacity-100 md:group-focus-within/task:opacity-100"
          aria-label={`Delete “${task.title}”`}
          title="Delete task"
        >
          <X className="size-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </motion.li>
  )
}
