/** Local-calendar date helpers. All keys are ISO `YYYY-MM-DD` in the user's timezone. */

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parses `YYYY-MM-DD` as local midnight (never UTC, so days never shift). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function diffDays(a: string, b: string): number {
  const ms = fromISODate(a).getTime() - fromISODate(b).getTime()
  return Math.round(ms / 86_400_000)
}

export function isPast(iso: string): boolean {
  return diffDays(iso, todayISO()) < 0
}

export function isFuture(iso: string): boolean {
  return diffDays(iso, todayISO()) > 0
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[fromISODate(iso).getDay()]
}

export function dayNumber(iso: string): string {
  return String(fromISODate(iso).getDate())
}

export function monthShort(iso: string): string {
  return MONTH_SHORT[fromISODate(iso).getMonth()]
}

export function monthName(monthIndex: number): string {
  return MONTH_LONG[((monthIndex % 12) + 12) % 12]
}

/** e.g. `SUNDAY · 18 OCTOBER 2026` */
export function formatLong(iso: string): string {
  const d = fromISODate(iso)
  return `${WEEKDAY_SHORT[d.getDay()].toUpperCase()} · ${d.getDate()} ${MONTH_LONG[d.getMonth()].toUpperCase()} ${d.getFullYear()}`
}

/** Human label used on pills and headings. */
export function relativeDayLabel(iso: string): string {
  const delta = diffDays(iso, todayISO())
  if (delta === 0) return 'Today'
  if (delta === -1) return 'Yesterday'
  if (delta === 1) return 'Tomorrow'
  return formatLong(iso)
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${pad(m)} ${suffix}`
}

export function relativeFromNow(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (secs < 10) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late orbit'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

/** A 6x7 Monday-first grid of ISO dates covering the given month. */
export function monthGrid(year: number, monthIndex: number): string[] {
  const first = new Date(year, monthIndex, 1)
  // Shift so Monday === 0.
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, monthIndex, 1 - lead)
  const cells: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push(toISODate(d))
  }
  return cells
}

export function monthIndexOf(iso: string): number {
  return fromISODate(iso).getMonth()
}

export function yearOf(iso: string): number {
  return fromISODate(iso).getFullYear()
}

export function nowTimeValue(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
