import { BRAND } from '../lib/constants'
import { activeDates } from '../lib/storage'
import { useOrbit } from '../lib/orbit-context'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 sm:border-l sm:border-white/[0.06] sm:pl-5 sm:first:border-l-0 sm:first:pl-0">
      <div className="label-mono text-[9.5px] text-white/45">{label}</div>
      <div
        className="metric mt-2.5 text-[clamp(26px,5vw,38px)] leading-none font-medium"
        style={{ color: tone ?? 'rgba(255,255,255,0.95)' }}
      >
        {value}
      </div>
    </div>
  )
}

/**
 * Closing orbit log.
 *
 * Deliberately the lightest surface in the app — a 16% smoked scrim with a
 * shallow 6px blur, so the plate stays readable as an image behind it. Only
 * labels and figures: no explanatory copy competing with the splash.
 */
export function OrbitLog() {
  const { allTasks, streak } = useOrbit()
  const tracked = activeDates(allTasks).length
  const completed = allTasks.filter((task) => task.done).length

  return (
    <section
      aria-label="Orbit log"
      className="rounded-card border border-white/[0.08] bg-black/[0.16] p-4 backdrop-blur-[6px] sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="label-mono">Orbit log</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="metric text-[10px] tracking-[0.14em] text-white/30">ALL TIME</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="Current streak" value={String(streak.current)} tone="#F59E0B" />
        <Stat label="Best run" value={String(streak.best)} />
        <Stat label="Active days" value={String(tracked)} />
        <Stat label="Completed" value={String(completed)} />
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.08] bg-black/[0.16] backdrop-blur-[6px]">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 text-[11px] tracking-tight text-white/40">
          <img src="/logo.png" alt="SyncOrbit" className="size-4 object-contain" />
          <span className="tracking-[0.2em] uppercase">{BRAND.name}</span>
          <span className="text-white/20">— {BRAND.tagline}</span>
        </span>
      </div>
    </footer>
  )
}
