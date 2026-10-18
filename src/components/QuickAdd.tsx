import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, CornerDownLeft, Link2, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { PARTNERS, PRIORITIES, PRIORITY_MAP } from '../lib/constants'
import { formatTime, isToday, relativeDayLabel } from '../lib/date'
import { playTick, playUiTick } from '../lib/audio'
import { burstFromElement } from '../lib/fx'
import { useOrbit } from '../lib/orbit-context'
import type { Person, Priority } from '../lib/types'

interface Props {
  owner: Person
}

/**
 * Per-board quick add.
 *
 * The owner is implicit — the field lives inside the board it writes to — so
 * the everyday flow is literally *type, Enter*. Reminder, priority and the
 * mirrored "both orbits" pairing sit behind one predictable disclosure, and
 * whatever you choose there sticks for your next add.
 */
export function QuickAdd({ owner }: Props) {
  const { addTasks, viewDate, pushToast } = useOrbit()
  const partner = PARTNERS[owner]
  const other = PARTNERS[owner === 'shivam' ? 'noor' : 'shivam']

  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState<Priority>('med')
  const [both, setBoth] = useState(false)
  const [open, setOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const addRef = useRef<HTMLButtonElement | null>(null)

  const priorityMeta = PRIORITY_MAP[priority]
  const ready = title.trim().length > 0
  const tweaked = priority !== 'med' || time.length > 0 || both
  const detailsId = `quick-add-details-${owner}`

  const summary = [
    priority !== 'med' ? priorityMeta.short : null,
    time ? formatTime(time) : null,
    both ? `⇄ ${other.name} too` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const submit = useCallback(() => {
    const trimmed = title.trim()
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }

    const created = addTasks({
      title: trimmed,
      date: viewDate,
      assignee: both ? 'both' : owner,
      priority,
      time: time || undefined,
    })

    if (created > 0) {
      playTick(true)
      burstFromElement(
        addRef.current,
        both ? [partner.from, other.from, '#F59E0B'] : [partner.from, partner.to, '#F59E0B'],
        { count: 18, power: 4.6, gravity: 0.08 },
      )
      pushToast({
        title: created === 2 ? '⇄ Added to both orbits' : `＋ Added to ${partner.name}`,
        body: `${trimmed}${time ? ` · ${formatTime(time)}` : ''} · ${priorityMeta.label} priority`,
        accent: created === 2 ? 'sync' : partner.accent,
        icon: created === 2 ? '⇄' : '✦',
      })
    }

    setTitle('')
    // A reminder is a one-shot detail; priority and the pairing stay sticky
    // because they read as modes rather than per-task values.
    setTime('')
    inputRef.current?.focus()
  }, [addTasks, both, other.from, owner, partner, priority, priorityMeta.label, pushToast, time, title, viewDate])

  return (
    <div className="px-2.5 pb-1">
      {/* Never let a task land on the wrong day by surprise. */}
      {!isToday(viewDate) && (
        <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/[0.07] px-2.5 py-1">
          <RotateCcw className="size-3 shrink-0 text-[#F59E0B]" strokeWidth={2.2} />
          <span className="metric truncate text-[10px] tracking-[0.12em] text-[#F59E0B]">
            ADDING TO {relativeDayLabel(viewDate).toUpperCase()} — NOT TODAY
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* Title — the only always-visible control */}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 transition-colors focus-within:border-white/[0.2]">
          <Plus
            className="size-3.5 shrink-0"
            style={{ color: `color-mix(in oklab, ${partner.from} 75%, transparent)` }}
            strokeWidth={2.4}
          />
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
              if (event.key === 'Escape') {
                setTitle('')
                event.currentTarget.blur()
              }
            }}
            placeholder={`Add for ${partner.name}…`}
            maxLength={160}
            aria-label={`New task for ${partner.name}`}
            className="min-w-0 flex-1 bg-transparent text-[13px] tracking-tight text-white/92 placeholder:text-white/28 focus:outline-none"
          />
          {ready && (
            <span className="metric hidden shrink-0 text-[9.5px] tracking-[0.14em] text-white/22 sm:inline">↵ ENTER</span>
          )}
        </div>

        {/* One disclosure for everything optional */}
        <button
          type="button"
          onClick={() => {
            playUiTick()
            setOpen((prev) => !prev)
          }}
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={
            tweaked
              ? `${partner.name}'s task options — ${summary}. Click to change.`
              : `${partner.name}'s task options — reminder, priority, both orbits`
          }
          className={`pill h-8 max-w-[52%] shrink-0 ${tweaked ? 'border-white/[0.2] text-white/90' : 'pill-hover'}`}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={2.1} />
          {/* The full summary only appears where there is room for it; on a
              narrow phone an amber dot marks "something other than default". */}
          {tweaked && <span className="size-1.5 shrink-0 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B] sm:hidden" />}
          <span className="metric hidden truncate text-[10px] tracking-[0.12em] sm:inline">
            {tweaked ? summary : 'OPTIONS'}
          </span>
          <ChevronDown
            className={`size-3 shrink-0 transition-transform duration-250 ${open ? 'rotate-180' : ''}`}
            strokeWidth={2.2}
          />
        </button>

        <motion.button
          ref={addRef}
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={submit}
          disabled={!ready}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.08] px-3 text-[11px] font-medium tracking-tight text-white/90 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-35 sm:px-3.5"
          aria-label={`Add task to ${partner.name}'s board`}
        >
          Add
          <CornerDownLeft className="size-3" strokeWidth={2.4} />
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div id={detailsId} className="mt-2 flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-mono">Priority</span>
                <div className="flex items-center gap-1">
                  {PRIORITIES.map((option) => {
                    const active = option.id === priority
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          playUiTick()
                          setPriority(option.id)
                        }}
                        className="metric rounded-full border px-2 py-0.5 text-[10px] tracking-[0.12em] transition-all duration-200"
                        style={{
                          color: active ? option.hex : 'rgba(255,255,255,0.5)',
                          borderColor: active
                            ? `color-mix(in oklab, ${option.hex} 45%, transparent)`
                            : 'rgba(255,255,255,0.08)',
                          background: active ? `color-mix(in oklab, ${option.hex} 14%, transparent)` : 'transparent',
                        }}
                      >
                        {option.short}
                      </button>
                    )
                  })}
                </div>

                <span className="label-mono ml-auto">Reminder</span>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  aria-label={`Reminder time for ${partner.name}`}
                  className="metric rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/85 focus:border-white/25 focus:outline-none"
                />
                {time && (
                  <button
                    type="button"
                    onClick={() => {
                      setTime('')
                      playUiTick()
                    }}
                    className="icon-btn size-6"
                    aria-label="Clear reminder time"
                  >
                    <X className="size-3" strokeWidth={2.2} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={both}
                  onClick={() => {
                    playUiTick()
                    setBoth((prev) => !prev)
                  }}
                  className="pill h-7"
                  style={{
                    color: both ? '#F59E0B' : 'rgba(255,255,255,0.6)',
                    borderColor: both ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)',
                    background: both ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                  }}
                  title={`Mirror this task onto ${other.name}'s board as well`}
                >
                  <Link2 className="size-3.5" strokeWidth={2.2} />
                  <span className="text-[11px] tracking-tight">
                    {both ? 'Both orbits ✓' : `Also add for ${other.name}`}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
