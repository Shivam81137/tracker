import { motion } from 'framer-motion'
import { Heart, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { playUiTick } from '../lib/audio'

/**
 * The note is built from three banks of phrases. Every combination produces a
 * different full line, and the used combinations are remembered so the next
 * refresh never serves the same one twice.
 */
const OPENERS = [
  'Noor,',
  'Hey Noor,',
  'Listen, Noor,',
  'My Noor,',
  'Okay, Noor,',
  'Noor, seriously,',
  'Just so you know, Noor,',
  'Between us, Noor,',
  'Noor, my love,',
  'Noor, sunshine,',
  'Noor, trouble,',
  'Noor, my favorite human,',
  'Noor, my favorite notification,',
  'Noor, my favorite chaos,',
  'Noor, my favorite person,',
  'Noor, my favorite everything,',
] as const

const COMPLIMENTS = [
  "you're the only notification I'd drop everything for",
  "you're my favorite plot twist",
  "you're the reason my productivity graph has a beautiful little dip",
  "you're the only competition I'd happily lose to",
  "you're my favorite bad idea and my best decision",
  "you're the main character and I'm happy to be in the scene",
  "you're the only person I'd share my last slice with",
  "you're the one who makes a boring day feel like a plot twist",
  "you're the only person who can steal my blanket and my attention",
  "you're the reason I check my phone like it owes me money",
  "you're the only plan I'd cancel my plans for",
  "you're the chaos I'd willingly organize my life around",
  "you're the softest thought in my loudest day",
  "you're the only person who makes my heart lag",
  "you're the reason my focus graph looks like a rollercoaster",
  "you're the only person I'd fight a hundred bugs for",
  "you're the only person I'd read the docs for",
  "you're the plot twist I'd reread a hundred times",
  "you're the only person who can make me smile at a notification",
  "you're the one person I'd choose in every version of the world",
  "you're my favorite reason to be late",
  "you're the only person who can make a Monday feel like a Friday",
  "you're the only person I'd let win an argument",
  "you're the only person I'd share my headphones with",
  "you're the only person I'd let pick the playlist",
  "you're the only person I'd watch a bad movie for",
  "you're the only person I'd brave the group chat for",
  "you're the only person I'd let steal the last fry",
  "you're the only person I'd share my charger with",
  "you're the only person I'd let interrupt my focus mode",
  "you're the only person I'd break my sleep schedule for",
  "you're the only person I'd happily lose track of time with",
  "you're the only person I'd choose over a quiet evening",
  "you're the only person who can make me forget my password",
  "you're the only person I'd let beat me at my favorite game",
  "you're the only person I'd share my doom-scroll with",
  "you're the only person I'd let see my messy drafts",
  "you're the only person I'd ask to stay",
  "you're the only person I'd make a playlist for",
  "you're the only person I'd learn a new recipe for",
  "you're the only person I'd share my silence with",
  "you're the only person who makes my heart do a software update",
  "you're the only person I'd let crash my focus session",
  "you're the only person I'd send a voice note to",
  "you're the only person I'd wait for",
  "you're the only person I'd choose on a bad day",
  "you're the only person I'd choose on a good day",
  "you're the only person I'd choose on a random Tuesday",
  "you're the only person I'd choose in a crowded room",
  "you're the only person I'd choose in a quiet room",
  "you're the only person I'd choose without a second thought",
] as const

const FOLLOW_UPS = [
  'Stay by my side — the rest of the world can wait.',
  'The rest can take a number.',
  "I'm not even pretending to be normal about you.",
  'Everyone else can wait their turn.',
  "I'd choose you again, in a heartbeat.",
  "You plus me, side by side — that's the whole plan.",
  "Don't make me regret sharing my last slice.",
  "I'm not sorry about it.",
  "That's just the truth.",
  "And I'm not even trying to be subtle.",
  'So stay close, okay?',
  'The world can wait.',
  "I'd do it all again.",
  "And I'd still pick you.",
  "Keep stealing the blanket; I'll keep pretending to be annoyed.",
  'My productivity can recover; my crush on you cannot.',
  "I'll keep the bugs; you keep the sparkle.",
  "That's the only sync rate I care about.",
  "I'm keeping you.",
  'No refunds.',
  "Consider this your official warning: I'm obsessed.",
  "You've been warned.",
  "I'm not taking questions.",
  "That's my final answer.",
  "I'd say it again.",
  "I'll be here.",
  'Right here, by your side.',
  'Always.',
  'Deal with it.',
  'Lucky you.',
  "And I'm the lucky one.",
  "That's the deal.",
  "Take my hand and let's go.",
  "I'm all in.",
  "You're stuck with me.",
  'Try to get rid of me.',
  'I dare you.',
  "I'm not going anywhere.",
  "So don't go anywhere either.",
  'Stay.',
  'Just stay.',
  'Please stay.',
  'I mean it.',
  'Every word.',
  'Always and forever.',
  'Today, tomorrow, and every weird day after.',
  'Even on the days you steal the blanket.',
  'Especially on the days you steal the blanket.',
  "And I wouldn't change a thing.",
  "That's the whole story.",
  'The end. Or the beginning.',
  'Your move.',
  'Your turn.',
  "Ball's in your court.",
  'Catch me if you can.',
  "I'm not running.",
  "I'm right here.",
  'Come closer.',
  'Closer.',
  'A little closer.',
  "Okay, that's close enough. Just kidding — come here.",
  'I miss you already.',
  "I'll wait.",
  "I'll keep waiting.",
  "I'm patient for you.",
  'Only for you.',
  'Always for you.',
  'Forever for you.',
  'No one else.',
  'Just you.',
  'Only you.',
  'You know it.',
  "You've always known.",
  "You're my favorite.",
  'My favorite person.',
  'My favorite everything.',
] as const

const TEMPLATE_COUNT = 2
const OPENER_COUNT = OPENERS.length
const COMPLIMENT_COUNT = COMPLIMENTS.length
const FOLLOW_UP_COUNT = FOLLOW_UPS.length
const TOTAL_COMBINATIONS =
  TEMPLATE_COUNT * OPENER_COUNT * COMPLIMENT_COUNT * FOLLOW_UP_COUNT
const BITSET_BYTES = Math.ceil(TOTAL_COMBINATIONS / 8)
const MAX_LINE_LENGTH = 130
const REFRESH_MS = 12_000
const STORAGE_KEY = 'syncorbit.love.used.v2'
const STORAGE_VERSION = 2

interface StoredBits {
  v: number
  total: number
  bits: string
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max)
}

