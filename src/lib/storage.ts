import { NUDGE_LOG_LIMIT, STORAGE_KEY, TOMBSTONE_TTL_MS, DEVICE_KEY, USER_IDENTITY_KEY, FIREBASE_URL_KEY } from './constants'
import { fromISODate, todayISO } from './date'
import type { NudgeEvent, OrbitState, Person, Priority, Task } from './types'

export const STATE_VERSION = 1

export function emptyState(): OrbitState {
  return { version: STATE_VERSION, tasks: [], nudges: [], tombstones: {} }
}

/**
 * A brand-new browser has no tasks, tombstones, nudges, moods or scratchpad.
 * Never publish this over a cloud snapshot that may still be loading, otherwise
 * a fresh device can erase the partner's board on first launch.
 */
export function isBlankState(state: OrbitState): boolean {
  return (
    state.tasks.length === 0 &&
    state.nudges.length === 0 &&
    Object.keys(state.tombstones).length === 0 &&
    !state.sharedScratchpad?.text?.trim() &&
    !state.shivamMood &&
    !state.noorMood &&
    !state.lastNudge
  )
}

export function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Stable per-browser identity. Persisted so signal attribution ("sent" vs
 * "received") survives reloads and stays consistent across open tabs.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const fresh = uid()
    localStorage.setItem(DEVICE_KEY, fresh)
    return fresh
  } catch {
    return 'volatile-device'
  }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const PRIORITY_SET = new Set<Priority>(['high', 'med', 'chill'])
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null
  const { id, date, owner, title } = raw
  if (typeof id !== 'string' || !id) return null
  if (typeof date !== 'string' || !ISO_RE.test(date)) return null
  if (owner !== 'shivam' && owner !== 'noor') return null
  if (typeof title !== 'string') return null

  const trimmed = title.trim().slice(0, 160)
  if (!trimmed) return null

  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now()
  // `done` is authoritative. Legacy replicas used `completed` as the only
  // completion flag, so only fall back to it when `done` is absent. Otherwise
  // a stale `completed: true` would resurrect a task the user just unchecked.
  const done = typeof raw.done === 'boolean' ? raw.done : raw.completed === true
  const deleted = raw.deleted === true
  const time = typeof raw.time === 'string' && TIME_RE.test(raw.time) ? raw.time : undefined
  const priority = PRIORITY_SET.has(raw.priority as Priority) ? (raw.priority as Priority) : 'chill'
  const cheers = typeof raw.cheers === 'number' && Number.isFinite(raw.cheers) ? Math.max(0, Math.floor(raw.cheers)) : 0
  const cheered = raw.cheered === true || cheers > 0

  return {
    id,
    date,
    owner,
    title: trimmed,
    done,
    completed: done,
    deleted,
    time,
    priority,
    cheers,
    cheered,
    linkId: typeof raw.linkId === 'string' && raw.linkId ? raw.linkId : undefined,
    rolledFrom: typeof raw.rolledFrom === 'string' && ISO_RE.test(raw.rolledFrom) ? raw.rolledFrom : undefined,
    createdAt,
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    completedAt:
      typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt)
        ? raw.completedAt
        : done
          ? createdAt
          : undefined,
  }
}

function sanitizeNudge(raw: unknown): NudgeEvent | null {
  if (!isRecord(raw)) return null
  const kind = raw.kind
  if (kind !== 'boost' && kind !== 'proud' && kind !== 'hydrate' && kind !== 'break') return null
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : Date.now()
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `${kind}-${at}`
  const by = typeof raw.by === 'string' && raw.by ? raw.by : 'unknown'
  const from = typeof raw.from === 'string' ? raw.from : undefined
  const icon = typeof raw.icon === 'string' ? raw.icon : undefined
  return { id, kind, at, by, from, icon }
}

/**
 * Deterministic tie-breaker for replicas that carry the exact same clock stamp.
 * Without this, two devices can keep different `done` flags forever because the
 * merge cannot tell which side is newer.
 */
function taskRank(task: Task): string {
  return [
    task.deleted ? '1' : '0',
    task.done ? '1' : '0',
    String(task.cheers).padStart(6, '0'),
    task.title,
    task.time ?? '',
    task.priority,
  ].join('|')
}

function preferTask(candidate: Task, current?: Task): boolean {
  if (!current) return true
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt
  return taskRank(candidate) > taskRank(current)
}

