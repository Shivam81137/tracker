import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, RefreshCw, Sparkles, User, X } from 'lucide-react'
import { CLOUD_ROOM_KEY } from '../lib/constants'
import { useOrbit } from '../lib/orbit-context'

interface SyncSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SyncSettingsModal({ isOpen, onClose }: SyncSettingsModalProps) {
  const { currentUser, setCurrentUser, firebaseDbUrl, setFirebaseUrl, live, pushToast } = useOrbit()
  const [urlInput, setUrlInput] = useState(firebaseDbUrl || '')
  const [copied, setCopied] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    let shareUrl = `${origin}?room=${CLOUD_ROOM_KEY}`
    if (firebaseDbUrl) {
      shareUrl += `&db=${encodeURIComponent(firebaseDbUrl)}`
    }
    if (currentUser === 'shivam') {
      shareUrl += `&user=noor`
    } else if (currentUser === 'noor') {
      shareUrl += `&user=shivam`
    }

    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    pushToast({
      title: 'Partner Link Copied',
      body: 'Send this URL on WhatsApp to auto-connect with identical room & DB settings.',
      accent: 'sync',
      icon: '🔗',
    })
    setTimeout(() => setCopied(false), 2500)
  }

  const handleManualSync = async () => {
    setSyncing(true)
    const ok = await live.forceSyncNow()
    setSyncing(false)
    pushToast({
      title: ok ? 'Sync Successful' : 'Sync Request Sent',
      body: ok ? 'Fetched the newest changes across devices.' : 'Retried cloud channels.',
      accent: 'sync',
      icon: '✦',
    })
  }

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault()
    setFirebaseUrl(urlInput.trim())
    pushToast({
      title: 'Firebase Endpoint Saved',
      body: urlInput.trim() ? 'SSE realtime stream updated.' : 'Using default MQTT & bin failover.',
      accent: 'shivam',
      icon: '🔥',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-settings-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0C1017]/95 p-6 shadow-2xl backdrop-blur-2xl text-white"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="size-8 object-contain drop-shadow-[0_0_10px_rgba(0,242,254,0.3)]" />
            <div>
              <h2 id="sync-settings-title" className="text-sm font-semibold tracking-wider uppercase text-white/95">
                Cloud Sync &amp; Identity
              </h2>
              <p className="text-[11px] text-white/50">Cross-phone real-time sync for Shivam &amp; Noor</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
            aria-label="Close settings"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6 text-xs">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-white/70 mb-2">
              Who is using this phone?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrentUser('shivam')}
                className={`flex items-center justify-center gap-2 rounded-xl p-3 border transition ${
                  currentUser === 'shivam'
                    ? 'border-[#00F2FE] bg-[#00F2FE]/15 text-[#00F2FE] font-medium'
                    : 'border-white/10 bg-white/[0.03] text-white/70'
                }`}
              >
                <User className="size-4" />
                <span>I am Shivam ⚡</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentUser('noor')}
                className={`flex items-center justify-center gap-2 rounded-xl p-3 border transition ${
                  currentUser === 'noor'
                    ? 'border-[#FF0844] bg-[#FF0844]/15 text-[#FFB199] font-medium'
                    : 'border-white/10 bg-white/[0.03] text-white/70'
                }`}
              >
                <Sparkles className="size-4" />
                <span>I am Noor ✨</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Shared Room ID:</span>
              <span className="font-mono text-[11px] text-[#00F2FE] bg-black/40 px-2 py-0.5 rounded border border-white/5">
                {CLOUD_ROOM_KEY}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Cloud Engine:</span>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#00F2FE] animate-pulse" />
                <span className="text-white/80 font-mono text-[11px]">
                  MQTT Retain (QoS 1) + REST Fallback
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Link Copied!' : 'Copy Partner Sync Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs text-[#00F2FE] px-2.5 py-1.5 rounded-lg bg-[#00F2FE]/10 hover:bg-[#00F2FE]/20 transition border border-[#00F2FE]/30"
              >
                <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Force Sync Now'}</span>
              </button>
            </div>
          </div>

          <div>
            <form onSubmit={handleSaveFirebase} className="space-y-2">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/70">
                Custom Firebase Realtime DB URL (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://your-app-default-rtdb.firebaseio.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-[#00F2FE] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl px-3 py-2 bg-white/10 text-white/90 font-medium border border-white/10 hover:bg-white/20 transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/15 transition"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  )
}