function lineFromId(id: number) {
  const template = Math.floor(id / (OPENER_COUNT * COMPLIMENT_COUNT * FOLLOW_UP_COUNT))
  let rest = id % (OPENER_COUNT * COMPLIMENT_COUNT * FOLLOW_UP_COUNT)
  const opener = Math.floor(rest / (COMPLIMENT_COUNT * FOLLOW_UP_COUNT))
  rest %= COMPLIMENT_COUNT * FOLLOW_UP_COUNT
  const compliment = Math.floor(rest / FOLLOW_UP_COUNT)
  const followUp = rest % FOLLOW_UP_COUNT
  return { template, opener, compliment, followUp }
}

function idFromParts(template: number, opener: number, compliment: number, followUp: number) {
  return (
    ((template * OPENER_COUNT + opener) * COMPLIMENT_COUNT + compliment) * FOLLOW_UP_COUNT +
    followUp
  )
}

function renderLine(template: number, opener: number, compliment: number, followUp: number) {
  if (template === 0) {
    return `${OPENERS[opener]} ${COMPLIMENTS[compliment]}. ${FOLLOW_UPS[followUp]}`
  }
  return `${FOLLOW_UPS[followUp]} ${OPENERS[opener]} ${COMPLIMENTS[compliment]}.`
}