export function sanitizeState(raw: unknown): OrbitState {
  if (!isRecord(raw)) return emptyState()

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map(sanitizeTask).filter((t): t is Task => t !== null)
    : []

  const nudges = Array.isArray(raw.nudges)
    ? raw.nudges
        .map(sanitizeNudge)
        .filter((n): n is NudgeEvent => n !== null)
        .sort((a, b) => b.at - a.at)
        .slice(0, NUDGE_LOG_LIMIT)
    : []

  const tombstones: Record<string, number> = {}
  if (isRecord(raw.tombstones)) {
    for (const [key, value] of Object.entries(raw.tombstones)) {
      if (typeof value === 'number' && Number.isFinite(value)) tombstones[key] = value
    }
  }

  // De-duplicate by id, keeping the freshest revision.
  const byId = new Map<string, Task>()
  for (const task of tasks) {
    const prev = byId.get(task.id)
    if (preferTask(task, prev)) byId.set(task.id, task)
  }

  const pruned = pruneTombstones(tombstones)

  const shivamMood =
    isRecord(raw.shivamMood) && typeof raw.shivamMood.emoji === 'string' && typeof raw.shivamMood.updatedAt === 'number'
      ? { emoji: raw.shivamMood.emoji, updatedAt: raw.shivamMood.updatedAt }
      : undefined

  const noorMood =
    isRecord(raw.noorMood) && typeof raw.noorMood.emoji === 'string' && typeof raw.noorMood.updatedAt === 'number'
      ? { emoji: raw.noorMood.emoji, updatedAt: raw.noorMood.updatedAt }
      : undefined

  const sharedScratchpad =
    isRecord(raw.sharedScratchpad) &&
    typeof raw.sharedScratchpad.text === 'string' &&
    typeof raw.sharedScratchpad.updatedAt === 'number'
      ? { text: raw.sharedScratchpad.text, updatedAt: raw.sharedScratchpad.updatedAt }
      : undefined

  const lastNudge =
    isRecord(raw.lastNudge) && raw.lastNudge.id !== undefined && typeof raw.lastNudge.from === 'string'
      ? {
          id: raw.lastNudge.id as string | number,
          from: raw.lastNudge.from,
          kind: (raw.lastNudge.kind as any) || 'boost',
          icon: typeof raw.lastNudge.icon === 'string' ? raw.lastNudge.icon : undefined,
          at: typeof raw.lastNudge.at === 'number' ? raw.lastNudge.at : Date.now(),
        }
      : undefined

  return {
    version: STATE_VERSION,
    tasks: [...byId.values()].map((task) => (isDeleted(task, pruned) ? { ...task, deleted: true } : task)),
    nudges,
    tombstones: pruned,
    shivamMood,
    noorMood,
    sharedScratchpad,
    lastNudge,
  }
}

export function pruneTombstones(tombstones: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(tombstones)) {
    if (value >= cutoff) out[key] = value
  }
  return out
}

export function isDeleted(task: Task, tombstones: Record<string, number>): boolean {
  if (task.deleted === true) return true
  const at = tombstones[task.id]
  return typeof at === 'number' && at >= task.updatedAt
}

export function loadState(): OrbitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return sanitizeState(JSON.parse(raw))
  } catch (err) {
    console.warn('[syncorbit] state read failed, starting clean', err)
    return emptyState()
  }
}

export function saveState(state: OrbitState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[syncorbit] state write failed', err)
  }
}

/**
 * Merge two replicas deterministically (last-write-wins per task + tombstones).
 *
 * Returns the original `a` reference when the remote replica adds nothing. That
 * keeps high-frequency polling from re-rendering the entire app every tick.
 */
