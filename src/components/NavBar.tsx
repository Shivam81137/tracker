import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarPlus,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Flame,
  Menu,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { PARTNERS, PARTNER_ORDER } from '../lib/constants'
import { downloadCalendarFeed } from '../lib/gcal'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useNow } from '../hooks/useNow'
import { onTick } from '../lib/ticker'
import { useOrbit } from '../lib/orbit-context'
import { useOnline } from '../lib/live'
import { SyncSettingsModal } from './SyncSettingsModal'

function timeAgoShort(timestamp: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

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

/** Shared partner presence readout for the island pill, mobile dot and drawer. */
function usePartnerStatus() {
  const { currentUser, live } = useOrbit()
  const now = useNow(15_000)

  const partnerKey = currentUser === 'shivam' ? 'noor' : currentUser === 'noor' ? 'shivam' : null
  const partnerMeta = partnerKey ? PARTNERS[partnerKey] : null
  const info = live.partnerPresence
  const hasPresence = Boolean(info && info.user === partnerKey)
  const isOnline = Boolean(hasPresence && info?.isOnline)
  const lastSeen = hasPresence ? info?.lastSeen : undefined
  const label = !partnerKey
    ? 'Solo mode'
    : isOnline
      ? `${partnerMeta?.name} active`
      : lastSeen
        ? `${partnerMeta?.name} ${timeAgoShort(lastSeen, now)}`
        : `${partnerMeta?.name} away`

  return {
    partnerKey,
    partnerName: partnerMeta?.name ?? null,
    color: partnerMeta?.from ?? 'rgba(255,255,255,0.35)',
    isOnline,
    lastSeen,
    label,
  }
}

function PartnerPresencePill({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { isOnline, lastSeen, label, color, partnerName } = usePartnerStatus()

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className="group inline-flex items-center gap-2 rounded-full px-2.5 py-1 transition-colors duration-200 hover:bg-white/[0.06]"
      title={
        partnerName
          ? `${partnerName} is ${isOnline ? 'active right now' : lastSeen ? 'away' : 'not connected'}`
          : 'Choose an identity to see partner presence'
      }
    >
      <span className="relative flex size-2 shrink-0">
        {isOnline && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-flex size-2 rounded-full"
          style={{
            backgroundColor: isOnline || lastSeen ? color : 'rgba(255,255,255,0.28)',
            opacity: isOnline ? 1 : lastSeen ? 0.45 : 1,
            boxShadow: isOnline ? `0 0 10px ${color}` : undefined,
          }}
        />
      </span>
      <span className="whitespace-nowrap text-[11px] font-medium tracking-tight text-white/70 transition-colors group-hover:text-white/95">
        {label}
      </span>
    </button>
  )
}

function PartnerPresenceDot({ onOpen }: { onOpen: () => void }) {
  const { isOnline, lastSeen, color, label, partnerName } = usePartnerStatus()

  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex h-9 items-center gap-2 rounded-full px-2 text-white/55 transition-colors hover:text-white/90"
      title={partnerName ? `${partnerName} · ${isOnline ? 'active now' : 'last seen'}` : 'Open identity & tools'}
      aria-label={partnerName ? `${partnerName}, ${isOnline ? 'active now' : 'away'}` : 'Open identity and tools'}
    >
      <span className="relative flex size-2.5">
        {isOnline && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-flex size-2.5 rounded-full ring-2 ring-[#070709]/70"
          style={{
            backgroundColor: isOnline || lastSeen ? color : 'rgba(255,255,255,0.28)',
            opacity: isOnline ? 1 : lastSeen ? 0.45 : 1,
            boxShadow: isOnline ? `0 0 12px ${color}` : undefined,
          }}
        />
      </span>
      <span className="hidden font-mono text-[9px] tracking-[0.16em] text-white/35 uppercase min-[360px]:inline">
        {partnerName ?? 'solo'}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

function StreakPill() {
  const { streak } = useOrbit()
  const active = streak.current > 0

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${
        active ? 'text-[#F59E0B]' : 'text-white/40'
      }`}
      title={
        active
          ? `${streak.current} consecutive days with a completed task · best ${streak.best}`
          : 'Complete any task to start a streak'
      }
    >
      <Flame className={`size-3.5 ${active ? 'text-[#F59E0B]' : 'text-white/30'}`} strokeWidth={2.1} />
      <span className="metric tracking-[0.08em] whitespace-nowrap">
        {active ? `${streak.current}-Day Streak` : 'Start a streak'}
      </span>
    </span>
  )
}

function IdentitySwitcher({ onPick }: { onPick?: () => void }) {
  const { currentUser, setCurrentUser } = useOrbit()

  return (
    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Identity switcher">
      {PARTNER_ORDER.map((person) => {
        const meta = PARTNERS[person]
        const active = currentUser === person
        return (
          <button
            key={person}
            type="button"
            onClick={() => {
              setCurrentUser(person)
              onPick?.()
            }}
            aria-pressed={active}
            className={`group flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-medium tracking-tight transition-colors duration-200 ${
              active
                ? 'text-white'
                : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:bg-white/[0.06] hover:text-white/85'
            }`}
            style={
              active
                ? {
                    borderColor: `color-mix(in oklab, ${meta.from} 45%, transparent)`,
                    background: `color-mix(in oklab, ${meta.from} 12%, transparent)`,
                    boxShadow: `0 0 24px -14px ${meta.from}`,
                  }
                : undefined
            }
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background: active ? meta.from : 'rgba(255,255,255,0.25)',
                boxShadow: active ? `0 0 8px ${meta.from}` : undefined,
              }}
            />
            <span>{meta.name}</span>
            {active && <Check className="size-3 text-white/70" strokeWidth={2.5} />}
          </button>
        )
      })}
    </div>
  )
}

function CloudStatusRow() {
  const online = useOnline()
  const { live } = useOrbit()
  const now = useNow(15_000)

  const label = !online
    ? 'Offline · local first'
    : live.status === 'connecting'
      ? 'Connecting to cloud…'
      : live.status === 'error'
        ? 'Reconnecting…'
        : `Cloud synced · ${timeAgoShort(live.lastSyncedAt || now, now)}`

  const tone = !online || live.status === 'error' ? '#FF0844' : live.status === 'connecting' ? '#F59E0B' : '#00F2FE'

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <Cloud className="size-3.5 text-white/35" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate font-mono text-[9.5px] tracking-[0.1em] text-white/40 uppercase">
        {label}
      </span>
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone, boxShadow: `0 0 8px ${tone}` }} />
    </div>
  )
}

function useGcalExport() {
  const { allTasks, pushToast } = useOrbit()

  return () => {
    const count = downloadCalendarFeed(allTasks)
    pushToast(
      count > 0
        ? {
            title: 'Calendar feed ready',
            body: `${count} upcoming ${count === 1 ? 'task' : 'tasks'} saved as .ics — import it into Google Calendar.`,
            accent: 'sync',
            icon: '📅',
          }
        : {
            title: 'Nothing to sync yet',
            body: 'Add a task from today onward, then export it to Google Calendar.',
            accent: 'neutral',
            icon: '📅',
          },
    )
  }
}

type InstallPrompt = ReturnType<typeof useInstallPrompt>

function InstallButton({
  prompt,
  variant = 'header',
  onDone,
}: {
  prompt: InstallPrompt
  variant?: 'header' | 'sheet'
  onDone?: () => void
}) {
  const { pushToast } = useOrbit()
  const [busy, setBusy] = useState(false)
  const { install, installed, canPrompt } = prompt

  if (installed) return null

  const onClick = async () => {
    setBusy(true)
    const outcome = await install()
    setBusy(false)
    onDone?.()

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

  const sheet = variant === 'sheet'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        sheet
          ? 'group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#00F2FE]/40 bg-[#00F2FE] px-4 text-[11px] font-semibold tracking-[0.14em] text-[#041014] uppercase transition hover:bg-[#7DF9FF] active:scale-[0.99] disabled:opacity-60'
          : `group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors duration-200 disabled:opacity-50 ${
              canPrompt
                ? 'border-[#00F2FE]/35 bg-[#00F2FE]/12 text-[#C9FAFF] hover:bg-[#00F2FE]/20'
                : 'border-white/[0.1] bg-white/[0.04] text-white/65 hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white/90'
            }`
      }
      title={canPrompt ? 'Install SyncOrbit as an app' : 'How to install SyncOrbit'}
      aria-label="Install SyncOrbit"
    >
      <Download className="size-3.5" strokeWidth={2.1} />
      <span>{busy ? 'Installing' : 'Install'}</span>
    </button>
  )
}

function ToolsMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const { currentUser } = useOrbit()
  const exportCalendar = useGcalExport()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`icon-btn ${open ? 'border-white/[0.2] bg-white/[0.1] text-white' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open tools"
        title="Tools · identity, calendar & settings"
      >
        <SlidersHorizontal className="size-4" strokeWidth={1.9} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Tools"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[calc(100%+0.65rem)] right-0 z-50 w-[19rem] origin-top-right overflow-hidden rounded-2xl border border-white/[0.1] bg-[#09090D]/92 shadow-[0_28px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-[28px]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="label-mono text-[9px]">Tools</span>
              <span className="metric text-[9px] tracking-[0.12em] text-white/30 uppercase">
                {currentUser ? `${currentUser} signed in` : 'no identity'}
              </span>
            </div>

            <div className="space-y-3 p-3">
              <div>
                <p className="label-mono mb-2 px-1 text-[9px]">Identity</p>
                <IdentitySwitcher onPick={() => setOpen(false)} />
              </div>

              <div className="h-px bg-white/[0.06]" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  exportCalendar()
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <CalendarPlus className="size-4 text-[#F59E0B]" strokeWidth={1.9} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium tracking-tight text-white/85">Sync GCal</span>
                  <span className="block text-[10px] text-white/35">Export upcoming orbit as .ics</span>
                </span>
                <ChevronRight className="size-3.5 text-white/25" strokeWidth={1.9} />
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onOpenSettings()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <Settings className="size-4 text-white/55" strokeWidth={1.9} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium tracking-tight text-white/85">Settings</span>
                  <span className="block text-[10px] text-white/35">Sync, room & identity</span>
                </span>
                <ChevronRight className="size-3.5 text-white/25" strokeWidth={1.9} />
              </button>

              <CloudStatusRow />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileToolsSheet({
  open,
  onClose,
  onOpenSettings,
  installPrompt,
}: {
  open: boolean
  onClose: () => void
  onOpenSettings: () => void
  installPrompt: InstallPrompt
}) {
  const { streak } = useOrbit()
  const exportCalendar = useGcalExport()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="syncorbit-mobile-tools"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 top-full z-40 overflow-hidden border-b border-white/[0.08] bg-[#070709]/92 backdrop-blur-[28px] md:hidden"
        >
          <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 pt-3 pb-4">
            <div className="flex items-center justify-between">
              <span className="label-mono text-[9px]">Identity</span>
              <span className="metric text-[9px] tracking-[0.12em] text-white/30 uppercase">Who is here?</span>
            </div>

            <IdentitySwitcher />

            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
              <StreakPill />
              <span className="metric text-[9px] tracking-[0.12em] text-white/30 uppercase">
                Best {streak.best}d
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportCalendar}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] font-medium tracking-tight text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <CalendarPlus className="size-3.5 text-[#F59E0B]" strokeWidth={1.9} />
                Sync GCal
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] font-medium tracking-tight text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <Settings className="size-3.5 text-white/55" strokeWidth={1.9} />
                Settings
              </button>
            </div>

            <CloudStatusRow />

            <InstallButton prompt={installPrompt} variant="sheet" onDone={onClose} />

            <p className="text-center font-mono text-[9px] tracking-[0.16em] text-white/20 uppercase">
              shivam &amp; noor · daily sync
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Logo() {
  return (
    <a
      href="#top"
      className="group flex min-w-0 shrink-0 items-center gap-2.5 select-none"
      aria-label="SyncOrbit home"
    >
      <span className="relative size-9 shrink-0 sm:size-10">
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          loading="eager"
          className="size-full rounded-[11px] object-cover ring-1 ring-white/[0.12] shadow-[0_0_20px_-6px_rgba(255,8,68,0.65)] transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[12px] font-semibold tracking-[0.16em] text-white/95 sm:text-[13px] sm:tracking-[0.18em]">
          SyncOrbit
        </span>
      </span>
    </a>
  )
}

export function NavBar() {
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const installPrompt = useInstallPrompt()

  const openSettings = () => {
    setMobileOpen(false)
    setSyncModalOpen(true)
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#070709]/45 backdrop-blur-[20px]">
        <nav className="relative mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2 px-3 sm:h-16 sm:px-6 md:gap-4">
          <Logo />

          <div className="flex min-w-0 flex-1 items-center justify-center">
            {/* Mobile: a single live presence dot in the optical centre. */}
            <div className="md:hidden">
              <PartnerPresenceDot onOpen={() => setMobileOpen(true)} />
            </div>

            {/* Desktop: one frosted island for the two vital signals only. */}
            <div className="hidden items-center gap-0.5 rounded-full border border-white/[0.09] bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-[24px] md:inline-flex">
              <PartnerPresencePill onOpenSettings={openSettings} />
              <span className="h-3 w-px bg-white/[0.09]" aria-hidden="true" />
              <StreakPill />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <ToolsMenu onOpenSettings={openSettings} />
              <InstallButton prompt={installPrompt} />
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              className={`icon-btn md:hidden ${mobileOpen ? 'border-white/[0.2] bg-white/[0.1] text-white' : ''}`}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="syncorbit-mobile-tools"
            >
              {mobileOpen ? <X className="size-4" strokeWidth={2} /> : <Menu className="size-4" strokeWidth={2} />}
            </button>
          </div>
        </nav>

        <ScrubIndicator />

        <MobileToolsSheet
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onOpenSettings={openSettings}
          installPrompt={installPrompt}
        />
      </header>

      <SyncSettingsModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
    </>
  )
}
