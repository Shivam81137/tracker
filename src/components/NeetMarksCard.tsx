import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, GraduationCap, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { playUiTick } from '../lib/audio'
import { todayISO } from '../lib/date'
import { useOrbit } from '../lib/orbit-context'
import { NEET_MAX_SCORE, NEET_MIN_SCORE } from '../lib/storage'
import type { NeetMark } from '../lib/types'

const ACCENT = '#FF0844'
const ACCENT_SOFT = '#FFB199'
const HISTORY_PREVIEW = 5
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(iso: string, withYear = false) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ’${String(y).slice(2)}` : ''}`
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Pick a tidy y-domain around the data instead of always showing 0–720. */
function buildScale(scores: number[]) {
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  let lo = Math.max(NEET_MIN_SCORE, Math.floor((min - 40) / 100) * 100)
  let hi = Math.min(NEET_MAX_SCORE, Math.ceil((max + 40) / 100) * 100)
  if (lo > 0 && min >= 0) lo = Math.max(0, lo)
  if (hi - lo < 200) hi = Math.min(NEET_MAX_SCORE, lo + 200)
  if (hi - lo < 200) lo = Math.max(NEET_MIN_SCORE, hi - 200)
  const step = hi - lo > 400 ? 200 : 100
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  return { lo, hi, ticks }
}

