import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Award,
  ChevronDown,
  Crown,
  Flame,
  GraduationCap,
  Lock,
  Minus,
  Plus,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { playFanfare, playSparkle } from '../lib/audio'
import { todayISO } from '../lib/date'
import { burstFromElement } from '../lib/fx'
import { useOrbit } from '../lib/orbit-context'
import { NEET_MAX_SCORE, NEET_MIN_SCORE } from '../lib/storage'
import type { NeetMark } from '../lib/types'

/* ------------------------------------------------------------------ *
 *  Palette, tiers, milestones
 * ------------------------------------------------------------------ */
const GOLD = '#FBBF24'
/** The graph line flows through these colours from the first test to the last. */
const RAINBOW = ['#FF6B8A', '#FBBF24', '#34D399', '#22D3EE', '#A78BFA']
const CONFETTI = ['#FF6B8A', '#FBBF24', '#34D399', '#22D3EE', '#A78BFA', '#FFFFFF']

const TIERS = [
  { min: 650, label: 'Elite', color: '#FACC15' },
  { min: 600, label: 'Champion', color: '#34D399' },
  { min: 500, label: 'Strong', color: '#22D3EE' },
  { min: 400, label: 'Rising', color: '#A78BFA' },
  { min: -Infinity, label: 'Warming up', color: '#FF6B8A' },
] as const

const MILESTONES = [400, 450, 500, 550, 600, 650, 700, NEET_MAX_SCORE]

