import { useEffect } from 'react'
import { DateRibbon } from './components/DateRibbon'
import { FrameCanvas } from './components/FrameCanvas'
import { Hero } from './components/Hero'
import { NavBar } from './components/NavBar'
import { NudgeDock } from './components/NudgeDock'
import { Footer, OrbitLog } from './components/OrbitLog'
import { LoadLine } from './components/LoadLine'
import { ParticleField } from './components/ParticleField'
import { TaskBoard } from './components/TaskBoard'
import { ToastStack } from './components/ToastStack'
import { useFrameSequence } from './hooks/useFrameSequence'
import { OrbitProvider } from './lib/store'
import { primeAudio } from './lib/audio'

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
      {/* 1 — Scroll-scrubbed Red Velvet splash plate */}
      <FrameCanvas images={sequence.images} reveal={sequence.loaded > 0} loaded={sequence.loaded} />

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

        <main id="top" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-3 px-3 pt-5 pb-16 sm:px-6 sm:gap-4">
          <Hero />
          <NudgeDock />
          <DateRibbon />

          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <TaskBoard owner="shivam" />
            <TaskBoard owner="noor" />
          </div>

          <OrbitLog />
        </main>

        <Footer />
      </div>

      <ToastStack />

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
