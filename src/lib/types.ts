/**
 * SyncOrbit — domain types.
 *
 * Everything the app persists is JSON-serializable and keyed by an ISO date
 * (`YYYY-MM-DD`) so the store stays portable between tabs and devices.
 */

export type Person = 'shivam' | 'noor'

/** `both` creates two mirrored tasks that stay linked in lock-step. */
export type Assignee = Person | 'both'

export type Priority = 'high' | 'med' | 'chill'

export type NudgeKind = 'boost' | 'proud' | 'hydrate' | 'break'

export interface Task {
  id: string
  /** Board date, ISO `YYYY-MM-DD`. */
  date: string
  owner: Person
  title: string
  done: boolean
  /** Optional 24h `HH:mm` reminder slot. */
  time?: string
  priority: Priority
  cheers: number
  /** Mirrored tasks from a `both` assignment share a link id. */
  linkId?: string
  /** Set when the task was rolled forward from an earlier date. */
  rolledFrom?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface NudgeEvent {
  id: string
  kind: NudgeKind
  at: number
  /** Device that authored the signal, so both replicas label it consistently. */
  by: string
}

/** Persisted root document. */
export interface OrbitState {
  version: number
  tasks: Task[]
  nudges: NudgeEvent[]
  /** Delete tombstones (task id -> deletedAt) so cross-tab deletes converge. */
  tombstones: Record<string, number>
}

export type Accent = 'shivam' | 'noor' | 'sync' | 'neutral'

export interface Toast {
  id: string
  title: string
  body?: string
  accent: Accent
  icon?: string
  ttl: number
}

export interface NewTaskInput {
  title: string
  date: string
  assignee: Assignee
  priority: Priority
  time?: string
}

/* ------------------------------ live sync ------------------------------ */

export type SyncMessage =
  | { t: 'state'; from: string; state: OrbitState }
  | { t: 'nudge'; from: string; kind: NudgeKind; at: number }
  | { t: 'ping'; from: string }
  | { t: 'pong'; from: string; to: string }

/* ------------------------------- progress ------------------------------ */

export interface Progress {
  owner: Person
  total: number
  done: number
  /** 0..1 */
  ratio: number
}

export interface DayProgress {
  shivam: Progress
  noor: Progress
  /** Combined completion across both boards, 0..1. */
  sync: number
  total: number
  done: number
}

export interface StreakInfo {
  current: number
  best: number
  /** Dates (ISO) that count toward the streak, ascending. */
  activeDates: string[]
}
