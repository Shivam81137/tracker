import { PARTNERS } from './constants'
import { addDays, todayISO } from './date'
import type { Task } from './types'

/**
 * A dependency-free iCalendar (.ics) feed for upcoming orbit tasks.
 *
 * Google Calendar (and Apple Calendar) can import the downloaded file, which
 * keeps the "Sync GCal" action genuinely useful without pretending to hold an
 * OAuth token we do not have.
 */

const pad = (n: number) => String(n).padStart(2, '0')

function compactDate(iso: string): string {
  return iso.replace(/-/g, '')
}

function stamp(now: number): string {
  const d = new Date(now)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function timeToken(hhmm: string): { dateSuffix: string; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number)
  const hours = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0
  const minutes = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0
  return { dateSuffix: `${pad(hours)}${pad(minutes)}00`, minutes: hours * 60 + minutes }
}

function eventFor(task: Task, now: number): string {
  const owner = PARTNERS[task.owner]
  const summary = escapeText(`[${owner.name}] ${task.title}`)
  const description = escapeText(`SyncOrbit · ${owner.name}'s orbit${task.priority ? ` · ${task.priority} priority` : ''}`)
  const status = task.done ? 'COMPLETED' : 'CONFIRMED'
  const day = compactDate(task.date)

  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(task.id)}@syncorbit`,
    `DTSTAMP:${stamp(now)}`,
  ]

  if (task.time) {
    const start = timeToken(task.time)
    const endMinutes = start.minutes + 30
    const endDate = endMinutes >= 1440 ? addDays(task.date, 1) : task.date
    const endTime = `${pad(Math.floor((endMinutes % 1440) / 60))}${pad(endMinutes % 60)}00`
    lines.push(`DTSTART:${day}${start.dateSuffix}`)
    lines.push(`DTEND:${compactDate(endDate)}${endTime}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`)
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(task.date, 1))}`)
  }

  lines.push(`SUMMARY:${summary}`)
  lines.push(`DESCRIPTION:${description}`)
  lines.push(`STATUS:${status}`)
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

/** Builds a standards-compliant calendar for every task from today onward. */
export function buildCalendarICS(tasks: Task[], now = Date.now()): string {
  const today = todayISO()
  const upcoming = tasks
    .filter((task) => !task.deleted && task.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time ?? '99:99').localeCompare(b.time ?? '99:99') : a.date.localeCompare(b.date)))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SyncOrbit//Daily Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SyncOrbit — Shivam & Noor',
    'X-WR-CALDESC:Daily sync for two.',
    ...upcoming.map((task) => eventFor(task, now)),
    'END:VCALENDAR',
  ]

  return `${lines.join('\r\n')}\r\n`
}

/**
 * Generates and downloads the `.ics` feed.
 *
 * @returns The number of upcoming events included in the file.
 */
export function downloadCalendarFeed(tasks: Task[]): number {
  if (typeof document === 'undefined') return 0

  const today = todayISO()
  const count = tasks.filter((task) => !task.deleted && task.date >= today).length
  if (count === 0) return 0

  const blob = new Blob([buildCalendarICS(tasks)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `syncorbit-${today}.ics`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return count
}
