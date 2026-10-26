import type { Accent, NudgeKind, Person, Priority } from './types'

/** Frame sequence extracted from the Red Velvet splash plate. */
export const FRAME_COUNT = 128
export const FRAME_DIR = '/frames'
export const FRAME_PREFIX = 'ezgif-frame-'
export const FRAME_PAD = 3

/** Path for a zero-based frame index. */
export function framePath(index: number): string {
  const clamped = Math.min(FRAME_COUNT - 1, Math.max(0, index))
  return `${FRAME_DIR}/${FRAME_PREFIX}${String(clamped + 1).padStart(FRAME_PAD, '0')}.jpg`
}

/** Smoothing factor for the scroll -> frame scrub (`0` = frozen, `1` = raw). */
export const SCRUB_LERP = 0.14

/** How many frames around the playhead stay decoded and warm. */
export const DECODE_WINDOW = 10

/** Max simultaneous in-flight image requests during preload. */
export const PRELOAD_CONCURRENCY = 8

export const BRAND = {
  name: 'syncorbit',
  mark: '✦',
  tagline: 'Daily sync for two',
} as const

export const STORAGE_KEY = 'syncorbit.state.v1'
export const SOUND_KEY = 'syncorbit.sound.v1'
export const DEVICE_KEY = 'syncorbit.device.v1'
export const CHANNEL_NAME = 'syncorbit_live_sync'
export const USER_IDENTITY_KEY = 'syncorbit.user_identity'
export const FIREBASE_URL_KEY = 'syncorbit.firebase_db_url'
export const CLOUD_ROOM_KEY = 'syncorbit_shivam_noor_v2'
export const MQTT_TOPIC = 'syncorbit/prod/shivam_noor_2026/state/v2'
/**
 * Public WebSocket brokers, tried in order. Coreflux and Tyckr consistently
 * give us the lowest browser round-trip time; the rest are resilience layers.
 */
export const MQTT_BROKERS = [
  'wss://iot.coreflux.cloud:443/mqtt',
  'wss://mqtt.tyckr.io:8081/mqtt',
  'wss://broker.connectmq.com:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
] as const
export const MQTT_BROKER_PRIMARY = MQTT_BROKERS[0]
export const MQTT_BROKER_FALLBACK = MQTT_BROKERS[1]
/** Presence heartbeat cadence for cross-device cloud presence. */
export const PRESENCE_HEARTBEAT_MS = 6000


export interface PartnerMeta {
  id: Person
  name: string
  /** Tailwind-friendly raw hex stops. */
  from: string
  to: string
  accent: Accent
  /** CSS colour used for canvas/particle work. */
  solid: string
  initial: string
}

export const PARTNERS: Record<Person, PartnerMeta> = {
  shivam: {
    id: 'shivam',
    name: 'Shivam',
    from: '#00F2FE',
    to: '#4FACFE',
    accent: 'shivam',
    solid: '#22D3EE',
    initial: 'S',
  },
  noor: {
    id: 'noor',
    name: 'Noor',
    from: '#FF0844',
    to: '#FFB199',
    accent: 'noor',
    solid: '#FB7185',
    initial: 'N',
  },
}

export const PARTNER_ORDER: Person[] = ['shivam', 'noor']

export const ACCENT_HEX: Record<Accent, string> = {
  shivam: '#00F2FE',
  noor: '#FB7185',
  sync: '#F59E0B',
  neutral: '#FFFFFF',
}

export interface NudgeMeta {
  kind: NudgeKind
  emoji: string
  label: string
  /** Verb shown in the toast body. */
  verb: string
  /** Root note (Hz) for the synthesised harmonic chime. */
  root: number
}

export const NUDGES: NudgeMeta[] = [
  { kind: 'boost', emoji: '⚡', label: 'Boost', verb: 'sent a boost', root: 659.25 },
  { kind: 'proud', emoji: '✦', label: 'Proud', verb: 'is proud of you', root: 783.99 },
  { kind: 'hydrate', emoji: '💧', label: 'Hydrate', verb: 'reminds you to hydrate', root: 880.0 },
  { kind: 'break', emoji: '☕', label: 'Break', verb: 'called a break', root: 523.25 },
]

export const NUDGE_MAP: Record<NudgeKind, NudgeMeta> = NUDGES.reduce(
  (acc, n) => ({ ...acc, [n.kind]: n }),
  {} as Record<NudgeKind, NudgeMeta>,
)

export interface PriorityMeta {
  id: Priority
  label: string
  short: string
  /** Raw hex used for inline styles (active pill). */
  hex: string
}

export const PRIORITIES: PriorityMeta[] = [
  { id: 'high', label: 'High', short: 'HIGH', hex: '#FF0844' },
  { id: 'med', label: 'Med', short: 'MED', hex: '#F59E0B' },
  { id: 'chill', label: 'Chill', short: 'CHILL', hex: '#00F2FE' },
]

export const PRIORITY_MAP: Record<Priority, PriorityMeta> = PRIORITIES.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<Priority, PriorityMeta>,
)

/** Keep the nudge log bounded. */
export const NUDGE_LOG_LIMIT = 40
/** Tombstones are garbage-collected after this window. */
export const TOMBSTONE_TTL_MS = 1000 * 60 * 60 * 24 * 7
/** Peer heartbeat cadence for live-tab presence. */
export const PEER_HEARTBEAT_MS = 4000
export const PEER_TTL_MS = 11_000