export function mergeStates(a: OrbitState, b: OrbitState): OrbitState {
  let changed = false
  const aPruned = pruneTombstones(a.tombstones)
  const tombstones = { ...aPruned }
  for (const [key, value] of Object.entries(b.tombstones)) {
    const next = Math.max(tombstones[key] ?? 0, value)
    if (next > (tombstones[key] ?? 0)) {
      tombstones[key] = next
      changed = true
    }
  }
  const pruned = pruneTombstones(tombstones)
  if (Object.keys(pruned).length !== Object.keys(aPruned).length) changed = true

  const byId = new Map<string, Task>(a.tasks.map((task) => [task.id, task]))
  for (const task of b.tasks) {
    const prev = byId.get(task.id)
    if (!prev) {
      byId.set(task.id, task)
      changed = true
    } else if (preferTask(task, prev)) {
      byId.set(task.id, task)
      changed = true
    }
  }

  // Ensure deleted tasks from tombstones stay marked
  for (const [id, task] of byId.entries()) {
    if (isDeleted(task, pruned) && !task.deleted) {
      byId.set(id, { ...task, deleted: true })
      changed = true
    }
  }

  const nudges = new Map<string, NudgeEvent>(a.nudges.map((nudge) => [nudge.id, nudge]))
  for (const nudge of b.nudges) {
    if (!nudges.has(nudge.id)) {
      nudges.set(nudge.id, nudge)
      changed = true
    }
  }

  const pickMood = (
    x?: OrbitState['shivamMood'],
    y?: OrbitState['shivamMood'],
  ): OrbitState['shivamMood'] => {
    if (!x) return y
    if (!y) return x
    if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt ? x : y
    return x.emoji >= y.emoji ? x : y
  }

  const pickScratchpad = (
    x?: OrbitState['sharedScratchpad'],
    y?: OrbitState['sharedScratchpad'],
  ): OrbitState['sharedScratchpad'] => {
    if (!x) return y
    if (!y) return x
    if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt ? x : y
    return x.text >= y.text ? x : y
  }

  const pickNudge = (x?: OrbitState['lastNudge'], y?: OrbitState['lastNudge']) => {
    if (!x) return y
    if (!y) return x
    if (x.at !== y.at) return x.at > y.at ? x : y
    const xKey = `${x.kind}|${x.from}|${x.icon ?? ''}|${String(x.id)}`
    const yKey = `${y.kind}|${y.from}|${y.icon ?? ''}|${String(y.id)}`
    return xKey >= yKey ? x : y
  }

  const shivamMood = pickMood(a.shivamMood, b.shivamMood)
  const noorMood = pickMood(a.noorMood, b.noorMood)
  const sharedScratchpad = pickScratchpad(a.sharedScratchpad, b.sharedScratchpad)
  const lastNudge = pickNudge(a.lastNudge, b.lastNudge)
  if (shivamMood !== a.shivamMood) changed = true
  if (noorMood !== a.noorMood) changed = true
  if (sharedScratchpad !== a.sharedScratchpad) changed = true
  if (lastNudge !== a.lastNudge) changed = true

  if (!changed) return a

  return {
    version: STATE_VERSION,
    tasks: [...byId.values()],
    nudges: [...nudges.values()].sort((x, y) => y.at - x.at).slice(0, NUDGE_LOG_LIMIT),
    tombstones: pruned,
    shivamMood,
    noorMood,
    sharedScratchpad,
    lastNudge,
  }
}

/**
 * Build a compact replica for live delivery: all top-level fields plus only the
 * tasks whose version changed. Receivers merge it into their full local state.
 * This keeps a two-task toggle at a few hundred bytes instead of 45-50 KB.
 */
export function changedState(prev: OrbitState, next: OrbitState): OrbitState {
  const previousTasks = new Map(prev.tasks.map((task) => [task.id, task]))
  const tasks = next.tasks.filter((task) => {
    const before = previousTasks.get(task.id)
    return !before || before.updatedAt !== task.updatedAt
  })
  return { ...next, tasks }
}

/**
 * True when `merged` contains local data that the remote replica did not have.
 * Used to push a reconciliation snapshot after merging an offline/stale peer.
 */
export function hasLocalOnlyChanges(merged: OrbitState, remote: OrbitState): boolean {
  const remoteTasks = new Map(remote.tasks.map((task) => [task.id, task]))
  for (const task of merged.tasks) {
    const other = remoteTasks.get(task.id)
    if (!other) return true
    if (task.updatedAt !== other.updatedAt) {
      if (task.updatedAt > other.updatedAt) return true
    } else if (taskRank(task) !== taskRank(other) && preferTask(task, other)) {
      return true
    }
    if (task.deleted && !other.deleted) return true
  }

  for (const [id, at] of Object.entries(merged.tombstones)) {
    if ((remote.tombstones[id] ?? 0) < at) return true
  }

  const remoteNudges = new Set(remote.nudges.map((nudge) => nudge.id))
  if (merged.nudges.some((nudge) => !remoteNudges.has(nudge.id))) return true

  const moodWins = (x?: OrbitState['shivamMood'], y?: OrbitState['shivamMood']) => {
    if (!x) return false
    if (!y) return true
    if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt
    return x.emoji !== y.emoji && x.emoji >= y.emoji
  }
  if (moodWins(merged.shivamMood, remote.shivamMood)) return true
  if (moodWins(merged.noorMood, remote.noorMood)) return true

  const scratchpadWins = (x?: OrbitState['sharedScratchpad'], y?: OrbitState['sharedScratchpad']) => {
    if (!x) return false
    if (!y) return true
    if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt
    return x.text !== y.text && x.text >= y.text
  }
  if (scratchpadWins(merged.sharedScratchpad, remote.sharedScratchpad)) return true

  if (merged.lastNudge && !remote.lastNudge) return true
  if (merged.lastNudge && remote.lastNudge) {
    if (merged.lastNudge.at !== remote.lastNudge.at) return merged.lastNudge.at > remote.lastNudge.at
    const mergedKey = `${merged.lastNudge.kind}|${merged.lastNudge.from}|${merged.lastNudge.icon ?? ''}|${String(merged.lastNudge.id)}`
    const remoteKey = `${remote.lastNudge.kind}|${remote.lastNudge.from}|${remote.lastNudge.icon ?? ''}|${String(remote.lastNudge.id)}`
    if (mergedKey !== remoteKey && mergedKey >= remoteKey) return true
  }

  return false
}

