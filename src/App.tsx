import { useEffect } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { CanvasScrollBackground } from './components/CanvasScrollBackground'
import { ActivityHeatMap } from './components/ActivityHeatMap'
import { DateRibbon } from './components/DateRibbon'
import { Hero } from './components/Hero'
import { NavBar } from './components/NavBar'
import { NudgeDock } from './components/NudgeDock'
import { Footer, OrbitLog } from './components/OrbitLog'
import { LoadLine } from './components/LoadLine'
import { ParticleField } from './components/ParticleField'
import { Reveal } from './components/Reveal'
import { TaskBoard } from './components/TaskBoard'
import { ToastStack } from './components/ToastStack'
import { SharedScratchpad } from './components/SharedScratchpad'
import { SyncVoiceCapsule } from './components/SyncVoiceCapsule'
import { useFrameSequence } from './hooks/useFrameSequence'
import { OrbitProvider } from './lib/store'
import { useOrbit } from './lib/orbit-context'
import { primeAudio } from './lib/audio'

const EASE = [0.16, 1, 0.3, 1] as const

function FirstTimeIdentityBanner() {
  const { currentUser, setCurrentUser } = useOrbit()
  if (currentUser) return null

  return (
    <motion.aside
      aria-label="Select your identity"
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: EASE }}
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b0c11]/94 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:bottom-5"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.05] text-[11px] text-[#F59E0B]">
            ✦
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium tracking-tight text-white/95">Choose your orbit</p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/45">
              Personalises live presence, nudges and your partner&apos;s view.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCurrentUser('shivam')}
            className="group flex h-10 items-center justify-center gap-2 rounded-xl border border-[#00F2FE]/35 bg-[#00F2FE]/10 text-[12px] font-medium text-[#9BF8FF] transition-all duration-200 hover:border-[#00F2FE]/55 hover:bg-[#00F2FE]/16 active:scale-[0.99]"
          >
            <span className="size-1.5 rounded-full bg-[#00F2FE] shadow-[0_0_8px_#00F2FE]" />
            I&apos;m Shivam
          </button>
          <button
            type="button"
            onClick={() => setCurrentUser('noor')}
            className="group flex h-10 items-center justify-center gap-2 rounded-xl border border-[#FF0844]/35 bg-[#FF0844]/10 text-[12px] font-medium text-[#FFC4B5] transition-all duration-200 hover:border-[#FF0844]/55 hover:bg-[#FF0844]/16 active:scale-[0.99]"
          >
            <span className="size-1.5 rounded-full bg-[#FF0844] shadow-[0_0_8px_#FF0844]" />
            I&apos;m Noor
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

/** Scroll-scrubbed splash stage. No boot gate: the workspace is interactive at once. */
function Shell() {
  const sequence = useFrameSequence()
  const { currentUser, goToToday } = useOrbit()

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

  // Small, discoverable keyboard layer: N = new task, T = jump to today.
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (isTyping(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('syncorbit:focus-add', { detail: { owner: currentUser } }))
      } else if (key === 't') {
        event.preventDefault()
        goToToday()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentUser, goToToday])

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* 1 — Scroll-scrubbed Red Velvet canvas, fixed behind every layer */}
      <CanvasScrollBackground images={sequence.images} reveal={sequence.loaded > 0} loaded={sequence.loaded} />

      {/* 2 — Legibility vignette over the plate */}
      <div
        aria-hidden="true"
        className="vignette pointer-events-none fixed inset-0 z-[5] transition-opacity duration-1000"
        style={{ opacity: sequence.loaded > 0 ? 1 : 0 }}
      />

      {/* 3 — Fine grain: a tactile finish over the plate, under the UI */}
      <div
        aria-hidden="true"
        className="grain pointer-events-none fixed inset-0 z-[6] opacity-[0.035] mix-blend-soft-light"
      />

      {/* 4 — Interaction particles (above the vignette, below toasts) */}
      <ParticleField />

      {/* 5 — Foreground workspace */}
      <div id="top" className="relative z-10 flex min-h-[220vh] flex-col">
        <NavBar />

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-3 px-3 pt-4 pb-28 outline-none sm:gap-4 sm:px-6 sm:pt-6 sm:pb-32"
        >
          {/* Primary: both partners' to-do lists, at the very top. */}
          <Reveal>
            <section aria-label="Partner task boards" className="grid gap-3 sm:gap-4 lg:grid-cols-2">
              <TaskBoard owner="shivam" />
              <TaskBoard owner="noor" />
            </section>
          </Reveal>

          {/* Focus readout — date, greeting and the four focus metrics. */}
          <Reveal delay={0.04}>
            <Hero />
          </Reveal>

          {/* Timeline directly beneath the hub. */}
          <Reveal delay={0.06}>
            <DateRibbon />
          </Reveal>

          {/* Shared utilities: nudge dock beside the scratchpad. */}
          <Reveal delay={0.08}>
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
          </Reveal>

          {/* Bottom bento row: all-time log beside the activity heat map. */}
          <Reveal delay={0.1}>
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
          </Reveal>

          {/* Closing note: the automated evening journal for both partners. */}
          <Reveal delay={0.12}>
            <SyncVoiceCapsule />
          </Reveal>
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
      <MotionConfig reducedMotion="user">
        <Shell />
      </MotionConfig>
    </OrbitProvider>
  )
}
