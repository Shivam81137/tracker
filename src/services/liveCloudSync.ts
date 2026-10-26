import mqtt from 'mqtt'
import { CLOUD_ROOM_KEY, MQTT_BROKERS, MQTT_TOPIC } from '../lib/constants'
import { getDeviceId, getFirebaseDbUrl, isBlankState, sanitizeState } from '../lib/storage'
import type { OrbitState, SyncStatus } from '../lib/types'

const VERCEL_API_SYNC = '/api/sync'
const MQTT_CONNECT_TIMEOUT_MS = 6500
const MQTT_RETRY_DELAY_MS = 1200
const CLOUD_BROADCAST_DEBOUNCE_MS = 70
const RETAINED_WAIT_MS = 420
const PAYLOAD_PREFIX = 'gz1:'

function supportsCompression(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export interface CloudSyncOptions {
  onRemoteState: (
    state: OrbitState,
    meta: { source: 'mqtt' | 'firebase' | 'http'; partial?: boolean },
  ) => void
  onStatusChange?: (status: SyncStatus) => void
  onPeerActive?: () => void
}

interface StateEnvelope {
  __author: string
  __updatedAt: number
  __partial?: boolean
  state: OrbitState
}

/**
 * Multi-layer live sync:
 *  1. MQTT over secure WebSocket (Coreflux -> Tyckr -> ConnectMQ -> HiveMQ -> EMQX -> Mosquitto).
 *  2. Firebase Realtime Database stream (when a DB URL is configured).
 *  3. Same-origin Vercel sync function + fast polling as a fallback.
 *
 * MQTT connections are managed manually so a blocked/offline broker can never
 * strand the app on a dead socket. Each layer marks the app as synced as soon
 * as it receives or sends real data.
 */
export class LiveCloudSyncEngine {
  private options: CloudSyncOptions
  private mqttClient: mqtt.MqttClient | null = null
  private eventSource: EventSource | null = null
  private pollTimer: number | null = null
  private brokerRetryTimer: number | null = null
  private cloudBroadcastTimer: number | null = null
  private fullRefreshTimer: number | null = null
  private firebasePatchTimer: number | null = null
  private status: SyncStatus = 'connecting'
  private deviceId: string
  private isDestroyed = false
  private currentFirebaseUrl = ''
  private lastSyncedAt = 0
  private latestState: OrbitState | null = null
  private pendingState: OrbitState | null = null
  private brokerIndex = 0
  private mqttConnected = false
  private firebaseConnected = false
  private fetching = false
  private awaitingRetained = false

  constructor(options: CloudSyncOptions) {
    this.options = options
    this.deviceId = getDeviceId()
    this.currentFirebaseUrl = getFirebaseDbUrl()
  }

  public start() {
    this.initMqtt()
    this.initFirebase()
    this.initHttpPolling()
    void this.fetchHttpState()
  }

  public getStatus(): SyncStatus {
    return this.status
  }

  public getLastSyncedAt(): number {
    return this.lastSyncedAt
  }

  public updateFirebaseUrl(url: string) {
    this.currentFirebaseUrl = url
    this.closeFirebaseStream()
    this.initFirebase()
    if (url) void this.fetchHttpState()
  }

  private get realtimeConnected(): boolean {
    return this.mqttConnected || this.firebaseConnected
  }

  private markSynced() {
    this.lastSyncedAt = Date.now()
    this.setStatus('synced')
  }

  /* -------------------------------------------------------------------------- */
  /*                      LAYER 1: MQTT OVER WSS WITH RETAIN                    */
  /* -------------------------------------------------------------------------- */

  private initMqtt() {
    if (this.isDestroyed) return

    if (this.brokerRetryTimer !== null) {
      window.clearTimeout(this.brokerRetryTimer)
      this.brokerRetryTimer = null
    }
    this.disposeMqtt()

    const brokerUrl = MQTT_BROKERS[this.brokerIndex % MQTT_BROKERS.length]
    let replaced = false
    let connectTimer: number | null = null
    let client: mqtt.MqttClient

    const rotate = (reason: string) => {
      if (replaced || this.isDestroyed) return
      replaced = true
      if (connectTimer !== null) {
        window.clearTimeout(connectTimer)
        connectTimer = null
      }
      this.mqttConnected = false
      this.awaitingRetained = false
      if (this.mqttClient === client) this.mqttClient = null
      try {
        client.end(true)
      } catch {}
      console.warn('[MQTT] switching broker:', brokerUrl, reason)
      this.brokerIndex += 1
      this.scheduleBrokerRetry()
    }

    try {
      const clientId = `syncorbit_${this.deviceId.slice(0, 8)}_${Math.random().toString(16).slice(2, 6)}`
      client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: MQTT_CONNECT_TIMEOUT_MS,
        // We rotate brokers ourselves; an auto-reconnect loop against a blocked
        // broker would prevent the next fallback from ever being tried.
        reconnectPeriod: 0,
        keepalive: 30,
      })
    } catch (err) {
      console.warn('[MQTT] init failed:', err)
      this.brokerIndex += 1
      this.scheduleBrokerRetry()
      return
    }

    this.mqttClient = client

    connectTimer = window.setTimeout(() => {
      if (!client.connected) rotate('connect timeout')
    }, MQTT_CONNECT_TIMEOUT_MS + 500)

    client.on('connect', () => {
      if (this.isDestroyed || replaced) return
      if (connectTimer !== null) {
        window.clearTimeout(connectTimer)
        connectTimer = null
      }
      this.mqttConnected = true
      this.markSynced()
      this.awaitingRetained = true

      client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
        if (err) {
          console.warn('[MQTT] subscribe error:', err)
          this.awaitingRetained = false
          return
        }

        // Let the broker deliver its retained snapshot before we publish ours.
        // Publishing in the SUBACK callback can overwrite the partner's state
        // before it is ever applied, which makes fresh devices appear stale.
        window.setTimeout(() => {
          if (this.isDestroyed || replaced || this.mqttClient !== client) return
          this.awaitingRetained = false
          if (this.latestState && client.connected) {
            void this.publishLatest(client)
          }
        }, RETAINED_WAIT_MS)
      })
    })

    client.on('message', (topic, payload) => {
      if (this.isDestroyed || topic !== MQTT_TOPIC) return
      void (async () => {
        try {
          const raw = payload.toString('utf-8')
          if (!raw) return
          const parsed = await this.decodePayload(raw)
          this.applyEnvelope(parsed, 'mqtt', true)
        } catch (err) {
          console.warn('[MQTT] parse message error:', err)
        }
      })()
    })

    client.on('error', (err) => {
      console.warn('[MQTT] connection error on', brokerUrl, err)
      rotate('error')
    })

    client.on('offline', () => {
      this.mqttConnected = false
      rotate('offline')
    })

    client.on('close', () => {
      if (this.mqttClient === client) rotate('close')
    })
  }

  private scheduleBrokerRetry() {
    if (this.isDestroyed || this.brokerRetryTimer !== null) return
    this.brokerRetryTimer = window.setTimeout(() => {
      this.brokerRetryTimer = null
      this.initMqtt()
    }, MQTT_RETRY_DELAY_MS)
  }

  private disposeMqtt() {
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true)
      } catch {}
      this.mqttClient = null
    }
    this.mqttConnected = false
    this.awaitingRetained = false
  }

  private publishMqtt(payloadStr: string, retain = true) {
    const client = this.mqttClient
    if (!client || !client.connected) return
    try {
      client.publish(MQTT_TOPIC, payloadStr, { qos: 1, retain }, (err) => {
        if (err) {
          console.warn('[MQTT] publish error:', err)
          return
        }
        this.markSynced()
      })
    } catch (err) {
      console.warn('[MQTT] publish exception:', err)
    }
  }

  private async publishLatest(client: mqtt.MqttClient) {
    const state = this.latestState
    if (!state || isBlankState(state) || !client.connected || this.mqttClient !== client) return
    const payload = await this.encodePayload(this.buildPayload(state))
    if (client.connected && this.mqttClient === client) this.publishMqtt(payload)
  }

  private async publishPayload(json: string, retain = true) {
    const payload = await this.encodePayload(json)
    this.publishMqtt(payload, retain)
  }

  private async encodePayload(json: string): Promise<string> {
    if (!supportsCompression()) return json
    try {
      const compressed = await new Response(
        new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),
      ).arrayBuffer()
      return PAYLOAD_PREFIX + bytesToBase64(new Uint8Array(compressed))
    } catch {
      return json
    }
  }

  private async decodePayload(raw: string): Promise<unknown> {
    if (!raw.startsWith(PAYLOAD_PREFIX)) return JSON.parse(raw)
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream unavailable')
    }
    const bytes = base64ToBytes(raw.slice(PAYLOAD_PREFIX.length))
    const json = await new Response(
      new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).text()
    return JSON.parse(json)
  }

  /* -------------------------------------------------------------------------- */
  /*                      LAYER 2: FIREBASE REALTIME DB (SSE)                   */
  /* -------------------------------------------------------------------------- */

  private getFirebaseBase(): string {
    const raw = this.currentFirebaseUrl || getFirebaseDbUrl()
    if (!raw) return ''
    let base = raw.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`
    return base
  }

  private closeFirebaseStream() {
    if (this.eventSource) {
      try {
        this.eventSource.close()
      } catch {}
      this.eventSource = null
    }
    this.firebaseConnected = false
  }

  private initFirebase() {
    if (this.isDestroyed) return
    const base = this.getFirebaseBase()
    if (!base) return

    this.closeFirebaseStream()

    try {
      const source = new EventSource(`${base}/${CLOUD_ROOM_KEY}.json`)
      this.eventSource = source

      source.onopen = () => {
        if (this.isDestroyed) return
        this.firebaseConnected = true
        this.markSynced()
      }

      // Firebase RTDB streams *named* events (`put`, `patch`, keep-alive...).
      // EventSource.onmessage only receives unnamed events, so listening for
      // these explicitly is what makes Firebase updates arrive instantly.
      const onStream = (event: Event) => {
        if (this.isDestroyed) return
        const message = event as MessageEvent<string>
        this.handleFirebaseEvent(message.data)
      }
      source.addEventListener('put', onStream)
      source.addEventListener('patch', onStream)
      source.addEventListener('keep-alive', () => {
        if (!this.isDestroyed) this.markSynced()
      })
      source.addEventListener('cancel', () => {
        this.firebaseConnected = false
        try {
          source.close()
        } catch {}
        if (this.eventSource === source) this.eventSource = null
      })
      source.addEventListener('auth_revoked', () => {
        this.firebaseConnected = false
        this.setStatus('error')
      })

      // Older payloads without a named event still work.
      source.onmessage = onStream
      source.onerror = () => {
        this.firebaseConnected = false
        if (!this.realtimeConnected && this.status !== 'synced') {
          this.setStatus('connecting')
        }
      }
    } catch (err) {
      console.warn('[Firebase SSE] init error:', err)
    }
  }

  private handleFirebaseEvent(raw: string) {
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as { path?: string; data?: unknown }
      if (!payload || payload.data === undefined || payload.data === null) return

      // A full snapshot at the room root is applied directly.
      if (this.applyEnvelope(payload.data, 'firebase', true)) return

      // A nested patch can't be merged blindly. Re-read the room snapshot
      // instead of dropping the change.
      if (this.firebasePatchTimer !== null) {
        window.clearTimeout(this.firebasePatchTimer)
      }
      this.firebasePatchTimer = window.setTimeout(() => {
        this.firebasePatchTimer = null
        void this.fetchHttpState()
      }, 80)
    } catch {}
  }

  private async fetchFirebaseState(): Promise<boolean> {
    const base = this.getFirebaseBase()
    if (!base) return false
    try {
      const res = await fetch(`${base}/${CLOUD_ROOM_KEY}.json`, {
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) return false
      const data = await res.json()
      if (!data) return false
      return this.applyEnvelope(data, 'firebase', false)
    } catch {
      return false
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                  LAYER 3: HTTP POLLING & SAME-ORIGIN API                   */
  /* -------------------------------------------------------------------------- */

  private initHttpPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer)
    }

    // Fast fallback when realtime is unavailable; a slow safety net otherwise.
    this.pollTimer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (this.realtimeConnected && Date.now() - this.lastSyncedAt < 15000) return
      void this.fetchHttpState()
    }, 2500)
  }

  public async fetchHttpState(): Promise<boolean> {
    if (this.isDestroyed || this.fetching) return false
    this.fetching = true
    try {
      // Firebase is the best persistent source when it is configured.
      if (await this.fetchFirebaseState()) return true

      // Same-origin serverless fallback (production only).
      try {
        const res = await fetch(VERCEL_API_SYNC, {
          cache: 'no-store',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        })
        if (res.ok) {
          const json = (await res.json()) as { state?: unknown; empty?: boolean }
          if (json && !json.empty && json.state) {
            return this.applyEnvelope(json.state, 'http', false)
          }
        }
      } catch {}

      return false
    } finally {
      this.fetching = false
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                      BROADCAST MUTATIONS ACROSS LAYERS                     */
  /* -------------------------------------------------------------------------- */

  public broadcastState(state: OrbitState) {
    if (this.isDestroyed) return
    this.latestState = state
    this.pendingState = state
    if (this.cloudBroadcastTimer !== null) return

    // Coalesce bursts (typing in the scratchpad, rapid toggles) into one
    // cross-device payload without making the local UI wait.
    this.cloudBroadcastTimer = window.setTimeout(() => {
      this.cloudBroadcastTimer = null
      const next = this.pendingState
      this.pendingState = null
      if (next) this.flushBroadcast(next)
    }, CLOUD_BROADCAST_DEBOUNCE_MS)
  }

  /**
   * Fast path for routine edits: publish only the changed tasks (plus the
   * small top-level fields) as a non-retained patch. The broker's retained
   * snapshot stays full, and a coalesced full refresh follows shortly after.
   */
  public broadcastPartial(fullState: OrbitState, partialState: OrbitState) {
    if (this.isDestroyed) return
    this.latestState = fullState
    if (this.awaitingRetained) return

    const payloadStr = this.buildPayload(partialState, true)
    void this.publishPayload(payloadStr, false)
    this.scheduleFullRefresh()
  }

  private scheduleFullRefresh() {
    if (this.isDestroyed) return
    if (this.fullRefreshTimer !== null) window.clearTimeout(this.fullRefreshTimer)
    this.fullRefreshTimer = window.setTimeout(() => {
      this.fullRefreshTimer = null
      const state = this.latestState
      if (state) this.flushBroadcast(state)
    }, 900)
  }

  private flushBroadcast(state: OrbitState) {
    if (this.isDestroyed) return
    if (this.fullRefreshTimer !== null) {
      window.clearTimeout(this.fullRefreshTimer)
      this.fullRefreshTimer = null
    }
    this.latestState = state
    const payloadStr = this.buildPayload(state)

    // 1. MQTT retained publish: gzip keeps the 45-50 KB replica under ~10 KB,
    // which cuts public-broker round-trip time dramatically. While a freshly
    // connected client is waiting for the broker's retained snapshot, hold our
    // publish so we cannot erase the partner's state before applying it.
    if (!this.awaitingRetained) void this.publishPayload(payloadStr)

    // 2. Firebase PUT when configured.
    const base = this.getFirebaseBase()
    if (base) {
      void fetch(`${base}/${CLOUD_ROOM_KEY}.json`, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      })
        .then((res) => {
          if (res.ok) this.markSynced()
        })
        .catch(() => {})
    }

    // 3. Same-origin serverless relay (production fallback).
    void fetch(VERCEL_API_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
    })
      .then((res) => {
        if (res.ok) this.markSynced()
      })
      .catch(() => {})
  }

  private buildPayload(state: OrbitState, partial = false): string {
    const envelope: StateEnvelope = {
      __author: this.deviceId,
      __updatedAt: Date.now(),
      ...(partial ? { __partial: true } : {}),
      state,
    }
    return JSON.stringify(envelope)
  }

  private applyEnvelope(data: unknown, source: 'mqtt' | 'firebase' | 'http', peerActive: boolean): boolean {
    if (!data || typeof data !== 'object') return false
    const record = data as Record<string, unknown>
    if (record.__author === this.deviceId) return false

    const rawState = record.state && typeof record.state === 'object' ? record.state : record
    if (!rawState || typeof rawState !== 'object') return false
    const stateRecord = rawState as Record<string, unknown>
    if (!('tasks' in stateRecord) && !('version' in stateRecord)) return false

    const partial = record.__partial === true
    const sanitized = sanitizeState(stateRecord)
    // Keep the latest replica ready for the next reconnect. A partial patch
    // must never replace the full local snapshot, and an empty fallback
    // replica must not erase a real snapshot that is still hydrating.
    if (
      !partial &&
      !(isBlankState(sanitized) && this.latestState && !isBlankState(this.latestState))
    ) {
      this.latestState = sanitized
    }
    this.markSynced()
    if (peerActive) this.options.onPeerActive?.()
    this.options.onRemoteState(sanitized, { source, partial })
    return true
  }

  private setStatus(status: SyncStatus) {
    if (this.status !== status) {
      this.status = status
      this.options.onStatusChange?.(status)
    }
  }

  public destroy() {
    this.isDestroyed = true
    this.disposeMqtt()
    this.closeFirebaseStream()
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.brokerRetryTimer !== null) {
      window.clearTimeout(this.brokerRetryTimer)
      this.brokerRetryTimer = null
    }
    if (this.cloudBroadcastTimer !== null) {
      window.clearTimeout(this.cloudBroadcastTimer)
      this.cloudBroadcastTimer = null
    }
    if (this.fullRefreshTimer !== null) {
      window.clearTimeout(this.fullRefreshTimer)
      this.fullRefreshTimer = null
    }
    if (this.firebasePatchTimer !== null) {
      window.clearTimeout(this.firebasePatchTimer)
      this.firebasePatchTimer = null
    }
  }
}

let singletonEngine: LiveCloudSyncEngine | null = null

export function getLiveCloudSync(options?: CloudSyncOptions): LiveCloudSyncEngine {
  if (!singletonEngine && options) {
    singletonEngine = new LiveCloudSyncEngine(options)
    singletonEngine.start()
  }
  return singletonEngine!
}
