import { useCallback, useEffect, useRef, useState } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'installed'

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
  return (navigator as unknown as { standalone?: boolean }).standalone === true
}

/**
 * Wraps `beforeinstallprompt`. Falls back to a descriptive outcome so the UI can
 * show a sleek toast when the browser never offers a native prompt (iOS Safari,
 * already-installed windows, unsupported engines).
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => detectStandalone())
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      deferredRef.current = promptEvent
      setDeferred(promptEvent)
    }

    const onInstalled = () => {
      deferredRef.current = null
      setDeferred(null)
      setInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    const media = window.matchMedia('(display-mode: standalone)')
    const onDisplayChange = () => setInstalled(detectStandalone())
    media.addEventListener('change', onDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      media.removeEventListener('change', onDisplayChange)
    }
  }, [])

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (installed) return 'installed'
    const promptEvent = deferredRef.current
    if (!promptEvent) return 'unavailable'
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      deferredRef.current = null
      setDeferred(null)
      return choice.outcome
    } catch {
      return 'unavailable'
    }
  }, [installed])

  return { install, installed, canPrompt: deferred !== null }
}
