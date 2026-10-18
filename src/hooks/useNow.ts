import { useEffect, useState } from 'react'

/** A ticking wall clock for relative timestamps and live readouts. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function clockLabel(ts: number, withSeconds = true): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return withSeconds
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
