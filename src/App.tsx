import { useEffect } from 'react'
import { CanvasScrollBackground } from './components/CanvasScrollBackground'
import { ActivityHeatMap } from './components/ActivityHeatMap'
import { DateRibbon } from './components/DateRibbon'
import { Hero } from './components/Hero'
import { NavBar } from './components/NavBar'
import { NudgeDock } from './components/NudgeDock'
import { Footer, OrbitLog } from './components/OrbitLog'
import { LoadLine } from './components/LoadLine'
import { ParticleField } from './components/ParticleField'
import { TaskBoard } from './components/TaskBoard'
import { ToastStack } from './components/ToastStack'
import { SharedScratchpad } from './components/SharedScratchpad'
import { SyncVoiceCapsule } from './components/SyncVoiceCapsule'
import { useFrameSequence } from './hooks/useFrameSequence'
import { OrbitProvider } from './lib/store'
import { useOrbit } from './lib/orbit-context'
import { primeAudio } from './lib/audio'

function FirstTimeIdentityBanner() {
  const { currentUser, setCurrentUser } = useOrbit()
  if (currentUser) return null

  return (
    <aside
      aria-label="Select your identity"
      className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-md rounded-2xl border border-[#00F2FE]/30 bg-[#0C1017]/95 p-4 shadow-2xl backdrop-blur-xl text-white"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white/95">Who is using this phone?</p>
          <p className="text-[11px] text-white/50">Personalize real-time sync & partner nudges</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentUser('shivam')}
            className="rounded-xl border border-[#00F2FE]/40 bg-[#00F2FE]/15 px-3 py-1.5 text-xs font-medium text-[#00F2FE] hover:bg-[#00F2FE]/25 transition"
          >
            Shivam ⚡
          </button>
          <button
            type="button"
            onClick={() => setCurrentUser('noor')}
            className="rounded-xl border border-[#FF0844]/40 bg-[#FF0844]/15 px-3 py-1.5 text-xs font-medium text-[#FFB199] hover:bg-[#FF0844]/25 transition"
          >
            Noor ✨
          </button>
        </div>
      </div>
    </aside>
  )
}

/** Scroll-scrubbed splash stage. No boot gate: the workspace is interactive at once. */
function Shell() {
  const sequence = useFrameSequence()

  // Unlock the audio graph on the first interaction anywhere in the app.
  useEffect(() => {
    const unlock = () => primeAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <>
      {/* 1 — Scroll-scrubbed Red Velvet canvas, fixed behind every layer */}
      <CanvasScrollBackground images={sequence.images} reveal={sequence.loaded > 0} loaded={sequence.loaded} />

      {/* 2 — Legibility vignette over the plate */}
      <div
        aria-hidden="true"
        className="vignette pointer-events-none fixed inset-0 z-[5] transition-opacity duration-1000"
        style={{ opacity: sequence.loaded > 0 ? 1 : 0 }}
      />

      {/* 3 — Interaction particles (above the vignette, below toasts) */}
      <ParticleField />

      {/* 4 — Foreground workspace */}
      <div className="relative z-10 flex min-h-[220vh] flex-col">
        <NavBar />

        <main
          id="top"
          className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-3 px-3 pt-4 pb-28 sm:gap-4 sm:px-6 sm:pt-6 sm:pb-32"
        >
          {/* Focus readout — date, greeting and the four focus metrics. */}
          <Hero />

          {/* Timeline sits directly beneath the hub, above the boards. */}
          <DateRibbon />

          {/* Primary bento row: the two partner boards. */}
          <section aria-label="Partner task boards" className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <TaskBoard owner="shivam" />
            <TaskBoard owner="noor" />
          </section>

          {/* Shared utilities: nudge dock beside the scratchpad. */}
          <section
            aria-label="Shared utilities"
            className="grid items-start gap-3 sm:gap-4 lg:grid-cols-12"
          >
            <div className="min-w-0 lg:col-span-7">
              <NudgeDock />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <SharedScratchpad />
            </div>
          </section>

          {/* Bottom bento row: all-time log beside the activity heat map. */}
          <section
            aria-label="All-time stats and activity"
            className="grid items-start gap-3 sm:gap-4 lg:grid-cols-12"
          >
            <div className="min-w-0 lg:col-span-4">
              <OrbitLog />
            </div>
            <div className="min-w-0 lg:col-span-8">
              <ActivityHeatMap />
            </div>
          </section>

          {/* Closing note: the automated evening journal for both partners. */}
          <SyncVoiceCapsule />
        </main>

        <Footer />
      </div>

      <ToastStack />
      <FirstTimeIdentityBanner />

      <LoadLine progress={sequence.progress} done={sequence.done} degraded={sequence.degraded} />
    </>
  )
}

export default function App() {
  return (
    <OrbitProvider>
      <Shell />
    </OrbitProvider>
  )
}
