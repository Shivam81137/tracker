import mqtt from 'mqtt'
import {
  CLOUD_ROOM_KEY,
  MQTT_BROKER_FALLBACK,
  MQTT_BROKER_PRIMARY,
  MQTT_TOPIC,
} from '../lib/constants'
import { getDeviceId, getFirebaseDbUrl, sanitizeState } from '../lib/storage'
import type { OrbitState, SyncStatus } from '../lib/types'

// Public shared fallback JSON bin on jsonblob.com
// Room: syncorbit_shivam_noor_v2
const JSONBLOB_SHARED_ID = '1342571216550739968'
const JSONBLOB_URL = `https://jsonblob.com/api/jsonBlob/${JSONBLOB_SHARED_ID}`
const VERCEL_API_SYNC = '/api/sync'

export interface CloudSyncOptions {
  onRemoteState: (state: OrbitState, meta: { source: 'mqtt' | 'firebase' | 'http' }) => void
  onStatusChange?: (status: SyncStatus) => void
  onPeerActive?: () => void
}

interface StateEnvelope {
  __author: string
  __updatedAt: number
  state: OrbitState
}

export class LiveCloudSyncEngine {
  private options: CloudSyncOptions
  private mqttClient: mqtt.MqttClient | null = null
  private eventSource: EventSource | null = null
  private pollTimer: number | null = null
  private status: SyncStatus = 'connecting'
  private deviceId: string
  private isDestroyed = false
  private currentFirebaseUrl = ''
  private lastSyncedAt = 0
  private lastSentHash = ''

  constructor(options: CloudSyncOptions) {
    this.options = options
    this.deviceId = getDeviceId()
    this.currentFirebaseUrl = getFirebaseDbUrl()
  }

  public start() {
    this.initMqtt()
    this.initFirebase()
    this.initHttpPolling()
    this.triggerInitialFetch()
  }

  public getStatus(): SyncStatus {
    return this.status
  }

  public getLastSyncedAt(): number {
    return this.lastSyncedAt
  }

  public updateFirebaseUrl(url: string) {
    this.currentFirebaseUrl = url
    if (this.eventSource) {
      try {
        this.eventSource.close()
      } catch {}
      this.eventSource = null
    }
    this.initFirebase()
  }

  /* -------------------------------------------------------------------------- */
  /*                      LAYER 1: MQTT OVER WSS WITH RETAIN                    */
  /* -------------------------------------------------------------------------- */

  private initMqtt(brokerUrl: string = MQTT_BROKER_PRIMARY) {
    if (this.isDestroyed) return

    try {
      const clientId = `syncorbit_${this.deviceId.slice(0, 8)}_${Math.random().toString(16).slice(2, 6)}`
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 6000,
        keepalive: 30,
      })

      this.mqttClient = client