/* ---------------------------- identity & firebase ---------------------------- */

export function getUserIdentity(): Person | null {
  try {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const userParam = urlParams.get('user')?.toLowerCase()
      if (userParam === 'shivam' || userParam === 'noor') {
        localStorage.setItem(USER_IDENTITY_KEY, userParam)
        return userParam as Person
      }
    }
    const stored = localStorage.getItem(USER_IDENTITY_KEY)
    if (stored === 'shivam' || stored === 'noor') return stored as Person
    return null
  } catch {
    return null
  }
}

export function setUserIdentity(person: Person): void {
  try {
    localStorage.setItem(USER_IDENTITY_KEY, person)
  } catch (err) {
    console.warn('[syncorbit] failed to save identity', err)
  }
}

export function getFirebaseDbUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const dbParam = urlParams.get('db')
      if (dbParam) {
        const decoded = decodeURIComponent(dbParam)
        localStorage.setItem(FIREBASE_URL_KEY, decoded)
        return decoded
      }
    }
    const envUrl = (import.meta as any).env?.VITE_FIREBASE_DB_URL
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim()
    const stored = localStorage.getItem(FIREBASE_URL_KEY)
    return stored ? stored.trim() : ''
  } catch {
    return ''
  }
}

export function setFirebaseDbUrl(url: string): void {
  try {
    localStorage.setItem(FIREBASE_URL_KEY, url.trim())
  } catch (err) {
    console.warn('[syncorbit] failed to save firebase url', err)
  }
}

export {
  getUserIdentity as getCurrentUser,
  setUserIdentity as saveCurrentUser,
  getFirebaseDbUrl as getFirebaseUrl,
  setFirebaseDbUrl as saveFirebaseUrl,
}

/* ---------------------------- derived helpers ---------------------------- */

export function tasksForDate(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => task.date === date)
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1
    if (a.time && !b.time) return -1
    if (!a.time && b.time) return 1
    return a.createdAt - b.createdAt
  })
}

export function hasCompleted(tasks: Task[], date: string): boolean {
  return tasks.some((task) => task.date === date && task.done)
}

/** Every ISO date that has at least one completed task. */
export function activeDates(tasks: Task[]): string[] {
  const set = new Set<string>()
  for (const task of tasks) if (task.done) set.add(task.date)
  return [...set].sort((a, b) => (a < b ? -1 : 1))
}

/**
 * A day counts toward the couple's streak when either partner completed at
 * least one task. Today is only required to be active if it already is —
 * so an in-progress day never appears to break the run.
 */
export function computeStreak(tasks: Task[]): { current: number; best: number; activeDates: string[] } {
  const dates = activeDates(tasks)
  if (dates.length === 0) return { current: 0, best: 0, activeDates: dates }

  let best = 1
  let run = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = fromISODate(dates[i - 1]).getTime()
    const curr = fromISODate(dates[i]).getTime()
    const gap = Math.round((curr - prev) / 86_400_000)
    run = gap === 1 ? run + 1 : 1
    if (run > best) best = run
  }

  const set = new Set(dates)
  const today = todayISO()
  let cursor = set.has(today) ? today : shiftISO(today, -1)
  let current = 0
  while (set.has(cursor)) {
    current += 1
    cursor = shiftISO(cursor, -1)
  }

  return { current, best: Math.max(best, current), activeDates: dates }
}

function shiftISO(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
