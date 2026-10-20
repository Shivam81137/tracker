import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { formatLong, relativeDayLabel, todayISO } from '../lib/date'
import { useOrbit } from '../lib/orbit-context'

/* ------------------------------------------------------------------ *
 *  Daily Sync Voice — constants
 * ------------------------------------------------------------------ */

const AI_KEY_STORAGE = 'syncorbit.ai.key.v1'

/** Optional build-time fallback (kept out of git via `.env.local`). */
const ENV_KEY = `${import.meta.env?.VITE_GROQ_API_KEY ?? ''}`.trim()

/**
 * Keyword buckets used by the offline heuristic. Titles are lower-cased and
 * matched with `includes`, so short stems (`dpp`, `dsa`) are enough.
 */
const THEME_KEYWORDS = {
  coding: [
    'dsa',
    'code',
    'coding',
    'leetcode',
    'algorithm',
    'algo',
    'react',
    'javascript',
    'typescript',
    'python',
    'java',
    'bug',
    'debug',
    'deploy',
    'api',
    'dev',
    'engineer',
    'program',
    'github',
    'backend',
    'frontend',
    'sql',
    'commit',
    'build',
    'ship',
  ],
  medical: [
    'medical',
    'med',
    'dpp',
    'neet',
    'bio',
    'biology',
    'anatomy',
    'physiology',
    'pharma',
    'chemistry',
    'physics',
    'revision',
    'revise',
    'exam',
    'lecture',
    'study',
    'studies',
    'mbbs',
    'nursing',
    'ward',
    'clinic',
    'prep',
  ],
  fitness: ['gym', 'workout', 'run', 'cardio', 'yoga', 'stretch', 'fitness', 'steps', 'walk'],
  reading: ['read', 'book', 'novel', 'chapter', 'article'],
  creative: ['design', 'draw', 'sketch', 'write', 'writing', 'blog', 'edit', 'video', 'music'],
}

const SHIVAM_PHRASES = {
  coding: ['turned his coding/DSA reps into a win', 'pushed through his dev and DSA goals', 'shipped his coding milestones'],
  medical: ['locked in on his study blocks', 'kept his revision sharp'],
  fitness: ['kept his training streak alive'],
  reading: ['cleared his reading goals'],
  creative: ['brought his creative work forward'],
  general: ['moved his orbit forward', 'checked off his plan for the day'],
}

const NOOR_PHRASES = {
  medical: [
    'crushed her medical prep',
    'advanced her studies with real focus',
    'owned her DPP and revision',
  ],
  coding: ['sharpened her coding reps', 'worked cleanly through her tech tasks'],
  fitness: ['kept her training streak alive'],
  reading: ['cleared her reading goals'],
  creative: ['brought her creative work forward'],
  general: ['moved her orbit forward', 'checked off her plan for the day'],
}

/* ------------------------------------------------------------------ *
 *  Recap generation engine
 * ------------------------------------------------------------------ */

function summarize(tasks) {
  const total = tasks.length
  const done = tasks.filter((task) => task.done).length
  return { total, done }
}

/** Picks the dominant theme across a set of tasks. */
function themeOf(tasks) {
  const score = {}
  for (const task of tasks) {
    const text = `${task.title ?? ''} ${task.time ?? ''}`.toLowerCase()
    for (const [theme, words] of Object.entries(THEME_KEYWORDS)) {
      if (words.some((word) => text.includes(word))) {
        score[theme] = (score[theme] ?? 0) + 1
      }
    }
  }
  let best = 'general'
  let bestScore = 0
  for (const [theme, value] of Object.entries(score)) {
    if (value > bestScore) {
      best = theme
      bestScore = value
    }
  }
  return best
}

function phraseFor(person, theme, variant) {
  const table = person === 'noor' ? NOOR_PHRASES : SHIVAM_PHRASES
  const list = table[theme] ?? table.general
  return list[Math.abs(variant) % list.length]
}

const pick = (list, variant) => list[Math.abs(variant) % list.length]

