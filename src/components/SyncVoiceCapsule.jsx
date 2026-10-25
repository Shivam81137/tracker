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
  coding: [
    'turned his DSA reps into a personality trait',
    'argued with bugs and actually won',
    'shipped code like the deadline owed him money',
    'acted like one clean commit could fix his entire reputation',
    'made his side project sound like a startup with investors',
  ],
  medical: [
    'treated his study blocks like a personal rivalry',
    'kept his revision sharp enough to cut',
    'studied like the syllabus had personally insulted him',
  ],
  fitness: [
    'kept the training streak alive, annoyingly so',
    'made the gym look like a personality requirement',
    'treated leg day like a character flaw he could fix',
  ],
  reading: [
    'cleared his reading list like a man with something to prove',
    'read one chapter and called it a lifestyle',
  ],
  creative: [
    'made his creative work look suspiciously effortless',
    'called an unfinished draft “almost done” with a straight face',
  ],
  general: [
    'moved his orbit forward',
    'checked boxes like it was a competitive sport',
    'did the minimum with maximum confidence',
    'acted busy enough to avoid being asked for more',
  ],
}

const NOOR_PHRASES = {
  medical: [
    'made her medical prep look unfairly easy',
    'studied like the syllabus owed her money',
    'put her DPPs in a headlock',
    'treated revision like a group project she refused to carry',
  ],
  coding: [
    'sharpened her coding reps and kept the bugs nervous',
    'debugged like she was personally offended by the error',
    'wrote code that made Shivam pretend not to be impressed',
  ],
  fitness: [
    'kept the training streak alive, annoyingly so',
    'made the gym look like a personality requirement',
    'made cardio look like a personal vendetta',
  ],
  reading: [
    'cleared her reading goals without breaking a sweat',
    'finished a chapter and acted like she had run a marathon',
  ],
  creative: [
    'made her creative work look suspiciously effortless',
    'made Shivam’s drafts look like rough drafts',
  ],
  general: [
    'moved her orbit forward',
    'checked boxes like it was a competitive sport',
    'did the work quietly and let Shivam think he was in charge',
    'made productivity look like a personality flex',
  ],
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

/** Keeps the recap honest: a partner with nothing done gets a bench joke, not a fake win. */
function teasePhrase(person, theme, variant, done) {
  if (done > 0) return phraseFor(person, theme, variant)
  return person === 'noor'
    ? pick(
        [
          'watched the plan from a safe distance',
          'provided moral support and zero completed tasks',
          'kept the bench warm with style',
        ],
        variant,
      )
    : pick(
        [
          'watched the plan from the sidelines',
          'provided strategic commentary and zero completed tasks',
          'kept the bench warm with confidence',
        ],
        variant,
      )
}

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
  const sPhrase = teasePhrase('shivam', sTheme, variant, s.done)
  const nPhrase = teasePhrase('noor', nTheme, variant + 1, n.done)

  let line

  if (total === 0) {
    line = pick(
      [
        'Zero tasks between you. Shivam is calling it “recovery”; Noor is calling it “research.” The board is calling it a group nap.',
        'An empty board — Shivam’s ambition and Noor’s to-do list both took the day off. Suspicious. Cute, but suspicious.',
        'Nothing logged. Shivam says he was “strategizing”; Noor says she was “resting.” The board has heard better alibis.',
        'The board is spotless, which is one way to say Shivam and Noor ghosted their own plans. Tomorrow, presumably, with feeling.',
        'No tasks done. You two have successfully optimized the day for doing absolutely nothing. The board is impressed and a little concerned.',
        'A completely empty orbit. Shivam and Noor are either resting, plotting, or waiting for the other one to go first.',
      ],
      variant,
    )
  } else if (combinedSync >= 100) {
    line = pick(
      [
        '100% sync. Shivam and Noor cleared every task and are now legally insufferable. The board has never been so smug.',
        `A flawless 100% — Shivam ${sPhrase}, and Noor ${nPhrase}. Show-offs, both of you. The board never stood a chance.`,
        `100% done. Shivam ${sPhrase}; Noor ${nPhrase}. Perfect sync, zero humility. Tomorrow has a tough act to follow.`,
        'Every task cleared. Shivam is acting like he invented productivity; Noor is letting him think that. 100% sync, 0% modesty.',
        'A clean sweep for Shivam and Noor. One of you is gloating; the other is pretending not to. The board approves, reluctantly.',
        '100% sync. You two are now unbearably competent. The board would like a moment alone to process it.',
      ],
      variant,
    )
  } else if (combinedSync > 50) {
    line = pick(
      [
        `${combinedSync}% sync. Shivam ${sPhrase} while Noor ${nPhrase}. Not perfect, but the orbit is definitely flexing.`,
        `A respectable ${combinedSync}%: Shivam ${sPhrase} and Noor ${nPhrase}. The board survived, mostly.`,
        `${combinedSync}% combined sync — Shivam ${sPhrase}, Noor ${nPhrase}. Solid work, with just enough unfinished business to keep tomorrow interesting.`,
        `${combinedSync}% sync. Shivam is carrying the “vision”; Noor is carrying the actual tasks. The board is taking notes.`,
        `A decent ${combinedSync}%. Shivam and Noor left just enough undone to blame each other tomorrow. Efficient, honestly.`,
        `${combinedSync}% sync. You two are almost a functional team — don’t ruin it by talking about it.`,
        `${combinedSync}% done. Shivam made sure everyone knew; Noor made sure it was actually done. The board is not commenting.`,
      ],
      variant,
    )
  } else if (done === 0) {
    line = pick(
      [
        `${total} tasks, zero done. Shivam claims strategy; Noor claims standards. The board claims both of you owe it an apology.`,
        `Zero of ${total} done. Shivam and Noor have successfully converted a to-do list into a museum exhibit.`,
        `0% sync. The tasks are all still there, gleaming with potential. Shivam and Noor are “getting to them” — eventually.`,
        `A bold 0-of-${total} effort. Shivam and Noor did the easy bits — namely, nothing. Tomorrow can pick up the slack.`,
        `0% done. You two left the heavy lifting for tomorrow, which is a very cute way to say “nope” — adorable.`,
        `Nothing done yet. Shivam and Noor are pacing themselves — at this rate, tomorrow is going to be very busy.`,
      ],
      variant,
    )
  } else {
    line = pick(
      [
        `${combinedSync}% sync. Shivam ${sPhrase}; Noor ${nPhrase}. The orbit is still warming up — no need to alert the press.`,
        `A bold ${done}-of-${total} effort: Shivam ${sPhrase}, Noor ${nPhrase}. Tomorrow can pick up the slack.`,
        `${combinedSync}% done. One of you is “warming up”; the other is already composing excuses. The board isn’t buying either.`,
        `Only ${done} of ${total} done. Shivam claims strategy; Noor claims standards. The board claims both of you owe it an apology.`,
        `${combinedSync}% sync. You two left the heavy lifting for tomorrow, which is a very cute way to say “nope” — adorable.`,
        `${done} of ${total} done. Shivam and Noor are pacing themselves — at this rate, tomorrow is going to be very busy.`,
        `${combinedSync}% sync. Shivam and Noor did the easy bits and saved the character development for tomorrow.`,
        `${done} of ${total} done (${combinedSync}% sync). Shivam and Noor did just enough to keep the board from filing a complaint. Tomorrow’s redemption arc starts now.`,
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
  const s = summarize(shivamTasks)
  const n = summarize(noorTasks)
  const total = s.total + n.total
  const done = s.done + n.done
  const sync = total > 0 ? Math.round((done / total) * 100) : 0
  const fmt = (tasks) =>
    tasks.length
      ? tasks.map((task) => `"${task.title}"${task.done ? ' (done)' : ' (pending)'}`).join(', ')
      : 'none logged'
  return [
    "Write a playful, teasing recap of Shivam and Noor’s day — like a friend who knows them too well and is affectionately roasting both of them.",
    `Shivam: ${s.done}/${s.total} done. Noor: ${n.done}/${n.total} done. Combined sync: ${sync}%.`,
    `Shivam's tasks: ${fmt(shivamTasks)}.`,
    `Noor's tasks: ${fmt(noorTasks)}.`,
    `Date: ${dateStr}.`,
    'Mention both names. Use the real numbers or task details. One or two short sentences, under 32 words total. Cheeky and specific, never cruel, never generic, no emojis, no icons.',
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
              "You are SyncOrbit, a cheeky evening narrator who knows Shivam and Noor too well. Reply with one or two short, playful, teasing sentences that affectionately roast both of them. Mention both names, use the real numbers or task details. Never cruel, never generic, never cheesy. No emojis or icons.",
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
 *  Firebase persistence (`${db}/recaps/v3/${date}.json`)
 *
 *  The `v3` namespace keeps the new teasing voice from being masked by the
 *  older recaps saved under `recaps/` and `recaps/v2/`.
 * ------------------------------------------------------------------ */

const trimBase = (url) => `${url ?? ''}`.replace(/\/+$/, '')

async function fetchRemoteRecap(firebaseDbUrl, dateStr) {
  const base = trimBase(firebaseDbUrl)
  if (!base) return null
  try {
    const res = await fetch(`${base}/recaps/v3/${dateStr}.json`)
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
    await fetch(`${base}/recaps/v3/${dateStr}.json`, {
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

      <div className="relative flex flex-wrap items-center justify-end gap-3">
        <span className="metric text-[10px] tracking-[0.14em] text-white/50 uppercase">
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
          className="relative font-serif text-[21px] leading-[1.45] tracking-[-0.005em] text-balance text-white/95 sm:text-[27px]"
        >
          {busy && !recap ? (
            <span className="inline-flex items-center gap-2 font-sans text-[13px] tracking-tight text-white/64">
              <Loader2 className="size-4 animate-spin" /> Composing today’s voice…
            </span>
          ) : (
            recap || <span className="font-sans text-[13px] text-white/50">Synthesizing…</span>
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
