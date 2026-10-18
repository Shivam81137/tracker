import { useEffect, useRef, useState } from 'react'
import { Download, Flame, Volume2, VolumeX } from 'lucide-react'
import { BRAND } from '../lib/constants'
import { onTick } from '../lib/ticker'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useOrbit } from '../lib/orbit-context'
import { useOnline } from '../lib/live'

/** Bottom hairline that tracks the background scrub, so scroll position is legible. */
function ScrubIndicator() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return onTick(() => {
      const el = ref.current
      if (!el) return
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, window.scrollY / max))
      el.style.transform = `scaleX(${progress})`
    })
  }, [])

  return (
    <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden bg-white/[0.06]">
      <div
        ref={ref}
        className="h-full origin-left bg-gradient-to-r from-[#00F2FE] via-[#F59E0B] to-[#FF0844]"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}

function NetworkBadge() {
  const online = useOnline()
  const { live } = useOrbit()
  const peers = live.peers
  const full = !online ? 'OFFLINE · LOCAL' : peers > 0 ? `SYNCED · ${peers + 1} TABS` : 'SYNCED ONLINE'
  const compact = !online ? 'OFFLINE' : peers > 0 ? `SYNC · ${peers + 1}` : 'SYNCED'

  return (
    <span
      className="pill pill-hover cursor-default select-none"
      title={
        online
          ? `Live channel active${peers > 0 ? ` with ${peers} other tab${peers === 1 ? '' : 's'}` : ''}`
          : 'No network — changes are saved locally and sync when you reconnect'
      }
    >
      <span className="flex h-3 w-[14px] items-end gap-[2px]" aria-hidden="true">
        <span className="h-1.5 w-[2px] origin-bottom rounded-full bg-current opacity-70" />
        <span className="h-2 w-[2px] origin-bottom rounded-full bg-current opacity-85 animate-eq" style={{ animationDelay: '-0.15s' }} />
        <span className="h-3 w-[2px] origin-bottom rounded-full bg-current animate-eq" style={{ animationDelay: '-0.4s' }} />
      </span>
      <span className="metric text-[10px] tracking-[0.14em] text-white/75">
        <span className="hidden sm:inline">{full}</span>
        <span className="sm:hidden">{compact}</span>
      </span>
      <span
        className={`size-1.5 rounded-full ${online ? 'animate-dot bg-[#00F2FE]' : 'bg-[#FF0844]'}`}
        aria-hidden="true"
      />
    </span>
  )
}

function StreakPill() {
  const { streak } = useOrbit()
  const active = streak.current > 0

  return (
    <span
      className={`pill cursor-default select-none ${active ? 'border-[#F59E0B]/25 text-[#F59E0B]' : 'text-white/45'}`}
      title={
        active
          ? `${streak.current} consecutive days with a completed task · best ${streak.best}`
          : 'Complete any task to start a streak'
      }
    >
      <Flame className={`size-3.5 ${active ? 'text-[#F59E0B]' : 'text-white/35'}`} strokeWidth={2.1} />
      <span className="metric text-[10px] tracking-[0.12em]">
        {streak.current}
        <span className="hidden sm:inline">
          <span className={active ? 'text-[#F59E0B]/70' : 'text-white/35'}>-DAY STREAK</span>
        </span>
        <span className="sm:hidden">D</span>
      </span>
    </span>
  )
}

function InstallButton() {
  const { install, installed, canPrompt } = useInstallPrompt()
  const { pushToast } = useOrbit()
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (installed) {
      pushToast({
        title: 'Already installed',
        body: 'SyncOrbit is running as a standalone window.',
        accent: 'sync',
        icon: '✦',
      })
      return
    }
    setBusy(true)
    const outcome = await install()
    setBusy(false)
    if (outcome === 'accepted') {
      pushToast({ title: 'Installing SyncOrbit', body: 'Adding it to your home screen.', accent: 'shivam', icon: '✦' })
      return
    }
    if (outcome === 'dismissed') {
      pushToast({
        title: 'Install dismissed',
        body: 'The Install button stays here whenever you change your mind.',
        accent: 'neutral',
        icon: '✦',
      })
      return
    }
    pushToast({
      title: 'Install from your browser menu',
      body: /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'iOS: Share ▸ Add to Home Screen.'
        : 'Open the browser menu and choose “Install app”.',
      accent: 'sync',
      icon: '↓',
      ttl: 6000,
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`pill pill-hover ${canPrompt ? 'border-[#00F2FE]/30 text-white/90' : ''} disabled:opacity-50`}
      title={canPrompt ? 'Install SyncOrbit as an app' : 'How to install SyncOrbit'}
      aria-label="Install SyncOrbit"
    >
      <Download className="size-3.5" strokeWidth={2.1} />
      <span className="metric hidden text-[10px] tracking-[0.14em] sm:inline">
        {installed ? 'INSTALLED' : 'INSTALL'}
      </span>
    </button>
  )
}

function SoundToggle() {
  const { soundOn, toggleSound } = useOrbit()
  return (
    <button
      type="button"
      onClick={toggleSound}
      className="icon-btn size-8 sm:size-9"
      aria-pressed={soundOn}
      aria-label={soundOn ? 'Mute interface sound' : 'Enable interface sound'}
      title={soundOn ? 'Sound on' : 'Sound off'}
    >
      {soundOn ? <Volume2 className="size-4" strokeWidth={1.9} /> : <VolumeX className="size-4" strokeWidth={1.9} />}
    </button>
  )
}

export function NavBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-black/40 backdrop-blur-[20px]">
      <nav className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-1.5 px-3 sm:h-16 sm:gap-2.5 sm:px-6">
        <a href="#top" className="group mr-auto flex min-w-0 items-center gap-2 select-none">
          <span className="animate-halo text-[15px] text-[#00F2FE] transition-transform duration-500 group-hover:rotate-90">
            {BRAND.mark}
          </span>
          <span className="truncate text-[12px] font-semibold tracking-[0.26em] text-white/92 uppercase sm:text-[14px] sm:tracking-[0.28em]">
            {BRAND.name}
          </span>
          <span className="ml-1 hidden text-[10px] tracking-[0.2em] text-white/25 uppercase xl:inline">
            Shivam · Noor
          </span>
        </a>

        <NetworkBadge />
        <StreakPill />
        <InstallButton />
        <SoundToggle />
      </nav>
      <ScrubIndicator />
    </header>
  )
}
