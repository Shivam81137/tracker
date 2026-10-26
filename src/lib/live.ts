import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CHANNEL_NAME, PEER_HEARTBEAT_MS, PEER_TTL_MS } from '../lib/constants'
import { uid } from '../lib/storage'
import { getUserIdentity as getCurrentUser, getFirebaseDbUrl as getFirebaseUrl } from './storage'

import type { PresenceInfo } from '../lib/types'
import { getPresenceEngine } from '../services/presence'

import type { NudgeKind, OrbitState, SyncMessage, SyncStatus } from '../lib/types'
import { getLiveCloudSync, type LiveCloudSyncEngine } from '../services/liveCloudSync'

export interface LiveSync {
  /** Number of other tabs/devices active. */
  peers: number
  /** True while network is available. */
  supported: boolean
  /** Cloud connection status: 'synced' | 'connecting' | 'offline' | 'error' */
  status: SyncStatus
  /** Timestamp of the last successful sync with cloud or peer */
  lastSyncedAt: number
  /** Indicator whether partner just pinged or sent updates */
  partnerActive: boolean
  /** Realtime presence info for partner */
  partnerPresence: PresenceInfo | null
  broadcastState: (state: OrbitState, partial?: OrbitState) => void
  broadcastNudge: (kind: NudgeKind, senderName?: string, icon?: string) => void
  forceSyncNow: () => Promise<boolean>
  updateFirebaseUrl: (url: string) => void
}


interface Options {
  /** Apply a replica that arrived from another tab or cloud. */
  onState: (
    state: OrbitState,
    meta?: { source?: 'local' | 'mqtt' | 'firebase' | 'http'; partial?: boolean },
  ) => void
  /** React to a nudge that partner or another tab fired. */
  onNudge: (kind: NudgeKind, from?: string, icon?: string) => void
}

/**
 * LiveSync transport with multi-layer cloud sync + BroadcastChannel.
 */
