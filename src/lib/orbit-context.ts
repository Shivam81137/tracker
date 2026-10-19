import { createContext, useContext } from 'react'
import type { LiveSync } from './live'
import type {
  DayProgress,
  NewTaskInput,
  NudgeKind,
  OrbitState,
  Person,
  StreakInfo,
  Task,
  Toast,
} from './types'

/**
 * The single object every component reads through `useOrbit()`.
 *
 * It is deliberately flat: data, mutations, and ephemeral UI all live in one
 * memoised value so a render never has to reach into two providers for one
 * piece of truth.
 */
export interface OrbitApi {
  /* data */
  state: OrbitState
  allTasks: Task[]
  viewDate: string
  setViewDate: (date: string) => void
  goToToday: () => void
  shiftDate: (days: number) => void
  viewTasks: Task[]
  viewProgress: DayProgress
  todayProgress: DayProgress
  streak: StreakInfo
  rolloverCount: number
  lastNudge: { kind: NudgeKind; at: number; source: 'self' | 'peer'; icon?: string } | null

  /* identity & cloud */
  currentUser: Person | null
  setCurrentUser: (person: Person) => void
  firebaseDbUrl: string
  setFirebaseUrl: (url: string) => void
  setMood: (person: Person, emoji: string) => void
  setScratchpad: (text: string) => void

  /* mutations */
  addTasks: (input: NewTaskInput) => number
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  cheerTask: (id: string) => void
  rollover: () => void
  sendNudge: (kind: NudgeKind, anchor?: Element | null) => void

  /* ui */
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id' | 'ttl'> & { id?: string; ttl?: number }) => void
  dismissToast: (id: string) => void
  soundOn: boolean
  toggleSound: () => void
  live: LiveSync
}

/**
 * Kept in its own module (alongside the hook) so `<OrbitProvider>` can live in
 * a component file without breaking React Fast Refresh.
 */
export const OrbitContext = createContext<OrbitApi | null>(null)

export function useOrbit(): OrbitApi {
  const ctx = useContext(OrbitContext)
  if (!ctx) throw new Error('useOrbit must be used inside <OrbitProvider>')
  return ctx
}
