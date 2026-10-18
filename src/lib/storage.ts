import { NUDGE_LOG_LIMIT, STORAGE_KEY, TOMBSTONE_TTL_MS, DEVICE_KEY } from './constants'
import { fromISODate, todayISO } from './date'
import type { NudgeEvent, OrbitState, Priority, Task } from './types'

export const STATE_VERSION = 1

export function emptyState(): OrbitState {
  return { version: STATE_VERSION, tasks: [], nudges: [], tombstones: {} }
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
  const done = raw.done === true
  const time = typeof raw.time === 'string' && TIME_RE.test(raw.time) ? raw.time : undefined
  const priority = PRIORITY_SET.has(raw.priority as Priority) ? (raw.priority as Priority) : 'chill'

  return {
    id,
    date,
    owner,
    title: trimmed,
    done,
    time,
    priority,
    cheers: typeof raw.cheers === 'number' && Number.isFinite(raw.cheers) ? Math.max(0, Math.floor(raw.cheers)) : 0,
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
  return { id, kind, at, by }
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
    if (!prev || task.updatedAt >= prev.updatedAt) byId.set(task.id, task)
  }

  const pruned = pruneTombstones(tombstones)

  return {
    version: STATE_VERSION,
    tasks: [...byId.values()].filter((task) => !isDeleted(task, pruned)),
    nudges,
    tombstones: pruned,
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

/** Merge two replicas deterministically (last-write-wins per task + tombstones). */
export function mergeStates(a: OrbitState, b: OrbitState): OrbitState {
  const tombstones = { ...a.tombstones }
  for (const [key, value] of Object.entries(b.tombstones)) {
    tombstones[key] = Math.max(tombstones[key] ?? 0, value)
  }
  const pruned = pruneTombstones(tombstones)

  const byId = new Map<string, Task>()
  for (const task of [...a.tasks, ...b.tasks]) {
    const prev = byId.get(task.id)
    if (!prev || task.updatedAt > prev.updatedAt) byId.set(task.id, task)
  }

  const nudges = new Map<string, NudgeEvent>()
  for (const nudge of [...a.nudges, ...b.nudges]) nudges.set(nudge.id, nudge)

  return {
    version: STATE_VERSION,
    tasks: [...byId.values()].filter((task) => !isDeleted(task, pruned)),
    nudges: [...nudges.values()].sort((x, y) => y.at - x.at).slice(0, NUDGE_LOG_LIMIT),
    tombstones: pruned,
  }
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
