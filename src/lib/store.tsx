import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { playChime, playFanfare, primeAudio, setSoundEnabled } from './audio'
import { ACCENT_HEX, NUDGE_LOG_LIMIT, NUDGE_MAP, SOUND_KEY } from './constants'
import { addDays, isToday, todayISO } from './date'
import { burstFromElement, fireBurst } from './fx'
import { useLiveSync } from './live'
import { getPresenceEngine } from '../services/presence'
import { OrbitContext, type OrbitApi } from './orbit-context'
import { dayProgress } from './progress'
import { changedState, computeStreak, getCurrentUser, getDeviceId, getFirebaseUrl, hasLocalOnlyChanges, isBlankState, loadState, mergeStates, saveCurrentUser, saveFirebaseUrl, saveState, sortTasks, uid } from './storage'
import type { NewTaskInput, NudgeKind, OrbitState, Person, Task, Toast } from './types'

interface CommitOptions {
  broadcast?: boolean
  persist?: boolean
}

function initialSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Client clocks can drift by seconds. A mutation must still be newer than the
 * replica it replaced, otherwise the partner's merge would ignore it.
 */
function nextStamp(previous?: number): number {
  return Math.max(Date.now(), (previous ?? 0) + 1)
}

export function OrbitProvider({ children }: { children: ReactNode }) {
  // State is restored synchronously so the first paint already has real data.
  const [state, setState] = useState<OrbitState>(loadState)
  const [viewDate, setViewDate] = useState<string>(() => todayISO())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [soundOn, setSoundOn] = useState<boolean>(initialSound)
  const [deviceId] = useState<string>(getDeviceId)
  const [currentUser, setCurrentUserState] = useState<Person | null>(getCurrentUser)
  const [firebaseDbUrl, setFirebaseDbUrlState] = useState<string>(getFirebaseUrl)

  const stateRef = useRef(state)
  const timers = useRef(new Map<string, number>())
  const commitRef = useRef<(updater: (prev: OrbitState) => OrbitState, opts?: CommitOptions) => void>(() => {})
  const remoteNudgeRef = useRef<(kind: NudgeKind, from?: string, icon?: string) => void>(() => {})
  const broadcastStateRef = useRef<(next: OrbitState, partial?: OrbitState) => void>(() => {})

  const setCurrentUser = useCallback((person: Person) => {
    saveCurrentUser(person)
    setCurrentUserState(person)
    // Keep the presence heartbeat in step with the identity switcher. The
    // engine is created by the live-sync effect, so this is a best-effort
    // handoff after first interaction.
    try {
      getPresenceEngine().updateIdentity(person)
    } catch {
      /* engine not mounted yet */
    }
  }, [])

  const updateFirebaseUrlRef = useRef<(url: string) => void>(() => {})

  const setFirebaseUrl = useCallback((url: string) => {
    saveFirebaseUrl(url)
    setFirebaseDbUrlState(url)
    updateFirebaseUrlRef.current(url)
  }, [])

  /* --------------------------------- toasts -------------------------------- */

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (toast: Omit<Toast, 'id' | 'ttl'> & { id?: string; ttl?: number }) => {
      const id = toast.id ?? uid()
      const next: Toast = {
        id,
        title: toast.title,
        body: toast.body,
        accent: toast.accent,
        icon: toast.icon,
        ttl: toast.ttl ?? 4200,
      }
      setToasts((prev) => [...prev.filter((item) => item.id !== id), next].slice(-4))
      const existing = timers.current.get(id)
      if (existing !== undefined) window.clearTimeout(existing)
      timers.current.set(
        id,
        window.setTimeout(() => dismissToast(id), next.ttl),
      )
    },
    [dismissToast],
  )

  /* ------------------------------- live sync ------------------------------- */

  const live = useLiveSync({
    onState: useCallback(
      (
        remote: OrbitState,
        meta?: { source?: 'local' | 'mqtt' | 'firebase' | 'http'; partial?: boolean },
      ) => {
        const prev = stateRef.current
        const merged = mergeStates(prev, remote)
        const locallyBlank = isBlankState(prev)
        const needsReconcile = Boolean(
          meta?.source &&
            meta.source !== 'local' &&
            !meta.partial &&
            hasLocalOnlyChanges(merged, remote),
        )
        // First contact on a fresh browser: we just received the partner's
        // board. Seed the realtime channel so a slow MQTT snapshot cannot
        // leave the cloud empty after we hydrate from Firebase/HTTP.
        const shouldSeed = Boolean(
          meta?.source &&
            meta.source !== 'mqtt' &&
            !meta.partial &&
            locallyBlank &&
            !isBlankState(merged),
        )

        if (merged !== prev) {
          commitRef.current(() => merged, { broadcast: false, persist: true })
        }

        // If the peer was stale and we hold newer local edits, push the union
        // back even when the merge itself was a no-op. This is what makes
        // reconnects/offline edits converge instead of waiting for a new edit.
        if (needsReconcile || shouldSeed) {
          window.setTimeout(() => {
            if (stateRef.current === merged) broadcastStateRef.current(merged)
          }, 120)
        }
      },
      [],
    ),
    onNudge: useCallback((kind: NudgeKind, from?: string, icon?: string) => {
      remoteNudgeRef.current(kind, from, icon)
    }, []),
  })

  useEffect(() => {
    updateFirebaseUrlRef.current = live.updateFirebaseUrl
  }, [live.updateFirebaseUrl])

  useEffect(() => {
    broadcastStateRef.current = live.broadcastState
  }, [live.broadcastState])

  // Seed the cloud with the restored local replica after the realtime channels
  // have had a moment to deliver their retained snapshot. This catches edits
  // made while the app was closed without clobbering newer partner data.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = stateRef.current
      // A fresh device starts blank. Publishing that before the retained
      // snapshot arrives would erase the partner's board; wait for hydration
      // or for the first local edit instead.
      if (!isBlankState(current)) broadcastStateRef.current(current)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [])

  /* --------------------------------- commit -------------------------------- */

  const commit = useCallback((updater: (prev: OrbitState) => OrbitState, opts: CommitOptions = {}) => {
    const prev = stateRef.current
    const next = updater(prev)
    if (next === prev) return
    stateRef.current = next
    setState(next)
    if (opts.persist !== false) saveState(next)
    if (opts.broadcast !== false) {
      broadcastStateRef.current(next, changedState(prev, next))
    }
  }, [])

  // Assigned in an effect: refs must never be written during render.
  useEffect(() => {
    commitRef.current = commit
  }, [commit])

  /* ------------------- transport fallback + timer lifecycle ---------------- */

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'syncorbit.state.v1' || !event.newValue) return
      try {
        const incoming = JSON.parse(event.newValue) as OrbitState
        commitRef.current((prev) => mergeStates(prev, incoming), { broadcast: false, persist: false })
      } catch {
        /* ignore malformed replica */
      }
    }
    window.addEventListener('storage', onStorage)

    const pending = timers.current
    return () => {
      window.removeEventListener('storage', onStorage)
      for (const timer of pending.values()) window.clearTimeout(timer)
      pending.clear()
    }
  }, [])

  /* --------------------------------- sound --------------------------------- */

  useEffect(() => {
    setSoundEnabled(soundOn)
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off')
    } catch {
      /* storage disabled */
    }
  }, [soundOn])

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      if (!prev) {
        primeAudio()
        playChime(NUDGE_MAP.proud.root)
      }
      return !prev
    })
  }, [])

  /* -------------------------------- mutations ------------------------------ */

  const addTasks = useCallback(
    (input: NewTaskInput): number => {
      const title = input.title.trim().slice(0, 160)
      if (!title) return 0
      const now = Date.now()
      const owners: Task['owner'][] = input.assignee === 'both' ? ['shivam', 'noor'] : [input.assignee]
      const linkId = input.assignee === 'both' ? uid() : undefined
      const created: Task[] = owners.map((owner, index) => ({
        id: uid(),
        date: input.date,
        owner,
        title,
        done: false,
        time: input.time,
        priority: input.priority,
        cheers: 0,
        linkId,
        createdAt: now + index,
        updatedAt: now + index,
      }))

      commit((prev) => {
        const tombstones = { ...prev.tombstones }
        for (const task of created) delete tombstones[task.id]
        return { ...prev, tasks: [...prev.tasks, ...created], tombstones }
      })
      return created.length
    },
    [commit],
  )

  /** Toggle a task, keeping `both`-assigned mirrors in lock-step. */
  const toggleTask = useCallback(
    (id: string) => {
      commit((prev) => {
        const target = prev.tasks.find((task) => task.id === id)
        if (!target) return prev
        const nextDone = !target.done
        const mirrors = target.linkId
          ? prev.tasks.filter((task) => task.linkId === target.linkId && task.done !== nextDone)
          : []
        const now = nextStamp(Math.max(target.updatedAt, ...mirrors.map((task) => task.updatedAt)))

        const patched = new Map<string, Task>()
        for (const task of [target, ...mirrors]) {
          patched.set(task.id, {
            ...task,
            done: nextDone,
            completed: nextDone,
            completedAt: nextDone ? now : undefined,
            updatedAt: now,
          })
        }

        return { ...prev, tasks: prev.tasks.map((task) => patched.get(task.id) ?? task) }
      })
    },
    [commit],
  )

  const deleteTask = useCallback(
    (id: string) => {
      commit((prev) => {
        const target = prev.tasks.find((task) => task.id === id)
        if (!target) return prev
        const ids = target.linkId
          ? prev.tasks.filter((task) => task.linkId === target.linkId).map((task) => task.id)
          : [id]
        const targets = prev.tasks.filter((task) => ids.includes(task.id))
        const now = nextStamp(Math.max(...targets.map((task) => task.updatedAt)))
        const tombstones = { ...prev.tombstones }
        for (const key of ids) tombstones[key] = now
        // Soft delete the task by flagging deleted: true, setting updatedAt, and updating tombstones
        const updatedTasks = prev.tasks.map((task) =>
          ids.includes(task.id) ? { ...task, deleted: true, updatedAt: now } : task,
        )
        return { ...prev, tasks: updatedTasks, tombstones }
      })
    },
    [commit],
  )

  const cheerTask = useCallback(
    (id: string) => {
      commit((prev) => {
        const target = prev.tasks.find((task) => task.id === id)
        if (!target) return prev
        const now = nextStamp(target.updatedAt)
        return {
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === id ? { ...task, cheers: task.cheers + 1, cheered: true, updatedAt: now } : task,
          ),
        }
      })
    },
    [commit],
  )

  /**
   * Migrate unfinished work onto today. Viewing today pulls every overdue task;
   * inspecting a past day pulls just that day's leftovers.
   */
  const rollover = useCallback(() => {
    const today = todayISO()
    const from = viewDate
    commit((prev) => {
      const viewingToday = isToday(from)
      let moved = 0
      const base = Date.now()
      const tasks = prev.tasks.map((task) => {
        const shouldMove = viewingToday ? task.date < today : task.date === from && from !== today
        if (!shouldMove || task.done) return task
        moved += 1
        return {
          ...task,
          date: today,
          rolledFrom: task.rolledFrom ?? task.date,
          updatedAt: Math.max(base, task.updatedAt + 1),
        }
      })
      return moved === 0 ? prev : { ...prev, tasks }
    })
  }, [commit, viewDate])

  /* --------------------------------- nudges -------------------------------- */

  const showNudge = useCallback(
    (kind: NudgeKind, variant: 'sent' | 'received', from?: string, icon?: string) => {
      const meta = NUDGE_MAP[kind]
      const senderDisplay = from ? `${from} sent ${meta.label}` : `${meta.label} received`
      pushToast({
        title: variant === 'sent' ? `${icon || meta.emoji} ${meta.label} sent` : `${icon || meta.emoji} ${senderDisplay}`,
        body: variant === 'sent' ? 'Beamed across the live cloud channel.' : `${meta.verb} — right back at you.`,
        accent: 'sync',
        icon: icon || meta.emoji,
      })
    },
    [pushToast],
  )

  const sendNudge = useCallback(
    (kind: NudgeKind, anchor?: Element | null) => {
      primeAudio()
      playChime(NUDGE_MAP[kind].root)
      const senderName = currentUser ? (currentUser === 'shivam' ? 'Shivam' : 'Noor') : 'Partner'
      const icon = NUDGE_MAP[kind].emoji
      live.broadcastNudge(kind, senderName, icon)
      commit((prev) => {
        const now = nextStamp(prev.lastNudge?.at)
        return {
          ...prev,
          nudges: [
            { id: uid(), kind, at: now, by: deviceId, from: senderName, icon },
            ...prev.nudges,
          ].slice(0, NUDGE_LOG_LIMIT),
          lastNudge: {
            kind,
            from: senderName,
            to: currentUser === 'shivam' ? 'noor' : 'shivam',
            at: now,
            icon,
          },
        }
      })
      showNudge(kind, 'sent', senderName, icon)
      burstFromElement(anchor, [ACCENT_HEX.sync, '#FFB199', '#00F2FE'], {
        count: 34,
        power: 7,
        style: 'spark',
      })
    },
    [commit, currentUser, deviceId, live, showNudge],
  )

  const receiveNudge = useCallback(
    (kind: NudgeKind, from?: string, icon?: string) => {
      primeAudio()
      playChime(NUDGE_MAP[kind].root * 1.5)
      showNudge(kind, 'received', from, icon)
      fireBurst({
        x: window.innerWidth * (0.2 + Math.random() * 0.6),
        y: window.innerHeight * (0.25 + Math.random() * 0.3),
        colors: [ACCENT_HEX.sync, '#FFB199', '#00F2FE'],
        count: 44,
        power: 8,
        style: 'confetti',
      })
    },
    [showNudge],
  )

  useEffect(() => {
    remoteNudgeRef.current = receiveNudge
  }, [receiveNudge])

  const lastHandledNudgeIdRef = useRef<string | number | undefined>(state.lastNudge?.id)
  useEffect(() => {
    if (!state.lastNudge) return
    if (state.lastNudge.id && state.lastNudge.id !== lastHandledNudgeIdRef.current) {
      lastHandledNudgeIdRef.current = state.lastNudge.id
      const fromLower = state.lastNudge.from.toLowerCase()
      if (currentUser && fromLower === currentUser.toLowerCase()) {
        return
      }
      const target = state.lastNudge
      const timer = window.setTimeout(() => {
        receiveNudge(target.kind, target.from, target.icon)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [state.lastNudge, currentUser, receiveNudge])

  const setMood = useCallback(
    (person: Person, emoji: string) => {
      commit((prev) => {
        const key = person === 'shivam' ? 'shivamMood' : 'noorMood'
        const now = nextStamp(prev[key]?.updatedAt)
        return { ...prev, [key]: { emoji, updatedAt: now } }
      })
    },
    [commit],
  )

  const setScratchpad = useCallback(
    (text: string) => {
      commit((prev) => ({
        ...prev,
        sharedScratchpad: { text, updatedAt: nextStamp(prev.sharedScratchpad?.updatedAt) },
      }))
    },
    [commit],
  )

  /* -------------------------------- derived -------------------------------- */

  const activeTasks = useMemo(() => state.tasks.filter((task) => !task.deleted), [state.tasks])
  const viewProgress = useMemo(() => dayProgress(activeTasks, viewDate), [activeTasks, viewDate])
  const todayProgress = useMemo(() => dayProgress(activeTasks, todayISO()), [activeTasks])
  const streak = useMemo(() => computeStreak(activeTasks), [activeTasks])
  const viewTasks = useMemo(
    () => sortTasks(activeTasks.filter((task) => task.date === viewDate)),
    [activeTasks, viewDate],
  )

  const rolloverCount = useMemo(() => {
    const today = todayISO()
    return activeTasks.filter((task) => {
      if (task.done) return false
      if (isToday(viewDate)) return task.date < today
      return task.date === viewDate && viewDate !== today
    }).length
  }, [activeTasks, viewDate])

  const lastNudge = useMemo(() => {
    if (state.lastNudge) {
      return {
        kind: state.lastNudge.kind,
        at: state.lastNudge.at,
        source: (currentUser && state.lastNudge.from?.toLowerCase() === currentUser.toLowerCase()) ? ('self' as const) : ('peer' as const),
        icon: state.lastNudge.icon,
      }
    }
    const latest = state.nudges[0]
    if (!latest) return null
    return {
      kind: latest.kind,
      at: latest.at,
      source: latest.by === deviceId ? ('self' as const) : ('peer' as const),
      icon: latest.icon,
    }
  }, [state.lastNudge, state.nudges, currentUser, deviceId])

  /* --------------------------- 100% sync celebration ----------------------- */

  const lastSyncRef = useRef<{ date: string; ratio: number } | null>(null)

  useEffect(() => {
    const ratio = viewProgress.total === 0 ? 0 : viewProgress.sync
    const previous = lastSyncRef.current
    lastSyncRef.current = { date: viewDate, ratio }

    if (viewProgress.total === 0) return
    const wasIncomplete = !previous || previous.date !== viewDate || previous.ratio < 1
    if (ratio === 1 && wasIncomplete) {
      primeAudio()
      playFanfare()
      pushToast({
        id: `sync-${viewDate}`,
        title: '✦ Orbit synced',
        body: isToday(viewDate) ? 'Both boards at 100%. Impeccable.' : `${viewDate} closed at 100%.`,
        accent: 'sync',
        icon: '✦',
        ttl: 6000,
      })
      fireBurst({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.38,
        colors: ['#00F2FE', '#4FACFE', '#FF0844', '#FFB199', '#F59E0B'],
        count: 120,
        power: 11,
        style: 'confetti',
        gravity: 0.16,
      })
    }
  }, [viewProgress.sync, viewProgress.total, viewDate, pushToast])

  /* ---------------------------------- api ---------------------------------- */

  const goToToday = useCallback(() => setViewDate(todayISO()), [])
  const shiftDate = useCallback((days: number) => setViewDate((prev) => addDays(prev, days)), [])

  const api = useMemo<OrbitApi>(
    () => ({
      state,
      allTasks: activeTasks,
      viewDate,
      setViewDate,
      goToToday,
      shiftDate,
      viewTasks,
      viewProgress,
      todayProgress,
      streak,
      rolloverCount,
      lastNudge,
      currentUser,
      setCurrentUser,
      firebaseDbUrl,
      setFirebaseUrl,
      setMood,
      setScratchpad,
      addTasks,
      toggleTask,
      deleteTask,
      cheerTask,
      rollover,
      sendNudge,
      toasts,
      pushToast,
      dismissToast,
      soundOn,
      toggleSound,
      live,
    }),
    [
      state,
      activeTasks,
      viewDate,
      goToToday,
      shiftDate,
      viewTasks,
      viewProgress,
      todayProgress,
      streak,
      rolloverCount,
      lastNudge,
      currentUser,
      setCurrentUser,
      firebaseDbUrl,
      setFirebaseUrl,
      setMood,
      setScratchpad,
      addTasks,
      toggleTask,
      deleteTask,
      cheerTask,
      rollover,
      sendNudge,
      toasts,
      pushToast,
      dismissToast,
      soundOn,
      toggleSound,
      live,
    ],
  )

  return <OrbitContext.Provider value={api}>{children}</OrbitContext.Provider>
}