      client.on('connect', () => {
        if (this.isDestroyed) return
        this.setStatus('synced')
        this.lastSyncedAt = Date.now()

        // Subscribe to shared state topic with QoS 1
        client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
          if (err) {
            console.warn('[MQTT] Subscribe error:', err)
          }
        })
      })

      client.on('message', (topic, payload) => {
        if (this.isDestroyed) return
        if (topic !== MQTT_TOPIC) return

        try {
          const rawStr = payload.toString('utf-8')
          if (!rawStr) return

          const parsed = JSON.parse(rawStr) as Partial<StateEnvelope>
          if (parsed && parsed.__author === this.deviceId) {
            return
          }

          const rawState = parsed.state || parsed
          const sanitized = sanitizeState(rawState)
          this.lastSyncedAt = Date.now()
          this.setStatus('synced')
          this.options.onPeerActive?.()
          this.options.onRemoteState(sanitized, { source: 'mqtt' })
        } catch (err) {
          console.warn('[MQTT] parse message error:', err)
        }
      })

      client.on('error', (err) => {
        console.warn('[MQTT] connection error on', brokerUrl, err)
        if (brokerUrl === MQTT_BROKER_PRIMARY) {
          try {
            client.end(true)
          } catch {}
          this.initMqtt(MQTT_BROKER_FALLBACK)
        } else {
          if (this.status !== 'synced') {
            this.setStatus('connecting')
          }
        }
      })

      client.on('offline', () => {
        if (this.status !== 'synced') {
          this.setStatus('connecting')
        }
      })
    } catch (err) {
      console.warn('[MQTT] init failed:', err)
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                      LAYER 2: FIREBASE REALTIME DB (SSE)                   */
  /* -------------------------------------------------------------------------- */

  private initFirebase() {
    if (this.isDestroyed) return
    const fbUrl = this.currentFirebaseUrl || getFirebaseDbUrl()
    if (!fbUrl) return

    try {
      let base = fbUrl.replace(/\/+$/, '')
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `https://${base}`
      }
      const sseUrl = `${base}/${CLOUD_ROOM_KEY}.json`
      const source = new EventSource(sseUrl)
      this.eventSource = source

      source.onopen = () => {
        this.setStatus('synced')
        this.lastSyncedAt = Date.now()
      }

      source.onmessage = (event) => {
        if (this.isDestroyed) return
        try {
          const payload = JSON.parse(event.data)
          if (!payload) return

          // Firebase SSE format: { path: "/", data: ... }
          const envelope = (payload.path === '/' ? payload.data : payload) as Partial<StateEnvelope>
          if (!envelope || envelope.__author === this.deviceId) return

          const rawState = envelope.state || envelope
          const sanitized = sanitizeState(rawState)
          this.lastSyncedAt = Date.now()
          this.setStatus('synced')
          this.options.onPeerActive?.()
          this.options.onRemoteState(sanitized, { source: 'firebase' })
        } catch {}
      }

      source.onerror = () => {}
    } catch (err) {
      console.warn('[Firebase SSE] init error:', err)
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                  LAYER 1 FALLBACK: HTTP POLLING & REST                     */
  /* -------------------------------------------------------------------------- */

  private initHttpPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer)
    }

    // Every 8 seconds when tab is visible
    this.pollTimer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.fetchHttpState()
      }
    }, 8000)
  }

  private async triggerInitialFetch() {
    await this.fetchHttpState()
  }

  public async fetchHttpState(): Promise<boolean> {
    if (this.isDestroyed) return false

    // 1. Try Vercel Serverless Function first
    try {
      const res = await fetch(VERCEL_API_SYNC, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const json = await res.json()
        if (json && json.state && !json.empty) {
          const sanitized = sanitizeState(json.state)
          this.lastSyncedAt = Date.now()
          this.setStatus('synced')
          this.options.onRemoteState(sanitized, { source: 'http' })
          return true
        }
      }
    } catch {}

    // 2. Try shared JSONBlob
    try {
      const res = await fetch(JSONBLOB_URL, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.__author !== this.deviceId) {
          const rawState = data.state || data
          if (rawState && (rawState.tasks || rawState.version)) {
            const sanitized = sanitizeState(rawState)
            this.lastSyncedAt = Date.now()
            this.setStatus('synced')
            this.options.onRemoteState(sanitized, { source: 'http' })
            return true
          }
        }
      } else if (res.status === 404) {
        const initialPayload = {
          __author: this.deviceId,
          __updatedAt: Date.now(),
          state: { version: 1, tasks: [], nudges: [], tombstones: {} },
        }
        await fetch('https://jsonblob.com/api/jsonBlob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(initialPayload),
        }).catch(() => {})
      }
    } catch (err) {
      console.warn('[HTTP Sync] fetch error:', err)
    }

    return false
  }

  /* -------------------------------------------------------------------------- */
  /*                      BROADCAST MUTATIONS ACROSS ALL LAYERS                 */
  /* -------------------------------------------------------------------------- */

  public broadcastState(state: OrbitState) {
    if (this.isDestroyed) return

    const envelope: StateEnvelope = {
      __author: this.deviceId,
      __updatedAt: Date.now(),
      state,
    }

    const payloadStr = JSON.stringify(envelope)

    if (payloadStr === this.lastSentHash) {
      return
    }
    this.lastSentHash = payloadStr

    // 1. MQTT publish with retain: true and QoS 1
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(MQTT_TOPIC, payloadStr, { qos: 1, retain: true }, (err) => {
          if (err) {
            console.warn('[MQTT] publish error:', err)
          } else {
            this.lastSyncedAt = Date.now()
            this.setStatus('synced')
          }
        })
      } catch (err) {
        console.warn('[MQTT] publish exception:', err)
      }
    }

    // 2. Firebase PUT
    const fbUrl = this.currentFirebaseUrl || getFirebaseDbUrl()
    if (fbUrl) {
      let base = fbUrl.replace(/\/+$/, '')
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `https://${base}`
      }
      fetch(`${base}/${CLOUD_ROOM_KEY}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      })
        .then(() => {
          this.lastSyncedAt = Date.now()
          this.setStatus('synced')
        })
        .catch(() => {})
    }

    // 3. Vercel Serverless Function /api/sync
    fetch(VERCEL_API_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
    }).catch(() => {})

    // 4. jsonblob.com
    fetch(JSONBLOB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payloadStr,
    }).catch(() => {})
  }

  private setStatus(status: SyncStatus) {
    if (this.status !== status) {
      this.status = status
      this.options.onStatusChange?.(status)
    }
  }

  public destroy() {
    this.isDestroyed = true
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true)
      } catch {}
      this.mqttClient = null
    }
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
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