function countBits(bytes: Uint8Array) {
  let count = 0
  for (let i = 0; i < bytes.length; i += 1) {
    let value = bytes[i]
    while (value) {
      value &= value - 1
      count += 1
    }
  }
  return count
}

function encodeBits(bytes: Uint8Array) {
  try {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  } catch {
    return ''
  }
}

function decodeBits(value: string) {
  try {
    const binary = atob(value)
    if (binary.length !== BITSET_BYTES) return null
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

function readStored(): StoredBits | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredBits>
    if (parsed.v !== STORAGE_VERSION || parsed.total !== TOTAL_COMBINATIONS) return null
    if (typeof parsed.bits !== 'string') return null
    return { v: parsed.v, total: parsed.total, bits: parsed.bits }
  } catch {
    return null
  }
}

class ShuffleDeck {
  private order: number[] = []
  private cursor = 0
  private last = -1
  private readonly size: number

  constructor(size: number) {
    this.size = size
    this.refill()
  }

  private refill() {
    this.order = Array.from({ length: this.size }, (_, index) => index)
    for (let i = this.order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const swap = this.order[i]
      this.order[i] = this.order[j]
      this.order[j] = swap
    }
    this.cursor = 0

    // Do not let a new cycle open with the phrase that just closed the old one.
    if (this.order[0] === this.last && this.order.length > 1) {
      const swapWith = 1 + Math.floor(Math.random() * (this.order.length - 1))
      const swap = this.order[0]
      this.order[0] = this.order[swapWith]
      this.order[swapWith] = swap
    }
  }

  draw() {
    if (this.cursor >= this.order.length) this.refill()
    const value = this.order[this.cursor]
    this.cursor += 1
    this.last = value
    return value
  }

  reset() {
    this.last = -1
    this.refill()
  }
}

class LoveLineEngine {
  private bytes = new Uint8Array(BITSET_BYTES)
  private usedCount = 0
  private seen = new Set<string>()
  private openerDeck = new ShuffleDeck(OPENER_COUNT)
  private complimentDeck = new ShuffleDeck(COMPLIMENT_COUNT)
  private followUpDeck = new ShuffleDeck(FOLLOW_UP_COUNT)

  constructor() {
    this.mergeStored()
  }

  private mergeStored() {
    const stored = readStored()
    if (!stored) return
    const incoming = decodeBits(stored.bits)
    if (!incoming) return
    let changed = false
    for (let i = 0; i < this.bytes.length; i += 1) {
      const merged = this.bytes[i] | incoming[i]
      if (merged !== this.bytes[i]) {
        this.bytes[i] = merged
        changed = true
      }
    }
    if (changed) this.usedCount = countBits(this.bytes)
  }