function ScoreChart({ marks }: { marks: NeetMark[] }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gradId = useId().replace(/:/g, '')

  const compact = width > 0 && width < 480
  const height = compact ? 200 : 240
  const pad = { top: 18, right: compact ? 14 : 22, bottom: 28, left: compact ? 34 : 42 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom

  const scale = useMemo(() => buildScale(marks.map((m) => m.score)), [marks])
  const xAt = (i: number) =>
    marks.length === 1 ? pad.left + innerW / 2 : pad.left + (innerW * i) / (marks.length - 1)
  const yAt = (v: number) => pad.top + innerH * (1 - (v - scale.lo) / (scale.hi - scale.lo))

  const points = marks.map((m, i) => ({ x: xAt(i), y: yAt(m.score), mark: m }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const baseY = pad.top + innerH
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)} ${baseY} L${points[0].x.toFixed(1)} ${baseY} Z`
      : ''

  const active = hover ?? marks.length - 1
  const activePoint = points[active]

  // Thin x labels so they never collide on narrow phones.
  const maxLabels = Math.max(2, Math.floor(innerW / 64))
  const labelEvery = Math.max(1, Math.ceil(marks.length / maxLabels))

  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    let best = 0
    let bestDist = Infinity
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - px)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setHover(best)
  }

  const tipW = 112
  const tipLeft = activePoint
    ? Math.min(Math.max(activePoint.x - tipW / 2, 4), Math.max(4, width - tipW - 4))
    : 0

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Line graph of ${marks.length} NEET test scores, latest ${marks[marks.length - 1].score} out of ${NEET_MAX_SCORE}`}
            className="touch-pan-y overflow-visible"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`${gradId}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${gradId}-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={ACCENT_SOFT} />
                <stop offset="100%" stopColor={ACCENT} />
              </linearGradient>
            </defs>

            {/* grid + y labels */}
            {scale.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={yAt(t)}
                  y2={yAt(t)}
                  stroke="white"
                  strokeOpacity={t === 0 ? 0.18 : 0.07}
                  strokeDasharray={t === 0 ? undefined : '3 5'}
                />
                <text
                  x={pad.left - 8}
                  y={yAt(t) + 3.5}
                  textAnchor="end"
                  className="fill-white/40 font-mono"
                  style={{ fontSize: 10 }}
                >
                  {t}
                </text>
              </g>
            ))}

            {/* x labels */}
            {points.map((p, i) =>
              i % labelEvery === 0 || i === points.length - 1 ? (
                <text
                  key={p.mark.id}
                  x={p.x}
                  y={height - 8}
                  textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}
                  className="fill-white/40 font-mono"
                  style={{ fontSize: 10 }}
                >
                  {shortDate(p.mark.date)}
                </text>
              ) : null,
            )}

            {areaPath && <path d={areaPath} fill={`url(#${gradId}-area)`} />}
            {points.length > 1 && (
              <motion.path
                key={marks.length}
                d={linePath}
                fill="none"
                stroke={`url(#${gradId}-line)`}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            {/* crosshair */}
            {activePoint && (
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={pad.top}
                y2={baseY}
                stroke={ACCENT}
                strokeOpacity={0.35}
                strokeDasharray="2 4"
              />
            )}

            {points.map((p, i) => (
              <circle
                key={p.mark.id}
                cx={p.x}
                cy={p.y}
                r={i === active ? 5.5 : 3.5}
                fill={i === active ? ACCENT : '#0B0C11'}
                stroke={ACCENT}
                strokeWidth={2}
                style={{ transition: 'r 0.15s ease' }}
              />
            ))}
          </svg>

          {activePoint && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-white/[0.12] bg-[#0B0C11]/95 px-2.5 py-1.5 text-center shadow-lg"
              style={{
                width: tipW,
                left: tipLeft,
                top: Math.max(0, activePoint.y - 56),
              }}
            >
              <p className="metric text-[14px] leading-none text-white">
                {activePoint.mark.score}
                <span className="text-[10px] text-white/40"> /{NEET_MAX_SCORE}</span>
              </p>
              <p className="mt-1 truncate font-mono text-[9px] tracking-[0.08em] text-white/50 uppercase">
                {activePoint.mark.label || shortDate(activePoint.mark.date, true)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
      <p className="label-mono truncate text-[9px]">{label}</p>
      <p className="metric mt-1 truncate text-[20px] leading-none text-white/95 sm:text-[22px]">{value}</p>
      {hint && <div className="mt-1.5 truncate text-[10px] text-white/45">{hint}</div>}
    </div>
  )
}

export function NeetMarksCard() {
  const { state, addNeetMark, deleteNeetMark, pushToast } = useOrbit()

  const marks = useMemo(
    () =>
      (state.neetMarks ?? [])
        .filter((m) => !m.deleted)
        .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1)),
    [state.neetMarks],
  )

  const [date, setDate] = useState(todayISO)
  const [score, setScore] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const today = todayISO()

  useEffect(() => {
    if (!confirmId) return
    const t = window.setTimeout(() => setConfirmId(null), 3000)
    return () => window.clearTimeout(t)
  }, [confirmId])

  const stats = useMemo(() => {
    if (marks.length === 0) return null
    const scores = marks.map((m) => m.score)
    const latest = scores[scores.length - 1]
    const prev = scores.length > 1 ? scores[scores.length - 2] : null
    const best = Math.max(...scores)
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    return { latest, delta: prev === null ? null : latest - prev, best, avg }
  }, [marks])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = Number(score)
    if (score.trim() === '' || !Number.isFinite(value)) return setError('Enter the marks you scored.')
    if (!Number.isInteger(value)) return setError('Marks must be a whole number.')
    if (value > NEET_MAX_SCORE || value < NEET_MIN_SCORE)
      return setError(`Marks must be between ${NEET_MIN_SCORE} and ${NEET_MAX_SCORE}.`)
    if (!date || date > today) return setError('Pick today or an earlier date.')

    addNeetMark({ date, score: value, label })
    playUiTick()
    pushToast({ title: 'Marks saved', body: `${value}/${NEET_MAX_SCORE} on ${shortDate(date)}`, accent: 'noor' })
    setScore('')
    setLabel('')
    setError('')
  }

  const history = [...marks].reverse()
  const visible = showAll ? history : history.slice(0, HISTORY_PREVIEW)
  const deltaOf = (m: NeetMark) => {
    const i = marks.findIndex((x) => x.id === m.id)
    return i > 0 ? m.score - marks[i - 1].score : null
  }

  const inputCls =
    'h-11 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-[16px] text-white/94 transition-colors placeholder:text-white/35 focus:border-[#FF0844]/50 focus:bg-black/40 focus:outline-none sm:h-10 sm:text-[13px] [color-scheme:dark]'

  return (
    <section className="glass overflow-hidden p-4 sm:p-6" aria-label="NEET marks tracker">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF0844]/55 to-transparent"
      />

      {/* header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#FF0844]/30 bg-[#FF0844]/10 text-[#FF8FA8]">
            <GraduationCap className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[16px] leading-tight font-semibold tracking-tight text-white/95 sm:text-[18px]">
              NEET Marks
            </h2>
            <p className="label-mono mt-0.5 truncate text-[9px]">
              {marks.length === 0 ? 'No tests logged yet' : `${marks.length} test${marks.length === 1 ? '' : 's'} · out of ${NEET_MAX_SCORE}`}
            </p>
          </div>
        </div>
        {stats && stats.delta !== null && (
          <span
            className={`metric inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
              stats.delta > 0
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : stats.delta < 0
                  ? 'border-[#FF0844]/30 bg-[#FF0844]/10 text-[#FF8FA8]'
                  : 'border-white/10 bg-white/[0.04] text-white/55'
            }`}
            title="Change since the previous test"
          >
            {stats.delta > 0 ? <TrendingUp className="size-3" /> : stats.delta < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
            {stats.delta > 0 ? '+' : ''}
            {stats.delta}
          </span>
        )}
      </div>

      {/* stats */}
      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Latest" value={String(stats.latest)} hint={`${Math.round((stats.latest / NEET_MAX_SCORE) * 100)}% of ${NEET_MAX_SCORE}`} />
          <Stat label="Best" value={String(stats.best)} hint="personal high" />
          <Stat label="Average" value={String(stats.avg)} hint={`across ${marks.length}`} />
        </div>
      )}

      {/* graph */}
      <div className="rounded-xl border border-white/[0.07] bg-black/20 px-1 pt-3 pb-1 sm:px-3">
        {marks.length === 0 ? (
          <div className="grid h-[180px] place-items-center px-6 text-center">
            <div>
              <p className="text-[13px] font-medium text-white/80">Your score graph starts here</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/50">
                Add the marks from your next NEET test below and every test will plot on this line.
              </p>
            </div>
          </div>
        ) : (
          <ScoreChart marks={marks} />
        )}
      </div>

      {/* add form */}
      <form onSubmit={submit} className="mt-4" noValidate>
        <p className="label-mono mb-2 text-[9.5px]">Log a test</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:gap-3">
          <label className="min-w-0">
            <span className="sr-only">Test date</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
              aria-label="Test date"
            />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Marks scored</span>
            <input
              type="number"
              inputMode="numeric"
              value={score}
              min={NEET_MIN_SCORE}
              max={NEET_MAX_SCORE}
              step={1}
              onChange={(e) => {
                setScore(e.target.value)
                if (error) setError('')
              }}
              placeholder={`Marks / ${NEET_MAX_SCORE}`}
              className={inputCls}
              aria-label={`Marks scored out of ${NEET_MAX_SCORE}`}
              aria-invalid={error ? true : undefined}
            />
          </label>
          <label className="col-span-2 min-w-0 sm:col-span-1">
            <span className="sr-only">Test name (optional)</span>
            <input
              type="text"
              value={label}
              maxLength={40}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Test name (optional)"
              className={inputCls}
              aria-label="Test name, optional"
            />
          </label>
          <button
            type="submit"
            className="col-span-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#FF0844]/40 bg-[#FF0844]/15 px-5 text-[13px] font-medium text-[#FFC4B5] transition-all duration-200 hover:border-[#FF0844]/60 hover:bg-[#FF0844]/25 active:scale-[0.98] sm:col-span-1 sm:h-10"
          >
            <Plus className="size-4" strokeWidth={2.2} />
            Add marks
          </button>
        </div>
        <p role="alert" className={`mt-2 text-[11.5px] text-[#FF8FA8] ${error ? '' : 'hidden'}`}>
          {error}
        </p>
      </form>

      {/* history */}
      {history.length > 0 && (
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <p className="label-mono mb-1.5 text-[9.5px]">History</p>
          <ul className="divide-y divide-white/[0.06]">
            {visible.map((m) => {
              const delta = deltaOf(m)
              const confirming = confirmId === m.id
              return (
                <li key={m.id} className="flex min-h-12 items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white/90">{m.label || 'NEET test'}</p>
                    <p className="metric text-[10.5px] text-white/45">{shortDate(m.date, true)}</p>
                  </div>
                  {delta !== null && (
                    <span
                      className={`metric text-[11px] ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-[#FF8FA8]' : 'text-white/45'}`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  )}
                  <span className="metric w-[3.4rem] text-right text-[15px] text-white/95">{m.score}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirming) {
                        deleteNeetMark(m.id)
                        setConfirmId(null)
                      } else setConfirmId(m.id)
                    }}
                    className={`grid h-9 shrink-0 place-items-center rounded-full border text-[10px] font-medium transition-colors ${
                      confirming
                        ? 'border-[#FF0844]/50 bg-[#FF0844]/15 px-3 text-[#FF8FA8]'
                        : 'w-9 border-white/[0.08] text-white/50 hover:border-[#FF0844]/35 hover:text-[#FF0844]'
                    }`}
                    aria-label={confirming ? 'Confirm delete this test' : `Delete test from ${shortDate(m.date)}`}
                  >
                    {confirming ? 'Delete?' : <Trash2 className="size-3.5" strokeWidth={1.9} />}
                  </button>
                </li>
              )
            })}
          </ul>
          {history.length > HISTORY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg font-mono text-[10px] tracking-[0.12em] text-white/50 uppercase transition-colors hover:text-white/85"
              aria-expanded={showAll}
            >
              {showAll ? 'Show less' : `Show all ${history.length}`}
              <ChevronDown className={`size-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}
    </section>
  )
}
