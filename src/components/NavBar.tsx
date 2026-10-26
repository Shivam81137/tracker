import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
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
import { formatLong, isToday, todayISO } from '../lib/date'
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
  // Without a Firebase URL we still know the partner is nearby as soon as a
  // realtime MQTT/Firebase state arrives. Use that as a presence fallback.
  const recentlyActive = !hasPresence && live.partnerActive
  const isOnline = Boolean(hasPresence ? info?.isOnline : recentlyActive)
  const lastSeen = hasPresence ? info?.lastSeen : undefined
  const label = !partnerKey
    ? 'Solo mode'
    : isOnline
      ? recentlyActive
        ? `${partnerMeta?.name} syncing`
        : `${partnerMeta?.name} active`
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
      <span className="whitespace-nowrap text-[11px] font-medium tracking-tight text-white/80 transition-colors group-hover:text-white/97">
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
      className="inline-flex h-9 items-center gap-2 rounded-full px-2 text-white/68 transition-colors hover:text-white/94"
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
      <span className="hidden font-mono text-[9px] tracking-[0.16em] text-white/50 uppercase min-[360px]:inline">
        {partnerName ?? 'solo'}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

function StreakPill({ compact = false }: { compact?: boolean }) {
  const { streak } = useOrbit()
  const active = streak.current > 0

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-1 text-[10px] ${
        compact ? 'px-1.5' : 'px-2.5'
      } ${active ? 'text-[#F59E0B]' : 'text-white/55'}`}
      title={
        active
          ? `${streak.current} consecutive days with a completed task · best ${streak.best}`
          : 'Complete any task to start a streak'
      }
    >
      <Flame className={`size-3.5 ${active ? 'text-[#F59E0B]' : 'text-white/45'}`} strokeWidth={2.1} />
      {compact ? (
        <span className="metric text-[10px] tracking-[0.04em] tabular-nums">
          {active ? streak.current : '0'}d
        </span>
      ) : (
        <span className="metric tracking-[0.08em] whitespace-nowrap">
          {active ? `${streak.current}-Day Streak` : 'Start a streak'}
        </span>
      )}
    </span>
  )
}

/** Compact cloud heartbeat so the navbar answers “is my data safe?” at a glance. */
function SyncStatePill() {
  const online = useOnline()
  const { live } = useOrbit()
  const now = useNow(15_000)

  const tone =
    !online || live.status === 'offline' || live.status === 'error'
      ? '#FF0844'
      : live.status === 'connecting'
        ? '#F59E0B'
        : '#00F2FE'
  const label = !online
    ? 'Offline'
    : live.status === 'offline'
      ? 'Local'
      : live.status === 'error'
        ? 'Retrying'
        : live.status === 'connecting'
          ? 'Linking'
          : 'Synced'
  const detail =
    online && live.status === 'synced' && live.lastSyncedAt ? timeAgoShort(live.lastSyncedAt, now) : null

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1"
      title={
        detail
          ? `Cloud synced ${detail} · local-first, always available offline`
          : `Cloud state: ${label.toLowerCase()}`
      }
    >
      <span
        className="size-1.5 shrink-0 rounded-full transition-colors duration-500"
        style={{ backgroundColor: tone, boxShadow: `0 0 8px ${tone}` }}
      />
      <span className="metric text-[9px] tracking-[0.14em] text-white/64 uppercase">{label}</span>
      {detail && <span className="metric hidden text-[9px] text-white/35 xl:inline">{detail}</span>}
    </span>
  )
}

/** Today / back-to-today shortcut, mirroring the `T` key. */
function TodayButton() {
  const { viewDate, goToToday } = useOrbit()
  const today = isToday(viewDate)

  return (
    <button
      type="button"
      onClick={() => {
        if (today) {
          window.scrollTo({ top: 0, behavior: 'smooth' })
          return
        }
        goToToday()
      }}
      className={`group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors duration-200 ${
        today
          ? 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/[0.16] hover:text-white/88'
          : 'border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#FDE68A] hover:border-[#F59E0B]/55 hover:bg-[#F59E0B]/16'
      }`}
      title={today ? 'Already viewing today — jump to the top' : `Back to today · ${formatLong(todayISO())}`}
    >
      <CalendarDays className={`size-3.5 ${today ? '' : 'text-[#F59E0B]'}`} strokeWidth={2.1} />
      <span className="whitespace-nowrap">Today</span>
      <kbd className="metric rounded border border-white/[0.1] bg-black/25 px-1 py-px text-[9px] text-white/50">
        T
      </kbd>
    </button>
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
            className={`group relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-colors duration-200 ${
              active
                ? 'text-white'
                : 'border-white/[0.07] bg-white/[0.02] text-white/64 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/90'
            }`}
            style={
              active
                ? {
                    borderColor: `color-mix(in oklab, ${meta.from} 45%, transparent)`,
                    background: `color-mix(in oklab, ${meta.from} 11%, transparent)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 0 24px -14px ${meta.from}`,
                  }
                : undefined
            }
          >
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full border text-[10px] font-semibold transition-colors duration-200"
              style={{
                borderColor: active
                  ? `color-mix(in oklab, ${meta.from} 38%, transparent)`
                  : 'rgba(255,255,255,0.1)',
                background: active
                  ? `color-mix(in oklab, ${meta.from} 16%, transparent)`
                  : 'rgba(255,255,255,0.04)',
                color: active ? meta.from : 'rgba(255,255,255,0.55)',
              }}
            >
              {meta.initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-medium tracking-tight">{meta.name}</span>
              <span className="mt-0.5 block font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
                {active ? 'Current' : 'Switch'}
              </span>
            </span>
            <AnimatePresence initial={false}>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 26 }}
                  className="shrink-0"
                  style={{ color: meta.from }}
                >
                  <Check className="size-3.5" strokeWidth={2.8} />
                </motion.span>
              )}
            </AnimatePresence>
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
      : live.status === 'offline'
        ? 'Local only · cloud paused'
        : live.status === 'error'
          ? 'Reconnecting…'
          : `Cloud synced · ${timeAgoShort(live.lastSyncedAt || now, now)}`

  const tone =
    !online || live.status === 'offline' || live.status === 'error'
      ? '#FF0844'
      : live.status === 'connecting'
        ? '#F59E0B'
        : '#00F2FE'

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <Cloud className="size-3.5 text-white/50" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate font-mono text-[9.5px] tracking-[0.1em] text-white/55 uppercase">
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
  variant?: 'header' | 'sheet' | 'icon'
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
  const icon = variant === 'icon'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        sheet
          ? 'group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#00F2FE]/40 bg-[#00F2FE] px-4 text-[11px] font-semibold tracking-[0.14em] text-[#041014] uppercase transition hover:bg-[#7DF9FF] active:scale-[0.99] disabled:opacity-60'
          : icon
            ? `icon-btn ${canPrompt ? 'border-[#00F2FE]/35 bg-[#00F2FE]/12 text-[#C9FAFF] hover:bg-[#00F2FE]/20' : ''}`
            : `group inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors duration-200 disabled:opacity-50 ${
                canPrompt
                  ? 'border-[#00F2FE]/35 bg-[#00F2FE]/12 text-[#C9FAFF] hover:bg-[#00F2FE]/20'
                  : 'border-white/[0.1] bg-white/[0.04] text-white/76 hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white/94'
              }`
      }
      title={canPrompt ? 'Install SyncOrbit as an app' : 'How to install SyncOrbit'}
      aria-label="Install SyncOrbit"
    >
      <Download className={icon ? 'size-4' : 'size-3.5'} strokeWidth={2.1} />
      {!icon && <span>{busy ? 'Installing' : 'Install'}</span>}
    </button>
  )
}

function ToolAction({
  icon,
  title,
  subtitle,
  tone = 'rgba(255,255,255,0.6)',
  onClick,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  tone?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-white/[0.05]"
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-lg border transition-colors duration-200"
        style={{
          borderColor: `color-mix(in oklab, ${tone} 22%, transparent)`,
          background: `color-mix(in oklab, ${tone} 8%, transparent)`,
          color: tone,
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium tracking-tight text-white/90 transition-colors group-hover:text-white">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-white/50">{subtitle}</span>
      </span>
      <ChevronRight
        className="size-3.5 shrink-0 text-white/38 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/64"
        strokeWidth={1.9}
      />
    </button>
  )
}

function ToolsMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const { currentUser } = useOrbit()
  const exportCalendar = useGcalExport()
  const identity = currentUser ? PARTNERS[currentUser] : null

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
        className={`icon-btn relative ${open ? 'border-white/[0.2] bg-white/[0.1] text-white' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open tools"
        title="Tools · identity, calendar & settings"
      >
        <SlidersHorizontal className="size-4" strokeWidth={1.9} />
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2 ring-[#070709] transition-colors duration-300"
          style={{
            background: identity?.from ?? 'rgba(255,255,255,0.3)',
            boxShadow: identity ? `0 0 6px ${identity.from}` : undefined,
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            aria-label="Tools"
            initial={{ opacity: 0, y: -8, scale: 0.97, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[calc(100%+0.75rem)] right-0 z-50 w-[21rem] origin-top-right overflow-hidden rounded-2xl border border-white/[0.11] bg-[#09090D]/94 shadow-[0_36px_100px_-32px_rgba(0,0,0,0.98)] backdrop-blur-[28px]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />

            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full border text-[10px] font-semibold"
                style={{
                  borderColor: identity
                    ? `color-mix(in oklab, ${identity.from} 38%, transparent)`
                    : 'rgba(255,255,255,0.1)',
                  background: identity
                    ? `color-mix(in oklab, ${identity.from} 13%, transparent)`
                    : 'rgba(255,255,255,0.04)',
                  color: identity?.from ?? 'rgba(255,255,255,0.45)',
                }}
              >
                {identity?.initial ?? '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="label-mono text-[9px]">Workspace</p>
                <p className="mt-0.5 truncate text-[10.5px] text-white/60">
                  {identity ? `Signed in as ${identity.name}` : 'No identity selected'}
                </p>
              </div>
              <span className="metric rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-white/45 uppercase">
                v1
              </span>
            </div>

            <div className="space-y-3 p-3">
              <div>
                <p className="label-mono mb-2 px-1 text-[9px]">Identity</p>
                <IdentitySwitcher onPick={() => setOpen(false)} />
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div className="space-y-0.5">
                <ToolAction
                  icon={<CalendarPlus className="size-3.5" strokeWidth={2} />}
                  title="Sync Google Calendar"
                  subtitle="Export the upcoming orbit as .ics"
                  tone="#F59E0B"
                  onClick={() => {
                    exportCalendar()
                    setOpen(false)
                  }}
                />
                <ToolAction
                  icon={<Settings className="size-3.5" strokeWidth={2} />}
                  title="Settings"
                  subtitle="Cloud sync, room & presence"
                  onClick={() => {
                    setOpen(false)
                    onOpenSettings()
                  }}
                />
              </div>

              <CloudStatusRow />
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
              <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] text-white/38 uppercase">
                <kbd className="rounded border border-white/[0.1] bg-black/25 px-1 py-px text-white/60">N</kbd>
                New task
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] text-white/38 uppercase">
                <kbd className="rounded border border-white/[0.1] bg-black/25 px-1 py-px text-white/60">T</kbd>
                Today
              </span>
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
  const { streak, currentUser, viewDate, goToToday } = useOrbit()
  const exportCalendar = useGcalExport()
  const identity = currentUser ? PARTNERS[currentUser] : null

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
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-3xl border-x border-b border-white/[0.08] bg-[#070709]/94 shadow-[0_36px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-[28px] md:hidden"
        >
          <div className="mx-auto max-h-[calc(100dvh-4.75rem-env(safe-area-inset-top))] w-full max-w-[1200px] overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />

            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full border text-[11px] font-semibold"
                  style={{
                    borderColor: identity
                      ? `color-mix(in oklab, ${identity.from} 38%, transparent)`
                      : 'rgba(255,255,255,0.1)',
                    background: identity
                      ? `color-mix(in oklab, ${identity.from} 13%, transparent)`
                      : 'rgba(255,255,255,0.04)',
                    color: identity?.from ?? 'rgba(255,255,255,0.45)',
                  }}
                >
                  {identity?.initial ?? '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="label-mono text-[9px]">Workspace</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/68">
                    {identity ? `${identity.name}'s orbit` : 'Choose who is here'}
                  </p>
                </div>
                <span className="chip hidden min-[360px]:inline-flex">Daily sync</span>
              </div>

              <IdentitySwitcher onPick={onClose} />

              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#F59E0B]">
                  <Flame className="size-4" strokeWidth={2.1} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-medium tracking-tight text-white/90">
                    {streak.current > 0 ? `${streak.current}-day streak` : 'Start a streak'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/50">
                    {streak.current > 0
                      ? `Best run ${streak.best} days · keep the orbit warm`
                      : 'Complete any task to light the flame'}
                  </p>
                </div>
                <span className="metric shrink-0 text-[9px] tracking-[0.12em] text-white/38 uppercase">
                  {streak.current}d
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isToday(viewDate)) window.scrollTo({ top: 0, behavior: 'smooth' })
                    else goToToday()
                    onClose()
                  }}
                  className={`flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[10.5px] font-medium tracking-tight transition-colors ${
                    isToday(viewDate)
                      ? 'border-white/[0.07] bg-white/[0.025] text-white/60 hover:bg-white/[0.05]'
                      : 'border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#FDE68A] hover:bg-[#F59E0B]/16'
                  }`}
                >
                  <CalendarDays className={`size-4 ${isToday(viewDate) ? 'text-white/60' : 'text-[#F59E0B]'}`} strokeWidth={2} />
                  {isToday(viewDate) ? 'Top' : 'Today'}
                </button>
                <button
                  type="button"
                  onClick={exportCalendar}
                  className="flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[10.5px] font-medium tracking-tight text-white/84 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  <CalendarPlus className="size-4 text-[#F59E0B]" strokeWidth={2} />
                  GCal
                </button>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[10.5px] font-medium tracking-tight text-white/84 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  <Settings className="size-4 text-white/68" strokeWidth={2} />
                  Settings
                </button>
              </div>

              <CloudStatusRow />

              <InstallButton prompt={installPrompt} variant="sheet" onDone={onClose} />

              <p className="text-center font-mono text-[9px] tracking-[0.16em] text-white/32 uppercase">
                shivam &amp; noor · daily sync
              </p>
            </motion.div>
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
        <span
          aria-hidden="true"
          className="absolute -inset-px rounded-[12px] bg-gradient-to-br from-[#00F2FE]/55 via-white/10 to-[#FF0844]/55 opacity-50 blur-[3px] transition-opacity duration-500 group-hover:opacity-90"
        />
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          loading="eager"
          className="relative size-full rounded-[11px] object-cover ring-1 ring-white/[0.14] shadow-[0_0_24px_-8px_rgba(255,8,68,0.6)] transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-display truncate text-[12px] font-semibold tracking-[0.16em] text-white/97 sm:text-[13px]">
          SyncOrbit
        </span>
      </span>
    </a>
  )
}

export function NavBar() {
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const installPrompt = useInstallPrompt()

  // Deepen the glass once the page moves, so the bar never feels detached.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Collapse the mobile sheet if the viewport grows into the desktop nav.
  useEffect(() => {
    if (!mobileOpen) return
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) setMobileOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mobileOpen])

  const openSettings = () => {
    setMobileOpen(false)
    setSyncModalOpen(true)
  }

  return (
    <>
      <header
        className={`sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-[24px] transition-[background-color,border-color,box-shadow] duration-500 ${
          scrolled
            ? 'border-white/[0.1] bg-[#070709]/82 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.98)]'
            : 'border-white/[0.06] bg-[#070709]/38'
        }`}
      >
        {/* Top light catch, so the bar reads as a machined edge. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />

        <nav
          aria-label="Primary"
          className={`relative z-40 mx-auto flex w-full max-w-[1200px] items-center gap-2 px-3 transition-[height] duration-500 sm:px-6 md:gap-4 ${
            scrolled ? 'h-14' : 'h-14 sm:h-16'
          }`}
        >
          <Logo />

          <div className="flex min-w-0 flex-1 items-center justify-center">
            {/* Mobile: a single compact island for presence + streak. */}
            <div className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-0.5 md:hidden">
              <PartnerPresenceDot onOpen={() => setMobileOpen(true)} />
              <span className="h-3 w-px bg-white/[0.08]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-full text-left transition-colors hover:bg-white/[0.06]"
                aria-label="Open streak details and tools"
              >
                <StreakPill compact />
              </button>
            </div>

            {/* Desktop: presence, streak and cloud health in one frosted island. */}
            <div className="nav-island hidden items-center gap-0.5 rounded-full p-1 md:inline-flex">
              <PartnerPresencePill onOpenSettings={openSettings} />
              <span className="h-3.5 w-px bg-white/[0.09]" aria-hidden="true" />
              <StreakPill />
              <span className="hidden h-3.5 w-px bg-white/[0.09] xl:block" aria-hidden="true" />
              <span className="hidden xl:block">
                <SyncStatePill />
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <div className="hidden lg:block">
                <TodayButton />
              </div>
              <span className="hidden h-5 w-px bg-white/[0.08] lg:block" aria-hidden="true" />
              <InstallButton prompt={installPrompt} />
              <ToolsMenu onOpenSettings={openSettings} />
            </div>

            <div className="flex items-center gap-1.5 md:hidden">
              <InstallButton prompt={installPrompt} variant="icon" />
              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className={`icon-btn overflow-hidden ${mobileOpen ? 'border-white/[0.2] bg-white/[0.1] text-white' : ''}`}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="syncorbit-mobile-tools"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={mobileOpen ? 'close' : 'open'}
                    initial={{ rotate: -45, opacity: 0, scale: 0.8 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 45, opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="grid place-items-center"
                  >
                    {mobileOpen ? <X className="size-4" strokeWidth={2} /> : <Menu className="size-4" strokeWidth={2} />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile backdrop: portalled to <body> because the header's
            backdrop-filter would otherwise trap `fixed` inside a 56px box. */}
        {createPortal(
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 touch-none bg-black/45 backdrop-blur-[1px] md:hidden"
              />
            )}
          </AnimatePresence>,
          document.body,
        )}

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