const tierOf = (score: number) => TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]
const nextGoal = (best: number) => MILESTONES.find((m) => m > best) ?? null
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`

const HISTORY_PREVIEW = 5
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(iso: string, withYear = false) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ’${String(y).slice(2)}` : ''}`
}

const sortMarks = (list: NeetMark[]) =>
  [...list].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))

/* ------------------------------------------------------------------ *
 *  Badges
 * ------------------------------------------------------------------ */
interface Badge {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  color: string
  earned: (marks: NeetMark[]) => boolean
}

const bestOf = (marks: NeetMark[]) => (marks.length ? Math.max(...marks.map((m) => m.score)) : -Infinity)

const BADGES: Badge[] = [
  { id: 'first', label: 'First Step', hint: 'Log your first test', icon: Rocket, color: '#FF6B8A', earned: (m) => m.length >= 1 },
  { id: 'three', label: 'Hat-trick', hint: 'Log 3 tests', icon: Zap, color: '#FBBF24', earned: (m) => m.length >= 3 },
  { id: 'five', label: 'On Fire', hint: 'Log 5 tests', icon: Flame, color: '#FB923C', earned: (m) => m.length >= 5 },
  {
    id: 'roll',
    label: 'On a Roll',
    hint: 'Improve 3 tests in a row',
    icon: TrendingUp,
    color: '#34D399',
    earned: (m) => m.some((_, i) => i >= 2 && m[i].score > m[i - 1].score && m[i - 1].score > m[i - 2].score),
  },
  {
    id: 'record',
    label: 'New Record',
    hint: 'Beat your personal best',
    icon: Trophy,
    color: '#FACC15',
    earned: (m) => m.some((x, i) => i > 0 && x.score > bestOf(m.slice(0, i))),
  },
  { id: 's500', label: '500 Club', hint: 'Score 500+', icon: Star, color: '#22D3EE', earned: (m) => bestOf(m) >= 500 },
  { id: 's600', label: '600 Club', hint: 'Score 600+', icon: Award, color: '#34D399', earned: (m) => bestOf(m) >= 600 },
  { id: 's650', label: 'Elite 650', hint: 'Score 650+', icon: Crown, color: '#FACC15', earned: (m) => bestOf(m) >= 650 },
]

/* ------------------------------------------------------------------ *
 *  Chart helpers
 * ------------------------------------------------------------------ */
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

/** Pick a tidy y-domain around the data (and the next goal) instead of always 0–720. */
function buildScale(scores: number[]) {
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  let lo = Math.max(NEET_MIN_SCORE, Math.floor((min - 40) / 100) * 100)
  let hi = Math.min(NEET_MAX_SCORE, Math.ceil((max + 40) / 100) * 100)
  if (hi - lo < 200) hi = Math.min(NEET_MAX_SCORE, lo + 200)
  if (hi - lo < 200) lo = Math.max(NEET_MIN_SCORE, hi - 200)
  const step = hi - lo > 400 ? 200 : 100
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  return { lo, hi, ticks }
}

function ScoreChart({ marks, goal }: { marks: NeetMark[]; goal: number | null }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  const compact = width > 0 && width < 480
  const height = compact ? 220 : 260
  const pad = { top: 24, right: compact ? 16 : 24, bottom: 28, left: compact ? 34 : 42 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom

  const bestScore = bestOf(marks)
  const scale = useMemo(
    () => buildScale(goal ? [...marks.map((m) => m.score), goal] : marks.map((m) => m.score)),
    [marks, goal],
  )
  const xAt = (i: number) =>
    marks.length === 1 ? pad.left + innerW / 2 : pad.left + (innerW * i) / (marks.length - 1)
  const yAt = (v: number) => pad.top + innerH * (1 - (v - scale.lo) / (scale.hi - scale.lo))

  const points = marks.map((m, i) => ({ x: xAt(i), y: yAt(m.score), mark: m, tier: tierOf(m.score) }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const baseY = pad.top + innerH
  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)} ${baseY} L${points[0].x.toFixed(1)} ${baseY} Z`
      : ''
  const x0 = points[0]?.x ?? 0
  const x1 = points.length > 1 ? points[points.length - 1].x : x0 + 1
  const bestIdx = marks.findIndex((m) => m.score === bestScore)

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

  const tipW = 124
  const tipLeft = activePoint ? Math.min(Math.max(activePoint.x - tipW / 2, 4), Math.max(4, width - tipW - 4)) : 0
  const thresholds = TIERS.filter((t) => Number.isFinite(t.min) && t.min > scale.lo && t.min < scale.hi)

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
              <linearGradient id={`${uid}-line`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
                {RAINBOW.map((c, i) => (
                  <stop key={c} offset={`${(i / (RAINBOW.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </linearGradient>
              <linearGradient id={`${uid}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1={pad.top} x2="0" y2={baseY}>
                <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id={`${uid}-mask`}>
                <rect x="0" y="0" width={width} height={height} fill={`url(#${uid}-fade)`} />
              </mask>
            </defs>

            {/* tier threshold bands: faint colour lines for each level */}
            {thresholds.map((t) => (
              <g key={t.label}>
                <line x1={pad.left} x2={width - pad.right} y1={yAt(t.min)} y2={yAt(t.min)} stroke={t.color} strokeOpacity={0.28} strokeDasharray="2 5" />
                <text x={pad.left + 6} y={yAt(t.min) + 11} textAnchor="start" style={{ fontSize: 9, fill: t.color, opacity: 0.8 }} className="font-mono uppercase">
                  {t.label}
                </text>
              </g>
            ))}

            {/* grid + y labels */}
            {scale.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={yAt(t)}
                  y2={yAt(t)}
                  stroke="white"
                  strokeOpacity={t === 0 ? 0.18 : 0.06}
                  strokeDasharray={t === 0 ? undefined : '3 5'}
                />
                <text x={pad.left - 8} y={yAt(t) + 3.5} textAnchor="end" className="fill-white/40 font-mono" style={{ fontSize: 10 }}>
                  {t}
                </text>
              </g>
            ))}

            {/* the next goal, so the gap is always in sight */}
            {goal !== null && (
              <g>
                <line x1={pad.left} x2={width - pad.right} y1={yAt(goal)} y2={yAt(goal)} stroke={GOLD} strokeWidth={1.5} strokeDasharray="6 5" strokeOpacity={0.9} />
                <rect x={pad.left + 4} y={yAt(goal) - 17} width={goal >= 100 ? 62 : 54} height={15} rx={7.5} fill={alpha(GOLD, 0.16)} stroke={alpha(GOLD, 0.5)} />
                <text x={pad.left + 35} y={yAt(goal) - 6.5} textAnchor="middle" style={{ fontSize: 9, fill: GOLD }} className="font-mono font-semibold tracking-wider uppercase">
                  Goal {goal}
                </text>
              </g>
            )}

            {/* x labels */}
            {points.map((p, i) =>
              i === points.length - 1 || (i % labelEvery === 0 && points[points.length - 1].x - p.x > 56) ? (
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

            {areaPath && <path d={areaPath} fill={`url(#${uid}-line)`} mask={`url(#${uid}-mask)`} />}

            {points.length > 1 && (
              <>
                {/* soft glow underlay */}
                <path d={linePath} fill="none" stroke={`url(#${uid}-line)`} strokeWidth={12} strokeOpacity={0.14} strokeLinecap="round" strokeLinejoin="round" />
                <path d={linePath} fill="none" stroke={`url(#${uid}-line)`} strokeWidth={6} strokeOpacity={0.22} strokeLinecap="round" strokeLinejoin="round" />
                <motion.path
                  key={marks.length}
                  d={linePath}
                  fill="none"
                  stroke={`url(#${uid}-line)`}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                />
              </>
            )}

            {/* crosshair */}
            {activePoint && (
              <line x1={activePoint.x} x2={activePoint.x} y1={pad.top} y2={baseY} stroke={activePoint.tier.color} strokeOpacity={0.4} strokeDasharray="2 4" />
            )}

            {points.map((p, i) => {
              const isBest = i === bestIdx && marks.length > 1
              const isLatest = i === points.length - 1
              return (
                <g key={p.mark.id}>
                  {isLatest && !reduce && (
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      fill="none"
                      stroke={p.tier.color}
                      strokeWidth={2}
                      initial={{ r: 6, opacity: 0.7 }}
                      animate={{ r: 16, opacity: 0 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                  {isBest && <circle cx={p.x} cy={p.y} r={10} fill="none" stroke={GOLD} strokeWidth={1.5} strokeOpacity={0.7} />}
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={i === active ? 6 : 4.5}
                    fill={i === active ? p.tier.color : '#0B0C11'}
                    stroke={p.tier.color}
                    strokeWidth={2.2}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduce ? 0 : 0.35 + i * 0.07 }}
                    style={{ transition: 'r 0.15s ease, fill 0.15s ease' }}
                  />
                  {isBest && (
                    <text x={p.x} y={p.y - 15} textAnchor="middle" style={{ fontSize: 12, fill: GOLD }}>
                      ★
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {activePoint && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border bg-[#0B0C11]/95 px-2.5 py-1.5 text-center shadow-lg"
              style={{
                width: tipW,
                left: tipLeft,
                top: activePoint.y - 64 < 0 ? activePoint.y + 16 : activePoint.y - 64,
                borderColor: alpha(activePoint.tier.color, 0.5),
              }}
            >
              <p className="metric text-[14px] leading-none text-white">
                {activePoint.mark.score}
                <span className="text-[10px] text-white/40"> /{NEET_MAX_SCORE}</span>
              </p>
              <p className="mt-1 truncate font-mono text-[9px] tracking-[0.08em] text-white/55 uppercase">
                {activePoint.mark.label || shortDate(activePoint.mark.date, true)}
              </p>
              <p className="mt-0.5 font-mono text-[9px] font-semibold tracking-[0.1em] uppercase" style={{ color: activePoint.tier.color }}>
                {active === bestIdx && marks.length > 1 ? '★ Personal best' : activePoint.tier.label}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Faint rising line shown before the first test so the empty graph still feels alive. */
function GhostGraph() {
  const uid = useId().replace(/:/g, '')
  return (
    <div className="relative grid h-[200px] place-items-center overflow-hidden px-6 text-center">
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="absolute inset-x-4 top-6 h-[120px] w-[calc(100%-2rem)]" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" x2="1" y1="0" y2="0">
            {RAINBOW.map((c, i) => (
              <stop key={c} offset={`${(i / (RAINBOW.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <path d="M0 100 C40 92 60 70 100 76 S170 40 210 44 S270 12 300 8" fill="none" stroke={`url(#${uid}-g)`} strokeWidth="3" strokeDasharray="4 7" strokeLinecap="round" opacity="0.55" />
        {[[0, 100], [100, 76], [210, 44], [300, 8]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill="#0B0C11" stroke={RAINBOW[i + 1]} strokeWidth="2" opacity="0.7" />
        ))}
      </svg>
      <div className="relative mt-16">
        <p className="text-[14px] font-semibold text-white/90">Your rising line starts with one test</p>
        <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-relaxed text-white/55">
          Log your first score below to light up the graph, unlock badges and set a goal to chase.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, color, hint, icon }: { label: string; value: string; color: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border px-3 py-2.5" style={{ borderColor: alpha(color, 0.3), background: `linear-gradient(160deg, ${alpha(color, 0.16)}, rgb(0 0 0 / 0.22) 70%)` }}>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <p className="label-mono flex items-center gap-1 truncate text-[9px]">
        {icon}
        {label}
      </p>
      <p className="metric mt-1 truncate text-[22px] leading-none sm:text-[24px]" style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 truncate text-[10px] font-medium" style={{ color: alpha(color, 0.85) }}>
          {hint}
        </p>
      )}
    </div>
  )
}

interface Celebration {
  title: string
  body: string
  color: string
  badges: string[]
}

/* ------------------------------------------------------------------ *
 *  Card
 * ------------------------------------------------------------------ */
export function NeetMarksCard() {
  const { state, addNeetMark, deleteNeetMark } = useOrbit()
  const reduce = useReducedMotion()

  const marks = useMemo(() => sortMarks((state.neetMarks ?? []).filter((m) => !m.deleted)), [state.neetMarks])

  const [date, setDate] = useState(todayISO)
  const [score, setScore] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const submitRef = useRef<HTMLButtonElement | null>(null)
  const today = todayISO()

  useEffect(() => {
    if (!confirmId) return
    const t = window.setTimeout(() => setConfirmId(null), 3000)
    return () => window.clearTimeout(t)
  }, [confirmId])

  useEffect(() => {
    if (!celebration) return
    const t = window.setTimeout(() => setCelebration(null), 9000)
    return () => window.clearTimeout(t)
  }, [celebration])

  const stats = useMemo(() => {
    if (marks.length === 0) return null
    const scores = marks.map((m) => m.score)
    const latest = scores[scores.length - 1]
    const prev = scores.length > 1 ? scores[scores.length - 2] : null
    const best = Math.max(...scores)
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    let upRun = 0
    for (let i = scores.length - 1; i > 0 && scores[i] > scores[i - 1]; i -= 1) upRun += 1
    return { latest, delta: prev === null ? null : latest - prev, best, avg, upRun }
  }, [marks])

  const goal = stats ? nextGoal(stats.best) : null
  const earnedIds = useMemo(() => new Set(BADGES.filter((b) => b.earned(marks)).map((b) => b.id)), [marks])
  const bestIdx = stats ? marks.findIndex((m) => m.score === stats.best) : -1

  const coach = (() => {
    if (!stats) return 'Ready when you are — your first score lights up the graph.'
    if (marks.length === 1) return `Great start! Beat ${stats.latest} on your next test to draw your first climb.`
    if (stats.delta !== null && stats.latest === stats.best && stats.delta > 0) return `You're at your all-time best — keep climbing!`
    if (stats.upRun >= 2) return `${stats.upRun} tests up in a row — unstoppable!`
    if (stats.delta !== null && stats.delta > 0) return `Up ${stats.delta} marks from last time — momentum is real.`
    if (stats.delta !== null && stats.delta < 0) return `Small dip — just ${stats.best - stats.latest} off your best. Bounce back next test!`
    return `Steady at ${stats.latest}. Push for a breakthrough next!`
  })()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = Number(score)
    if (score.trim() === '' || !Number.isFinite(value)) return setError('Enter the marks you scored.')
    if (!Number.isInteger(value)) return setError('Marks must be a whole number.')
    if (value > NEET_MAX_SCORE || value < NEET_MIN_SCORE)
      return setError(`Marks must be between ${NEET_MIN_SCORE} and ${NEET_MAX_SCORE}.`)
    if (!date || date > today) return setError('Pick today or an earlier date.')

    // Work out the reward from the list as it will look once saved.
    const probe: NeetMark = { id: '__new__', date, score: value, createdAt: Date.now(), updatedAt: Date.now() }
    const nextList = sortMarks([...marks, probe])
    const idx = nextList.findIndex((m) => m.id === '__new__')
    const before = marks.length ? bestOf(marks) : null
    const prior = idx > 0 ? nextList[idx - 1].score : null
    const newBadges = BADGES.filter((b) => b.earned(nextList) && !earnedIds.has(b.id))
    const tier = tierOf(value)

    let title: string
    let body: string
    let color: string = tier.color
    let big = false
    if (before === null) {
      title = 'First test logged! 🎯'
      body = `Your graph is alive at ${value}. Now go beat it!`
    } else if (value > before) {
      title = 'New personal best! 🏆'
      body = `${value} is ${value - before} marks above your old record of ${before}.`
      color = GOLD
      big = true
    } else if (prior !== null && value > prior) {
      title = `Up ${value - prior} marks! 🚀`
      body = `${before - value} more and you match your best of ${before}.`
    } else if (prior !== null && value === prior) {
      title = 'Holding steady 💪'
      body = `Same as last time. A breakthrough is one test away.`
    } else {
      title = 'Every test makes you sharper ✨'
      body = `Review the mistakes, then go beat ${before}. You've got this.`
    }
    if (newBadges.length) big = true

    addNeetMark({ date, score: value, label })
    setCelebration({ title, body, color, badges: newBadges.map((b) => b.label) })

    if (big) playFanfare()
    else playSparkle()
    if (!reduce) {
      burstFromElement(submitRef.current, CONFETTI, { style: 'confetti', count: big ? 180 : 70 })
      if (big) window.setTimeout(() => burstFromElement(submitRef.current, [GOLD, '#FFFFFF', '#FF6B8A'], { style: 'spark', count: 80 }), 220)
    }

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

  const latestTier = stats ? tierOf(stats.latest) : null

  return (
    <section className="glass overflow-hidden p-4 sm:p-6" aria-label="NEET marks tracker">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${RAINBOW.join(', ')}, transparent)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.16),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(255,107,138,0.14),transparent_70%)]"
      />

      {/* header */}
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl border text-white"
            style={{ borderColor: alpha('#FF6B8A', 0.4), background: `linear-gradient(135deg, ${alpha('#FF6B8A', 0.35)}, ${alpha('#A78BFA', 0.3)})` }}
          >
            <GraduationCap className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[17px] leading-tight font-semibold tracking-tight text-white/95 sm:text-[19px]">NEET Marks</h2>
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

      {/* coach line */}
      <p
        className="relative mb-4 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[12.5px] leading-snug font-medium text-white/85"
      >
        <Sparkles className="mt-0.5 size-3.5 shrink-0" style={{ color: GOLD }} strokeWidth={2} />
        <span className="bg-gradient-to-r from-[#FFB199] via-[#FBBF24] to-[#A78BFA] bg-clip-text text-transparent">{coach}</span>
      </p>

      {/* stats */}
      {stats && latestTier && (
        <div className="relative mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Latest" value={String(stats.latest)} color={latestTier.color} hint={`${latestTier.label} · ${Math.round((stats.latest / NEET_MAX_SCORE) * 100)}%`} />
          <Stat label="Best" value={String(stats.best)} color={GOLD} hint={`on ${shortDate(marks[bestIdx].date)}`} icon={<Crown className="size-3" />} />
          <Stat label="Average" value={String(stats.avg)} color="#22D3EE" hint={`across ${marks.length}`} />
        </div>
      )}

      {/* graph */}
      <div className="relative rounded-xl border border-white/[0.07] bg-black/25 px-1 pt-3 pb-1 sm:px-3">
        {marks.length === 0 ? <GhostGraph /> : <ScoreChart marks={marks} goal={goal} />}
      </div>

      {/* next goal */}
      {stats && (
        <div className="relative mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: alpha(GOLD, 0.25), background: alpha(GOLD, 0.06) }}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-white/90">
              <Target className="size-3.5 shrink-0" style={{ color: GOLD }} />
              <span className="truncate">{goal ? `Next goal: ${goal}` : 'Perfect score unlocked'}</span>
            </span>
            <span className="metric shrink-0 text-[11px]" style={{ color: GOLD }}>
              {goal ? `${goal - stats.best} to go` : '720 / 720'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={goal ?? NEET_MAX_SCORE} aria-valuenow={Math.max(0, stats.best)} aria-label="Progress to next goal">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${RAINBOW.join(', ')})` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(3, Math.min(100, (stats.best / (goal ?? NEET_MAX_SCORE)) * 100))}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      )}

      {/* celebration */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            key={celebration.title + celebration.body}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            className="relative mt-3 overflow-hidden rounded-xl border px-3.5 py-3"
            style={{ borderColor: alpha(celebration.color, 0.55), background: `linear-gradient(120deg, ${alpha(celebration.color, 0.22)}, ${alpha('#A78BFA', 0.12)} 70%, transparent)` }}
          >
            <button
              type="button"
              onClick={() => setCelebration(null)}
              className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full text-white/50 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
            <p className="pr-8 text-[14px] font-semibold text-white">{celebration.title}</p>
            <p className="mt-0.5 pr-8 text-[12px] leading-snug text-white/75">{celebration.body}</p>
            {celebration.badges.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium" style={{ color: GOLD }}>
                <Trophy className="size-3.5" /> Badge unlocked:
                {celebration.badges.map((b) => (
                  <span key={b} className="rounded-full border px-2 py-0.5" style={{ borderColor: alpha(GOLD, 0.5), background: alpha(GOLD, 0.14) }}>
                    {b}
                  </span>
                ))}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* add form */}
      <form onSubmit={submit} className="relative mt-4" noValidate>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="label-mono text-[9.5px]">Log a test</p>
          {stats && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: alpha(GOLD, 0.35), color: GOLD, background: alpha(GOLD, 0.08) }}>
              <Trophy className="size-3 shrink-0" />
              <span className="truncate">Beat {stats.best} for a new record</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:gap-3">
          <label className="min-w-0">
            <span className="sr-only">Test date</span>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Test date" />
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
            <input type="text" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="Test name (optional)" className={inputCls} aria-label="Test name, optional" />
          </label>
          <button
            ref={submitRef}
            type="submit"
            className="col-span-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/20 px-5 text-[13px] font-semibold text-white shadow-[0_8px_24px_-10px_rgba(255,8,68,0.7)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:col-span-1 sm:h-10"
            style={{ background: 'linear-gradient(110deg, #FF0844, #FF6B8A 45%, #A78BFA)' }}
          >
            <Plus className="size-4" strokeWidth={2.4} />
            Add marks
          </button>
        </div>
        <p role="alert" className={`mt-2 text-[11.5px] text-[#FF8FA8] ${error ? '' : 'hidden'}`}>
          {error}
        </p>
      </form>

      {/* badges */}
      <div className="relative mt-5 border-t border-white/[0.07] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-mono text-[9.5px]">Badges</p>
          <span className="metric text-[10.5px] text-white/55">
            {earnedIds.size}/{BADGES.length} unlocked
          </span>
        </div>
        <ul className="grid grid-cols-4 gap-2">
          {BADGES.map((b) => {
            const earned = earnedIds.has(b.id)
            const Icon = b.icon
            return (
              <li
                key={b.id}
                title={earned ? b.label : `Locked: ${b.hint}`}
                className="flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center"
                style={{
                  borderColor: earned ? alpha(b.color, 0.45) : 'rgb(255 255 255 / 0.06)',
                  background: earned ? `linear-gradient(170deg, ${alpha(b.color, 0.2)}, transparent)` : 'rgb(0 0 0 / 0.18)',
                }}
              >
                <span
                  className="grid size-9 place-items-center rounded-full"
                  style={{
                    color: earned ? b.color : 'rgb(255 255 255 / 0.28)',
                    background: earned ? alpha(b.color, 0.18) : 'rgb(255 255 255 / 0.04)',
                    boxShadow: earned ? `0 0 16px -2px ${alpha(b.color, 0.6)}` : undefined,
                  }}
                >
                  {earned ? <Icon className="size-[18px]" strokeWidth={2} /> : <Lock className="size-4" strokeWidth={1.8} />}
                </span>
                <span className={`w-full truncate text-[9.5px] leading-tight font-medium ${earned ? 'text-white/90' : 'text-white/40'}`}>{b.label}</span>
                <span className="w-full truncate text-[8.5px] leading-tight text-white/35">{earned ? 'Unlocked' : b.hint}</span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* history */}
      {history.length > 0 && (
        <div className="relative mt-4 border-t border-white/[0.07] pt-3">
          <p className="label-mono mb-1.5 text-[9.5px]">History</p>
          <ul className="divide-y divide-white/[0.06]">
            {visible.map((m) => {
              const delta = deltaOf(m)
              const confirming = confirmId === m.id
              const t = tierOf(m.score)
              const isBest = stats !== null && marks.length > 1 && m.id === marks[bestIdx]?.id
              return (
                <li key={m.id} className="flex min-h-12 items-center gap-3 py-2">
                  <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full" style={{ background: t.color, boxShadow: `0 0 10px ${alpha(t.color, 0.6)}` }} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] text-white/90">
                      <span className="truncate">{m.label || 'NEET test'}</span>
                      {isBest && <Star className="size-3 shrink-0" style={{ color: GOLD }} fill="currentColor" aria-label="Personal best" />}
                    </p>
                    <p className="metric text-[10.5px] text-white/45">{shortDate(m.date, true)}</p>
                  </div>
                  {delta !== null && (
                    <span className={`metric text-[11px] ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-[#FF8FA8]' : 'text-white/45'}`}>
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  )}
                  <span className="metric w-[3.4rem] text-right text-[16px] font-semibold" style={{ color: t.color }}>
                    {m.score}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirming) {
                        deleteNeetMark(m.id)
                        setConfirmId(null)
                      } else setConfirmId(m.id)
                    }}
                    className={`grid h-9 shrink-0 place-items-center rounded-full border text-[10px] font-medium transition-colors ${
                      confirming ? 'border-[#FF0844]/50 bg-[#FF0844]/15 px-3 text-[#FF8FA8]' : 'w-9 border-white/[0.08] text-white/50 hover:border-[#FF0844]/35 hover:text-[#FF0844]'
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
