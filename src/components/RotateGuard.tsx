import { useEffect } from 'react'
import { Smartphone } from 'lucide-react'

type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'portrait') => Promise<void> }

/**
 * Keeps the app vertical on phones.
 *
 * 1. Where the browser allows it (installed PWA / fullscreen on Android) the
 *    screen is locked to portrait. The manifest also declares portrait.
 * 2. Everywhere else (iPhone Safari, regular browser tabs) orientation cannot be
 *    locked, so a landscape phone sees a "rotate your phone" screen instead.
 *    The overlay is pure CSS and only matches touch devices with a phone-sized
 *    height, so tablets and desktops are unaffected.
 */
export function RotateGuard() {
  useEffect(() => {
    const orientation = window.screen?.orientation as LockableOrientation | undefined
    if (!orientation?.lock) return
    const isPhone = window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches
    if (!isPhone) return
    // Rejects outside fullscreen/installed mode; the overlay covers that case.
    orientation.lock('portrait').catch(() => {})
  }, [])

  return (
    <div className="rotate-guard" role="alert" aria-live="polite">
      <Smartphone className="size-12 rotate-90 text-[#FF6B8A]" strokeWidth={1.5} aria-hidden="true" />
      <p className="font-display text-[18px] font-semibold tracking-tight">Please rotate your phone</p>
      <p className="max-w-xs text-[13px] leading-relaxed text-white/60">SyncOrbit is made to be used upright.</p>
    </div>
  )
}
