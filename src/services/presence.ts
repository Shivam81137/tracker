import { getFirebaseDbUrl } from '../lib/storage'
import type { Person, PresenceInfo } from '../lib/types'

/**
 * Manages real-time presence heartbeats for Shivam & Noor using Firebase Realtime Database.
 */
export class PresenceEngine {
  private currentUser: Person | null = null
  private firebaseDbUrl = ''
  private timer: number | null = null
  private onPartnerPresence?: (info: PresenceInfo | null) => void
  private currentActivity = 'Active on Tracker'

  constructor(opts: {
    currentUser: Person | null
    firebaseUrl?: string
    onPartnerPresence?: (info: PresenceInfo | null) => void
  }) {
    this.currentUser = opts.currentUser
    this.firebaseDbUrl = opts.firebaseUrl || getFirebaseDbUrl()
    this.onPartnerPresence = opts.onPartnerPresence
  }

  public updateIdentity(user: Person | null, url?: string) {
    if (this.currentUser && this.currentUser !== user) {
      // Mark old user offline
      this.setOnlineStatus(false)
    }
    this.currentUser = user
    if (url !== undefined) {
      this.firebaseDbUrl = url
    }
    this.ping()
  }

  public setActivity(activity: string) {
    this.currentActivity = activity
    this.ping(true)
  }

  public start() {
    this.ping(true)
    // Heartbeat every 15s
    if (typeof window !== 'undefined') {
      this.timer = window.setInterval(() => {
        this.ping()
        this.pollPartner()
      }, 15000)

      window.addEventListener('beforeunload', this.handleUnload)
      window.addEventListener('visibilitychange', this.handleVisibility)
    }
  }

  public stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload)
      window.removeEventListener('visibilitychange', this.handleVisibility)
    }
    this.setOnlineStatus(false)
  }

  private handleUnload = () => {
    this.setOnlineStatus(false)
  }

  private handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      this.ping(true)
    } else {
      this.setOnlineStatus(false)
    }
  }

  private getBaseUrl(): string {
    const url = this.firebaseDbUrl || getFirebaseDbUrl()
    if (!url) return ''
    return url.replace(/\/+$/, '')
  }

  public async ping(forceSync = false) {
    if (!this.currentUser) return
    const baseUrl = this.getBaseUrl()
    if (!baseUrl) return

    const payload: PresenceInfo = {
      user: this.currentUser,
      isOnline: true,
      lastSeen: Date.now(),
      currentActivity: this.currentActivity,
    }

    try {
      const endpoint = `${baseUrl}/presence/${this.currentUser}.json`
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      // Ignore network errors in offline fallback
    }

    if (forceSync || Math.random() < 0.3) {
      this.pollPartner()
    }
  }

  private async setOnlineStatus(isOnline: boolean) {
    if (!this.currentUser) return
    const baseUrl = this.getBaseUrl()
    if (!baseUrl) return

    const payload: PresenceInfo = {
      user: this.currentUser,
      isOnline,
      lastSeen: Date.now(),
      currentActivity: this.currentActivity,
    }

    try {
      const endpoint = `${baseUrl}/presence/${this.currentUser}.json`
      // Use sendBeacon if unloading, else fetch
      if (!isOnline && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify(payload))
      } else {
        await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        })
      }
    } catch {}
  }

  public async pollPartner() {
    if (!this.currentUser) return
    const baseUrl = this.getBaseUrl()
    if (!baseUrl) {
      this.onPartnerPresence?.(null)
      return
    }

    const partner: Person = this.currentUser === 'shivam' ? 'noor' : 'shivam'
    try {
      const endpoint = `${baseUrl}/presence/${partner}.json`
      const res = await fetch(endpoint)
      if (!res.ok) {
        this.onPartnerPresence?.(null)
        return
      }
      const data: PresenceInfo | null = await res.json()
      if (!data || typeof data.lastSeen !== 'number') {
        this.onPartnerPresence?.(null)
        return
      }

      // Check if partner heartbeat is within 45 seconds
      const isStillOnline = data.isOnline && (Date.now() - data.lastSeen < 45000)
      this.onPartnerPresence?.({
        ...data,
        isOnline: isStillOnline,
      })
    } catch {
      this.onPartnerPresence?.(null)
    }
  }
}

let singletonPresence: PresenceEngine | null = null

export function getPresenceEngine(opts?: {
  currentUser: Person | null
  firebaseUrl?: string
  onPartnerPresence?: (info: PresenceInfo | null) => void
}): PresenceEngine {
  if (!singletonPresence && opts) {
    singletonPresence = new PresenceEngine(opts)
    singletonPresence.start()
  } else if (singletonPresence && opts) {
    if (opts.currentUser !== undefined || opts.firebaseUrl !== undefined) {
      singletonPresence.updateIdentity(opts.currentUser ?? null, opts.firebaseUrl)
    }
    if (opts.onPartnerPresence) {
      // re-assign callback or let it be
    }
  }
  return singletonPresence!
}
