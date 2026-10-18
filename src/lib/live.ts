import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CHANNEL_NAME, PEER_HEARTBEAT_MS, PEER_TTL_MS } from '../lib/constants'
import { uid } from '../lib/storage'
import type { NudgeKind, OrbitState, SyncMessage } from '../lib/types'

export interface LiveSync {
  /** Number of *other* tabs currently connected. */
  peers: number
  /** True while a BroadcastChannel is actually available. */
  supported: boolean
  broadcastState: (state: OrbitState) => void
  broadcastNudge: (kind: NudgeKind) => void
}

interface Options {
  /** Apply a replica that arrived from another tab. */
  onState: (state: OrbitState) => void
  /** React to a nudge that another tab fired. */
  onNudge: (kind: NudgeKind) => void
}

/**
 * `BroadcastChannel('syncorbit_live_sync')` transport.
 *
 * Two windows open side by side converge at 0ms: every local mutation is
 * published as a full replica, and mergeStates() reconciles them. A light
 * heartbeat keeps a live peer count for the status badge.
 */
export function useLiveSync({ onState, onNudge }: Options): LiveSync {
  const [peers, setPeers] = useState(0)
  // Derived during render — no effect needed to publish channel support.
  const supported = typeof BroadcastChannel !== 'undefined'

  const channelRef = useRef<BroadcastChannel | null>(null)
  const selfRef = useRef<string>(uid())
  const peerMap = useRef(new Map<string, number>())

  // Stable refs so the channel never needs re-creating on re-render.
  const onStateRef = useRef(onState)
  const onNudgeRef = useRef(onNudge)
  useEffect(() => {
    onStateRef.current = onState
    onNudgeRef.current = onNudge
  }, [onState, onNudge])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel
    const peers = peerMap.current
    const self = selfRef.current

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object' || msg.from === self) return

      peers.set(msg.from, Date.now())
      setPeers(peers.size)

      switch (msg.t) {
        case 'state':
          onStateRef.current(msg.state)
          break
        case 'nudge':
          onNudgeRef.current(msg.kind)
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
      for (const [id, at] of peers) {
        if (at < cutoff) {
          peers.delete(id)
          mutated = true
        }
      }
      if (mutated) setPeers(peers.size)
    }, PEER_HEARTBEAT_MS)

    return () => {
      window.clearInterval(heartbeat)
      channel.onmessage = null
      channel.close()
      channelRef.current = null
      peers.clear()
    }
  }, [])

  const broadcastState = useCallback((state: OrbitState) => {
    const channel = channelRef.current
    if (!channel) return
    channel.postMessage({ t: 'state', from: selfRef.current, state } satisfies SyncMessage)
  }, [])

  const broadcastNudge = useCallback((kind: NudgeKind) => {
    const channel = channelRef.current
    if (!channel) return
    channel.postMessage({ t: 'nudge', from: selfRef.current, kind, at: Date.now() } satisfies SyncMessage)
  }, [])

  return { peers, supported, broadcastState, broadcastNudge }
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
