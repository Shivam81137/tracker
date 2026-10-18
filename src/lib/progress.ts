import { PARTNER_ORDER } from './constants'
import type { DayProgress, Person, Progress, Task } from './types'

export function progressFor(tasks: Task[], owner: Person, date: string): Progress {
  let total = 0
  let done = 0
  for (const task of tasks) {
    if (task.owner !== owner || task.date !== date) continue
    total += 1
    if (task.done) done += 1
  }
  return { owner, total, done, ratio: total === 0 ? 0 : done / total }
}

export function dayProgress(tasks: Task[], date: string): DayProgress {
  const perOwner = PARTNER_ORDER.map((owner) => progressFor(tasks, owner, date))
  const total = perOwner.reduce((sum, p) => sum + p.total, 0)
  const done = perOwner.reduce((sum, p) => sum + p.done, 0)
  return {
    shivam: perOwner[0],
    noor: perOwner[1],
    sync: total === 0 ? 0 : done / total,
    total,
    done,
  }
}

/** Percentage integer for display, 0..100. */
export function pct(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100)
}

export function percentLabel(ratio: number): string {
  return `${pct(ratio)}%`
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