/**
 * Builds a polished one-sentence recap from both partners' tasks for a date.
 *
 * Fully offline: no network, no key, instant. `variant` rotates through
 * alternative phrasings so the "Regenerate" button cycles the voice.
 *
 * @param {Array} shivamTasks
 * @param {Array} noorTasks
 * @param {string} dateStr ISO `YYYY-MM-DD`
 * @param {number} [variant]
 * @returns {string}
 */
function generateDailyRecap(shivamTasks = [], noorTasks = [], dateStr = todayISO(), variant = 0) {
  const s = summarize(shivamTasks)
  const n = summarize(noorTasks)
  const total = s.total + n.total
  const done = s.done + n.done
  const combinedSync = total > 0 ? Math.round((done / total) * 100) : 0

  const sTheme = themeOf(shivamTasks)
  const nTheme = themeOf(noorTasks)
  const sPhrase = phraseFor('shivam', sTheme, variant)
  const nPhrase = phraseFor('noor', nTheme, variant)

  let line

  if (total === 0) {
    line = pick(
      [
        'A quiet orbit today: no steps logged, just open sky. Tomorrow’s constellation is already forming.',
        'Still waters in orbit: nothing logged today. Rest is part of the rhythm, and the board waits patiently.',
        'An empty ledger under a calm sky. Today asked for stillness — tomorrow asks for motion.',
      ],
      variant,
    )
  } else if (combinedSync >= 100) {
    line = pick(
      [
        'An unstoppable day in orbit: Shivam and Noor achieved a flawless 100% combined sync. Every milestone conquered.',
        `Flawless orbit at 100% sync — Shivam ${sPhrase}, and Noor ${nPhrase}. Nothing left on the board.`,
        `A perfect 100% combined sync. Shivam ${sPhrase}; Noor ${nPhrase}. A day built to remember.`,
      ],
      variant,
    )
  } else if (combinedSync > 50) {
    line = pick(
      [
        `A productive stride: Shivam ${sPhrase} while Noor ${nPhrase} — a solid ${combinedSync}% combined sync today.`,
        `Strong momentum today: Shivam ${sPhrase} and Noor ${nPhrase}, reaching ${combinedSync}% combined sync.`,
        `${combinedSync}% in sync — Shivam ${sPhrase} while Noor ${nPhrase}. The orbit is holding steady.`,
      ],
      variant,
    )
  } else {
    line = pick(
      [
        `Quiet momentum: ${done} of ${total} steps completed (${combinedSync}% combined sync). Every small action builds tomorrow’s orbit.`,
        `Steady progress: ${done} of ${total} steps done — ${combinedSync}% combined sync. Small orbits compound.`,
        `A measured day: ${done} of ${total} complete. Shivam ${sPhrase}; Noor ${nPhrase}. Tomorrow continues the arc.`,
      ],
      variant,
    )
  }

  const when =
    dateStr === todayISO() ? 'today' : relativeDayLabel(dateStr) === 'Yesterday' ? 'yesterday' : 'that day'
  return line.replace(/\btoday\b/g, when).replace(/\s+/g, ' ').trim()
}

/* ------------------------------------------------------------------ *
 *  Optional AI voice (Groq / OpenAI, OpenAI-compatible endpoint)
 * ------------------------------------------------------------------ */

function buildPrompt(dateStr, shivamTasks, noorTasks) {
  const fmt = (tasks) =>
    tasks.length
      ? tasks.map((task) => `"${task.title}"${task.done ? ' (done)' : ' (pending)'}`).join(', ')
      : 'none logged'
  return [
    "Summarize today's progress for Shivam and Noor in one sophisticated, encouraging sentence (under 25 words).",
    `Shivam's tasks: ${fmt(shivamTasks)}.`,
    `Noor's tasks: ${fmt(noorTasks)}.`,
    `Date: ${dateStr}.`,
    'Do not use emojis or icons; keep the sentence typographic and editorial.',
  ].join(' ')
}