export function useLiveSync({ onState, onNudge }: Options): LiveSync {
  const [peers, setPeers] = useState(0)
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => Date.now())
  const [partnerActive, setPartnerActive] = useState<boolean>(false)

  const [partnerPresence, setPartnerPresence] = useState<PresenceInfo | null>(null)

  const supported = typeof window !== 'undefined'
  const channelRef = useRef<BroadcastChannel | null>(null)
  const selfRef = useRef<string>(uid())
  const peerMap = useRef<Map<string, number>>(new Map())
  const partnerActiveTimer = useRef<number | null>(null)

  const onStateRef = useRef(onState)
  const onNudgeRef = useRef(onNudge)
  useEffect(() => {
    onStateRef.current = onState
    onNudgeRef.current = onNudge
  }, [onState, onNudge])

  const markPartnerActive = useCallback(() => {
    setPartnerActive(true)
    setLastSyncedAt(Date.now())
    if (partnerActiveTimer.current !== null) {
      window.clearTimeout(partnerActiveTimer.current)
    }
    partnerActiveTimer.current = window.setTimeout(() => {
      setPartnerActive(false)
    }, 15000)
  }, [])

  useEffect(() => {
    getPresenceEngine({
      currentUser: getCurrentUser(),
      firebaseUrl: getFirebaseUrl(),
      onPartnerPresence: (info) => {
        setPartnerPresence(info)
        if (info && info.isOnline) {
          markPartnerActive()
        }
      },
    })
    return () => {
      // engine keeps running singleton
    }
  }, [markPartnerActive])

  const cloudEngineRef = useRef<LiveCloudSyncEngine | null>(null)

  useEffect(() => {
    const engine = getLiveCloudSync({
      onRemoteState: (cloudState, meta) => {
        markPartnerActive()
        onStateRef.current(cloudState, { source: meta.source, partial: meta.partial })
      },
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus)
      },
      onPeerActive: () => {
        markPartnerActive()
      },
    })
    cloudEngineRef.current = engine
    setStatus(engine.getStatus())
    setLastSyncedAt(engine.getLastSyncedAt() || Date.now())
  }, [markPartnerActive])

  // Returning to the app should feel instant: pull the latest replica and
  // refresh presence immediately instead of waiting for the next poll.
  useEffect(() => {
    const syncNow = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void cloudEngineRef.current?.fetchHttpState()
      try {
        getPresenceEngine().ping(true)
      } catch {
        /* presence engine is not mounted yet */
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncNow()
    }

    window.addEventListener('focus', syncNow)
    window.addEventListener('online', syncNow)
    window.addEventListener('pageshow', syncNow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', syncNow)
      window.removeEventListener('online', syncNow)
      window.removeEventListener('pageshow', syncNow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    const peersColl = peerMap.current
    const self = selfRef.current

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object' || msg.from === self) return

      peersColl.set(msg.from, Date.now())
      setPeers(peersColl.size)

      switch (msg.t) {
        case 'state':
          setLastSyncedAt(Date.now())
          onStateRef.current(msg.state, { source: 'local' })
          break
        case 'nudge':
          markPartnerActive()
          onNudgeRef.current(msg.kind, msg.senderName, msg.icon)
          break
        case 'ping':
          channel.postMessage({ t: 'pong', from: self, to: msg.from } satisfies SyncMessage)
          break
        case 'pong':
          break
        default:
          break
      }
    }

    channel.postMessage({ t: 'ping', from: self } satisfies SyncMessage)

    const heartbeat = window.setInterval(() => {
      channel.postMessage({ t: 'ping', from: self } satisfies SyncMessage)
      const cutoff = Date.now() - PEER_TTL_MS
      let mutated = false
      for (const [id, at] of peersColl) {
        if (at < cutoff) {
          peersColl.delete(id)
          mutated = true
        }
      }
      if (mutated) setPeers(peersColl.size)
    }, PEER_HEARTBEAT_MS)

    return () => {
      window.clearInterval(heartbeat)
      channel.onmessage = null
      channel.close()
      channelRef.current = null
      peersColl.clear()
    }
  }, [markPartnerActive])

  const broadcastState = useCallback((state: OrbitState, partial?: OrbitState) => {
    const channel = channelRef.current
    if (channel) {
      try {
        channel.postMessage({ t: 'state', from: selfRef.current, state } satisfies SyncMessage)
      } catch {}
    }

    if (cloudEngineRef.current) {
      if (partial) {
        cloudEngineRef.current.broadcastPartial(state, partial)
      } else {
        cloudEngineRef.current.broadcastState(state)
      }
      setLastSyncedAt(Date.now())
    }
  }, [])

  const broadcastNudge = useCallback((kind: NudgeKind, senderName?: string, icon?: string) => {
    const channel = channelRef.current
    if (channel) {
      try {
        channel.postMessage({
          t: 'nudge',
          from: selfRef.current,
          kind,
          senderName,
          icon,
          at: Date.now(),
        } satisfies SyncMessage)
      } catch {}
    }
  }, [])

  const forceSyncNow = useCallback(async (): Promise<boolean> => {
    if (cloudEngineRef.current) {
      setStatus('connecting')
      const success = await cloudEngineRef.current.fetchHttpState()
      setStatus(success ? 'synced' : 'connecting')
      if (success) setLastSyncedAt(Date.now())
      return success
    }
    return false
  }, [])

  const updateFirebaseUrl = useCallback((url: string) => {
    if (cloudEngineRef.current) {
      cloudEngineRef.current.updateFirebaseUrl(url)
    }
  }, [])

  return {
    peers,
    supported,
    status,
    lastSyncedAt,
    partnerActive,
    partnerPresence,
    broadcastState,
    broadcastNudge,
    forceSyncNow,
    updateFirebaseUrl,
  }
}

/* ------------------------------- online state ------------------------------ */

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

/** Reactive `navigator.onLine`. */
export function useOnline(): boolean {
  const getSnapshot = useCallback(() => (typeof navigator === 'undefined' ? true : navigator.onLine), [])
  return useSyncExternalStore(subscribeOnline, getSnapshot, () => true)
}
