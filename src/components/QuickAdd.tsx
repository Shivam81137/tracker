import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Clock,
  CornerDownLeft,
  Flag,
  Flame,
  Leaf,
  Link2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { PARTNERS, PRIORITIES, PRIORITY_MAP } from '../lib/constants'
import { formatTime, isToday, relativeDayLabel } from '../lib/date'
import { playTick, playUiTick } from '../lib/audio'
import { burstFromElement } from '../lib/fx'
import { useOrbit } from '../lib/orbit-context'
import type { Person, Priority } from '../lib/types'

interface Props {
  owner: Person
}

const PRIORITY_ICON: Record<Priority, typeof Flame> = {
  high: Flame,
  med: Flag,
  chill: Leaf,
}

const PRIORITY_HINT: Record<Priority, string> = {
  high: 'Sorts first and adds a coral rail.',
  med: 'Balanced default for everyday tasks.',
  chill: 'Low pressure — no accent rail.',
}

const QUICK_TIMES = [
  { label: '9 AM', value: '09:00' },
  { label: 'Noon', value: '12:00' },
  { label: '6 PM', value: '18:00' },
  { label: '9 PM', value: '21:00' },
] as const

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

  // Global shortcut (N) asks the active board's field to take focus.
  useEffect(() => {
    const onFocusAdd = (event: Event) => {
      const detail = (event as CustomEvent<{ owner?: Person | null }>).detail
      const requested = detail?.owner ?? 'shivam'
      if (requested !== owner) return
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    window.addEventListener('syncorbit:focus-add', onFocusAdd)
    return () => window.removeEventListener('syncorbit:focus-add', onFocusAdd)
  }, [owner])

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

  const resetDetails = useCallback(() => {
    playUiTick()
    setPriority('med')
    setTime('')
    setBoth(false)
  }, [])

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
        <div
          className="field-accent flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"
          style={{ '--field-accent': partner.from } as CSSProperties}
        >
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
            className="min-w-0 flex-1 bg-transparent text-[13px] tracking-tight text-white/95 placeholder:text-white/42 focus:outline-none"
          />
          {ready && (
            <span className="metric hidden shrink-0 text-[9.5px] tracking-[0.14em] text-white/35 sm:inline">↵ ENTER</span>
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
          className={`pill h-8 max-w-[52%] shrink-0 ${tweaked ? 'border-white/[0.2] text-white/94' : 'pill-hover'}`}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={2.1} />
          {/* Narrow phones get an amber dot; from 400px the real summary is
              shown so the active options are never hidden. */}
          {tweaked && <span className="size-1.5 shrink-0 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B] min-[360px]:hidden" />}
          <span className="metric hidden truncate text-[10px] tracking-[0.12em] min-[360px]:inline">
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
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.08] px-3 text-[11px] font-medium tracking-tight text-white/94 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.14] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 sm:px-3.5"
          style={
            ready
              ? {
                  background: `linear-gradient(135deg, ${partner.from}, ${partner.to})`,
                  borderColor: 'transparent',
                  color: '#041014',
                  boxShadow: `0 10px 26px -14px ${partner.from}`,
                }
              : undefined
          }
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
            <div
              id={detailsId}
              className="mt-2 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
            >
              {/* Panel header — names the surface and offers a way back to defaults. */}
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
                <span className="label-mono text-[9px]">Task options</span>
                <button
                  type="button"
                  onClick={resetDetails}
                  disabled={!tweaked}
                  className="metric rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[9px] tracking-[0.14em] text-white/60 uppercase transition-all duration-200 hover:border-white/20 hover:text-white/90 disabled:pointer-events-none disabled:opacity-0"
                >
                  Reset
                </button>
              </div>

              {/* Two labelled fields share a row on wider cards and stack on phones. */}
              <div className="grid gap-3 px-3 py-3 sm:grid-cols-2 sm:gap-4">
                <div className="min-w-0">
                  <div className="mb-1.5 flex h-6 items-center gap-1.5 text-white/55">
                    <Flag className="size-3" strokeWidth={2.2} />
                    <span className="label-mono text-[9px]">Priority mode</span>
                  </div>
                  <div
                    className="grid grid-cols-3 gap-1.5"
                    role="group"
                    aria-label={`Priority mode for ${partner.name}'s task`}
                  >
                    {PRIORITIES.map((option) => {
                      const active = option.id === priority
                      const Icon = PRIORITY_ICON[option.id]
                      const hint = PRIORITY_HINT[option.id]
                      return (
                        <motion.button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          aria-label={`${option.label} priority. ${hint}`}
                          title={hint}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            playUiTick()
                            setPriority(option.id)
                          }}
                          className="relative flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-lg border text-[10px] font-medium tracking-tight transition-colors duration-200"
                          style={{
                            borderColor: active
                              ? `color-mix(in oklab, ${option.hex} 48%, transparent)`
                              : 'rgba(255,255,255,0.07)',
                            background: active
                              ? `color-mix(in oklab, ${option.hex} 14%, transparent)`
                              : 'rgba(255,255,255,0.02)',
                            color: active ? option.hex : 'rgba(255,255,255,0.45)',
                            boxShadow: active
                              ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 22px -14px ${option.hex}`
                              : undefined,
                          }}
                        >
                          <Icon className="size-3.5" strokeWidth={2.2} />
                          <span>{option.id === 'med' ? 'Medium' : option.label}</span>
                          {active && (
                            <motion.span
                              layoutId={`priority-underline-${owner}`}
                              className="absolute inset-x-3 bottom-0 h-px"
                              style={{ background: option.hex, boxShadow: `0 0 8px ${option.hex}` }}
                              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                            />
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[9.5px] leading-snug text-white/45">
                    <span
                      aria-hidden="true"
                      className="mt-[3px] size-1 shrink-0 rounded-full"
                      style={{ background: priorityMeta.hex }}
                    />
                    <span>{PRIORITY_HINT[priority]}</span>
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="mb-1.5 flex h-6 items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-white/55">
                      <Clock className="size-3" strokeWidth={2.2} />
                      <span className="label-mono text-[9px]">Reminder</span>
                    </span>
                    <span className="flex h-6 items-center">
                      {time && (
                        <button
                          type="button"
                          onClick={() => {
                            setTime('')
                            playUiTick()
                          }}
                          className="metric inline-flex h-6 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 text-[9px] tracking-[0.12em] text-white/60 uppercase transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
                        >
                          <X className="size-2.5" strokeWidth={2.4} />
                          Clear
                        </button>
                      )}
                    </span>
                  </div>

                  <div
                    className="grid grid-cols-4 gap-1.5"
                    role="group"
                    aria-label={`Quick reminder presets for ${partner.name}`}
                  >
                    {QUICK_TIMES.map((preset) => {
                      const active = time === preset.value
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Set reminder for ${formatTime(preset.value)}`}
                          title={formatTime(preset.value)}
                          onClick={() => {
                            playUiTick()
                            setTime(preset.value)
                          }}
                          className={`metric h-7 rounded-md border text-[9.5px] tracking-[0.06em] transition-colors duration-200 ${
                            active
                              ? 'border-[#F59E0B]/45 bg-[#F59E0B]/[0.14] text-[#FDE68A]'
                              : 'border-white/[0.07] bg-white/[0.02] text-white/60 hover:border-white/15 hover:text-white/88'
                          }`}
                          style={
                            active
                              ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 20px -14px #F59E0B' }
                              : undefined
                          }
                        >
                          {preset.label}
                        </button>
                      )
                    })}
                  </div>

                  <input
                    type="time"
                    value={time}
                    step={300}
                    onChange={(event) => setTime(event.target.value)}
                    aria-label={`Exact reminder time for ${partner.name}`}
                    title="Set an exact reminder time"
                    style={{ colorScheme: 'dark' }}
                    className="metric mt-1.5 h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 px-2.5 text-[12px] text-white/90 transition-colors focus:border-[#F59E0B]/45 focus:bg-[#F59E0B]/[0.04] focus:outline-none"
                  />
                </div>
              </div>

              {/* The mirror pairing is a mode, so it reads as a labelled switch row. */}
              <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-2.5">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg border transition-colors duration-200"
                  style={{
                    borderColor: both ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)',
                    background: both ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                    color: both ? '#F59E0B' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <Link2 className="size-3.5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[11.5px] font-medium tracking-tight"
                    style={{ color: both ? '#FDE68A' : 'rgba(255,255,255,0.82)' }}
                  >
                    Also add for {other.name}
                  </div>
                  <div className="text-[10px] leading-snug text-white/50">
                    Mirrors this task onto {other.name}&rsquo;s board
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={both}
                  onClick={() => {
                    playUiTick()
                    setBoth((prev) => !prev)
                  }}
                  aria-label={`Also add this task to ${other.name}'s board`}
                  className="relative h-[22px] w-10 shrink-0 rounded-full border transition-colors duration-200"
                  style={{
                    borderColor: both ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.12)',
                    background: both ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <motion.span
                    className="absolute top-1/2 left-0.5 size-4 -translate-y-1/2 rounded-full"
                    animate={{ x: both ? 18 : 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                    style={{
                      background: both ? '#F59E0B' : 'rgba(255,255,255,0.7)',
                      boxShadow: both ? '0 0 10px rgba(245,158,11,0.75)' : 'none',
                    }}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