function sanitizeVoice(text) {
  return `${text}`
    // Keep the journal voice purely typographic: drop every pictograph,
    // including sparkles and hearts, wherever it appears.
    .replace(/[\p{Extended_Pictographic}✦]/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/^["'“”\s…·—–-]+/u, '')
    .replace(/["'“”\s]+$/g, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** @returns {Promise<{ text?: string, error?: string }>} */
async function requestAiVoice({ apiKey, date, shivamTasks, noorTasks }) {
  const key = `${apiKey ?? ''}`.trim()
  if (!key) return { error: 'No API key set.' }

  const isGroq = key.startsWith('gsk_')
  const provider = isGroq ? 'Groq' : 'OpenAI'
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'

  // Ordered by preference; the loop skips models an account can't access.
  const models = isGroq
    ? [
        { id: 'openai/gpt-oss-120b', reasoningEffort: 'low' },
        { id: 'qwen/qwen3.8-27b' },
        { id: 'openai/gpt-oss-20b', reasoningEffort: 'low' },
        { id: 'llama-3.3-70b-versatile' },
        { id: 'llama-3.1-8b-instant' },
      ]
    : [{ id: 'gpt-4o-mini' }, { id: 'gpt-4.1-mini' }]

  const prompt = buildPrompt(date, shivamTasks, noorTasks)

  let lastError = ''
  for (const model of models) {
    try {
      const body = {
        model: model.id,
        messages: [
          {
            role: 'system',
            content:
              "You are SyncOrbit, an elegant evening journal that summarizes two people's progress. Reply with one refined, warm sentence only. Never cheesy. No emojis or icons.",
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }
      if (model.reasoningEffort) body.reasoning_effort = model.reasoningEffort

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        lastError = res.status === 401 ? `${provider} rejected the key.` : `${provider} error ${res.status}.`
        if (res.status === 401 || res.status === 403) return { error: lastError }
        continue
      }

      const data = await res.json()
      const raw = data?.choices?.[0]?.message?.content
      if (typeof raw !== 'string' || !raw.trim()) {
        lastError = 'Empty response from the model.'
        continue
      }
      return { text: sanitizeVoice(raw) }
    } catch (err) {
      lastError = err?.message || 'Network error.'
    }
  }
  return { error: lastError || 'AI request failed.' }
}

/* ------------------------------------------------------------------ *
 *  Firebase persistence (`${db}/recaps/${date}.json`)
 * ------------------------------------------------------------------ */

const trimBase = (url) => `${url ?? ''}`.replace(/\/+$/, '')

async function fetchRemoteRecap(firebaseDbUrl, dateStr) {
  const base = trimBase(firebaseDbUrl)
  if (!base) return null
  try {
    const res = await fetch(`${base}/recaps/${dateStr}.json`)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data.text === 'string' && data.text.trim()) return data.text
    return null
  } catch {
    return null
  }
}

async function saveRemoteRecap(firebaseDbUrl, dateStr, text) {
  const base = trimBase(firebaseDbUrl)
  const clean = sanitizeVoice(text)
  if (!base || !clean) return
  try {
    await fetch(`${base}/recaps/${dateStr}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    })
  } catch {
    /* offline-safe: local recap still shows */
  }
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */

function readStored(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function SyncVoiceCapsule() {
  const { allTasks, viewDate, firebaseDbUrl, pushToast } = useOrbit()

  const tasksForDate = useMemo(
    () => allTasks.filter((task) => task.date === viewDate),
    [allTasks, viewDate],
  )
  const shivamTasks = useMemo(() => tasksForDate.filter((task) => task.owner === 'shivam'), [tasksForDate])
  const noorTasks = useMemo(() => tasksForDate.filter((task) => task.owner === 'noor'), [tasksForDate])

  const [recap, setRecap] = useState('')
  const [source, setSource] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [apiKey] = useState(() => readStored(AI_KEY_STORAGE, ENV_KEY))
  const aiEnabled = apiKey.length > 0

  const variantRef = useRef(0)
  const generatedFor = useRef('')
  const hydrated = useRef(false)

  /* Signature changes only when the tasks for this date actually change. */
  const taskSignature = useMemo(
    () => `${viewDate}|${tasksForDate.map((task) => `${task.id}:${task.done ? 1 : 0}:${task.title}`).join('|')}`,
    [tasksForDate, viewDate],
  )

  /* Load: prefer the shared cloud recap, then AI, then the offline engine. */
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const remote = await fetchRemoteRecap(firebaseDbUrl, viewDate)
      if (cancelled) return
      if (remote) {
        setRecap(sanitizeVoice(remote))
        setSource('cloud')
        generatedFor.current = viewDate
        return
      }

      if (aiEnabled && apiKey) {
        const ai = await requestAiVoice({ apiKey, date: viewDate, shivamTasks, noorTasks })
        if (cancelled) return
        if (ai.text) {
          setRecap(sanitizeVoice(ai.text))
          setSource('ai')
          generatedFor.current = viewDate
          void saveRemoteRecap(firebaseDbUrl, viewDate, ai.text)
          return
        }
      }

      const local = generateDailyRecap(shivamTasks, noorTasks, viewDate, variantRef.current)
      if (cancelled) return
      setRecap(sanitizeVoice(local))
      setSource('local')
      generatedFor.current = viewDate
      void saveRemoteRecap(firebaseDbUrl, viewDate, local)
    }

    run()
    return () => {
      cancelled = true
    }
    // Tasks are intentionally omitted: this runs on date / cloud / AI changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate, firebaseDbUrl, apiKey])

  /* Live updates: re-synthesize locally when the day's tasks change. */
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    if (generatedFor.current !== viewDate) return
    if (source === 'cloud') return

    const local = generateDailyRecap(shivamTasks, noorTasks, viewDate, variantRef.current)
    setRecap(sanitizeVoice(local))
    setSource('local')
    void saveRemoteRecap(firebaseDbUrl, viewDate, local)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSignature])

  const handleRegenerate = useCallback(async () => {
    variantRef.current += 1
    setBusy(true)
    try {
      let text = null

      if (aiEnabled && apiKey) {
        const ai = await requestAiVoice({ apiKey, date: viewDate, shivamTasks, noorTasks })
        if (ai.text) {
          text = ai.text
          setSource('ai')
        } else {
          pushToast({
            title: 'AI voice unavailable',
            body: ai.error ?? 'Falling back to the local voice.',
            accent: 'neutral',
            icon: '✦',
            ttl: 3400,
          })
        }
      }

      if (!text) {
        text = generateDailyRecap(shivamTasks, noorTasks, viewDate, variantRef.current)
        setSource('local')
      }

      setRecap(sanitizeVoice(text))
      generatedFor.current = viewDate
      void saveRemoteRecap(firebaseDbUrl, viewDate, text)
    } finally {
      setBusy(false)
    }
  }, [aiEnabled, apiKey, viewDate, shivamTasks, noorTasks, firebaseDbUrl, pushToast])

  return (
    <section
      className="relative overflow-hidden rounded-card border border-white/[0.08] bg-[rgba(18,19,26,0.75)] p-5 shadow-2xl backdrop-blur-[20px] sm:p-6"
      aria-label="Daily sync voice"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/45 to-transparent"
      />
      {/* Ambient aurora, kept far behind the type. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.16),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(0,242,254,0.12),transparent_70%)]"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 shadow-[0_0_24px_-12px_rgba(245,158,11,0.55)]">
          <span className="text-[11px] leading-none text-[#F59E0B]" aria-hidden="true">
            ✦
          </span>
          <span className="label-mono !text-white/70">Daily Sync Voice</span>
        </span>

        <span className="metric text-[10px] tracking-[0.14em] text-white/35 uppercase">
          {formatLong(viewDate)}
        </span>
      </div>

      <div className="relative mt-5 max-w-3xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 -left-1 font-serif text-[54px] leading-none text-[#F59E0B]/20 select-none"
        >
          &ldquo;
        </span>
        <p
          aria-live="polite"
          className="relative font-serif text-[21px] leading-[1.45] tracking-[-0.005em] text-balance text-white/92 sm:text-[27px]"
        >
          {busy && !recap ? (
            <span className="inline-flex items-center gap-2 font-sans text-[13px] tracking-tight text-white/50">
              <Loader2 className="size-4 animate-spin" /> Composing today’s voice…
            </span>
          ) : (
            recap || <span className="font-sans text-[13px] text-white/35">Synthesizing…</span>
          )}
        </p>
      </div>

      <div className="relative mt-5 flex items-center border-t border-white/[0.08] pt-4">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={busy}
          className="pill pill-hover disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.9} />
          Regenerate
        </button>
      </div>
    </section>
  )
}
