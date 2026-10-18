import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { playChime, playFanfare, primeAudio, setSoundEnabled } from './audio'
import { ACCENT_HEX, NUDGE_LOG_LIMIT, NUDGE_MAP, SOUND_KEY } from './constants'
import { addDays, isToday, todayISO } from './date'
import { burstFromElement, fireBurst } from './fx'
import { useLiveSync } from './live'
import { OrbitContext, type OrbitApi } from './orbit-context'
import { dayProgress } from './progress'
import { computeStreak, getDeviceId, loadState, mergeStates, saveState, sortTasks, uid } from './storage'
import type { NewTaskInput, NudgeKind, OrbitState, Task, Toast } from './types'

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

export function OrbitProvider({ children }: { children: ReactNode }) {
  // State is restored synchronously so the first paint already has real data.
  const [state, setState] = useState<OrbitState>(loadState)
  const [viewDate, setViewDate] = useState<string>(() => todayISO())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [soundOn, setSoundOn] = useState<boolean>(initialSound)
  const [deviceId] = useState<string>(getDeviceId)

  const stateRef = useRef(state)
  const timers = useRef(new Map<string, number>())
  const commitRef = useRef<(updater: (prev: OrbitState) => OrbitState, opts?: CommitOptions) => void>(() => {})
  const remoteNudgeRef = useRef<(kind: NudgeKind) => void>(() => {})

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
    onState: useCallback((remote: OrbitState) => {
      commitRef.current((prev) => mergeStates(prev, remote), { broadcast: false, persist: true })
    }, []),
    onNudge: useCallback((kind: NudgeKind) => remoteNudgeRef.current(kind), []),
  })

  const broadcastStateRef = useRef(live.broadcastState)
  useEffect(() => {
    broadcastStateRef.current = live.broadcastState
  }, [live.broadcastState])

  /* --------------------------------- commit -------------------------------- */

  const commit = useCallback((updater: (prev: OrbitState) => OrbitState, opts: CommitOptions = {}) => {
    const next = updater(stateRef.current)
    if (next === stateRef.current) return
    stateRef.current = next
    setState(next)
    if (opts.persist !== false) saveState(next)
    if (opts.broadcast !== false) broadcastStateRef.current(next)
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
        const now = Date.now()
        const mirrors = target.linkId
          ? prev.tasks.filter((task) => task.linkId === target.linkId && task.done !== nextDone)
          : []

        const patched = new Map<string, Task>()
        for (const task of [target, ...mirrors]) {
          patched.set(task.id, {
            ...task,
            done: nextDone,
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
        const now = Date.now()
        const tombstones = { ...prev.tombstones }
        for (const key of ids) tombstones[key] = now
        return { ...prev, tasks: prev.tasks.filter((task) => !ids.includes(task.id)), tombstones }
      })
    },
    [commit],
  )

  const cheerTask = useCallback(
    (id: string) => {
      commit((prev) => {
        if (!prev.tasks.some((task) => task.id === id)) return prev
        return {
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === id ? { ...task, cheers: task.cheers + 1, updatedAt: Date.now() } : task,
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
      const now = Date.now()
      const tasks = prev.tasks.map((task) => {
        const shouldMove = viewingToday ? task.date < today : task.date === from && from !== today
        if (!shouldMove || task.done) return task
        moved += 1
        return { ...task, date: today, rolledFrom: task.rolledFrom ?? task.date, updatedAt: now }
      })
      return moved === 0 ? prev : { ...prev, tasks }
    })
  }, [commit, viewDate])

  /* --------------------------------- nudges -------------------------------- */

  const showNudge = useCallback(
    (kind: NudgeKind, variant: 'sent' | 'received') => {
      const meta = NUDGE_MAP[kind]
      pushToast({
        title: variant === 'sent' ? `${meta.emoji} ${meta.label} sent` : `${meta.emoji} ${meta.label} received`,
        body: variant === 'sent' ? 'Beamed across the live channel.' : `${meta.verb} — right back at you.`,
        accent: 'sync',
        icon: meta.emoji,
      })
    },
    [pushToast],
  )

  const sendNudge = useCallback(
    (kind: NudgeKind, anchor?: Element | null) => {
      primeAudio()
      playChime(NUDGE_MAP[kind].root)
      live.broadcastNudge(kind)
      // Authored once here; peers read it from the state replica instead of
      // writing their own entry, so signals never echo or double count.
      commit((prev) => ({
        ...prev,
        nudges: [{ id: uid(), kind, at: Date.now(), by: deviceId }, ...prev.nudges].slice(0, NUDGE_LOG_LIMIT),
      }))
      showNudge(kind, 'sent')
      burstFromElement(anchor, [ACCENT_HEX.sync, '#FFB199', '#00F2FE'], {
        count: 34,
        power: 7,
        style: 'spark',
      })
    },
    [commit, deviceId, live, showNudge],
  )

  const receiveNudge = useCallback(
    (kind: NudgeKind) => {
      primeAudio()
      playChime(NUDGE_MAP[kind].root * 1.5)
      showNudge(kind, 'received')
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

  /* -------------------------------- derived -------------------------------- */

  const viewProgress = useMemo(() => dayProgress(state.tasks, viewDate), [state.tasks, viewDate])
  const todayProgress = useMemo(() => dayProgress(state.tasks, todayISO()), [state.tasks])
  const streak = useMemo(() => computeStreak(state.tasks), [state.tasks])
  const viewTasks = useMemo(
    () => sortTasks(state.tasks.filter((task) => task.date === viewDate)),
    [state.tasks, viewDate],
  )

  const rolloverCount = useMemo(() => {
    const today = todayISO()
    return state.tasks.filter((task) => {
      if (task.done) return false
      if (isToday(viewDate)) return task.date < today
      return task.date === viewDate && viewDate !== today
    }).length
  }, [state.tasks, viewDate])

  const lastNudge = useMemo(() => {
    const latest = state.nudges[0]
    if (!latest) return null
    return {
      kind: latest.kind,
      at: latest.at,
      source: latest.by === deviceId ? ('self' as const) : ('peer' as const),
    }
  }, [state.nudges, deviceId])

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
      allTasks: state.tasks,
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
      viewDate,
      goToToday,
      shiftDate,
      viewTasks,
      viewProgress,
      todayProgress,
      streak,
      rolloverCount,
      lastNudge,
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