  private persist() {
    try {
      if (typeof window === 'undefined') return
      const payload: StoredBits = {
        v: STORAGE_VERSION,
        total: TOTAL_COMBINATIONS,
        bits: encodeBits(this.bytes),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Storage can be unavailable in private browsing; the in-memory set still works.
    }
  }

  private isUsed(id: number) {
    return (this.bytes[id >> 3] & (1 << (id & 7))) !== 0
  }

  private mark(id: number) {
    const byte = id >> 3
    const bit = 1 << (id & 7)
    if ((this.bytes[byte] & bit) === 0) {
      this.bytes[byte] |= bit
      this.usedCount += 1
    }
  }

  private markContent(template: number, opener: number, compliment: number, followUp: number) {
    // The two templates are the same content in a different order. Marking both
    // stops the note from later reappearing as a mirrored version of itself.
    this.mark(idFromParts(template, opener, compliment, followUp))
    this.mark(idFromParts(template === 0 ? 1 : 0, opener, compliment, followUp))
  }

  private reset() {
    this.bytes.fill(0)
    this.usedCount = 0
    this.seen.clear()
    this.openerDeck.reset()
    this.complimentDeck.reset()
    this.followUpDeck.reset()
    this.persist()
  }

  next(): string {
    this.mergeStored()
    if (this.usedCount >= TOTAL_COMBINATIONS) this.reset()

    // The decks serve every opener, compliment and closer once before any of
    // them can come back around, so consecutive notes feel genuinely different.
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const template = randomInt(TEMPLATE_COUNT)
      const opener = this.openerDeck.draw()
      const compliment = this.complimentDeck.draw()
      const followUp = this.followUpDeck.draw()

      const id = idFromParts(template, opener, compliment, followUp)
      if (this.isUsed(id)) continue

      const line = renderLine(template, opener, compliment, followUp)
      if (line.length > MAX_LINE_LENGTH) continue
      if (this.seen.has(line)) {
        this.markContent(template, opener, compliment, followUp)
        continue
      }

      this.markContent(template, opener, compliment, followUp)
      this.seen.add(line)
      this.persist()
      return line
    }

    // Pull from the unused space systematically if random probing gets unlucky.
    const start = randomInt(TOTAL_COMBINATIONS)
    for (let step = 0; step < TOTAL_COMBINATIONS; step += 1) {
      const id = (start + step) % TOTAL_COMBINATIONS
      if (this.isUsed(id)) continue
      const parts = lineFromId(id)
      const line = renderLine(parts.template, parts.opener, parts.compliment, parts.followUp)
      if (line.length > MAX_LINE_LENGTH) continue
      if (this.seen.has(line)) {
        this.markContent(parts.template, parts.opener, parts.compliment, parts.followUp)
        continue
      }

      this.markContent(parts.template, parts.opener, parts.compliment, parts.followUp)
      this.seen.add(line)
      this.persist()
      return line
    }

    // Every usable combination has been shown. Start a fresh cycle.
    this.reset()
    return this.next()
  }
}

let engine: LoveLineEngine | null = null

function nextLoveLine() {
  if (!engine) engine = new LoveLineEngine()
  return engine.next()
}

export function LoveNote() {
  const [line, setLine] = useState(() => nextLoveLine())

  const advance = useCallback(() => {
    setLine(nextLoveLine())
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(advance, REFRESH_MS)
    return () => window.clearTimeout(timer)
  }, [advance, line])

  return (
    <section
      aria-label="Love note for Noor"
      className="relative overflow-hidden rounded-card border border-white/[0.08] bg-[rgba(18,19,26,0.78)] p-5 shadow-2xl backdrop-blur-[20px] sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF0844]/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(255,8,68,0.2),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(0,242,254,0.14),transparent_70%)]"
      />

      <div className="relative flex items-center gap-2.5 sm:gap-3.5">
        <span
          aria-hidden="true"
          className="mt-[-0.35rem] shrink-0 font-serif text-[42px] leading-none text-[#FF0844]/35 select-none sm:text-[52px]"
        >
          &ldquo;
        </span>
        <div className="min-w-0 flex-1">
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 10, filter: 'blur(7px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-[156px] items-center font-serif text-[21px] leading-[1.45] tracking-[-0.005em] text-white/92 min-[360px]:min-h-[126px] sm:min-h-[121px] sm:text-[27px]"
          >
            <span className="block w-full text-balance">{line}</span>
          </motion.p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-white/38 uppercase">
          <Heart className="size-3 shrink-0 text-[#FF0844]" fill="currentColor" strokeWidth={0} />
          for Noor
          <Sparkles className="size-3 text-[#F59E0B]/80" strokeWidth={2} />
        </span>

        <button
          type="button"
          onClick={() => {
            playUiTick()
            advance()
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 font-mono text-[9px] tracking-[0.12em] text-white/45 uppercase transition-colors duration-200 hover:border-[#FF0844]/35 hover:bg-[#FF0844]/10 hover:text-white/85 active:scale-[0.97]"
          aria-label="Show another love line"
          title="Show another love line"
        >
          <RefreshCw className="size-3" strokeWidth={2.1} />
          another
        </button>
      </div>
    </section>
  )
}
