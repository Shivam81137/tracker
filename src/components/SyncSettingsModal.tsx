import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
      body: urlInput.trim() ? 'SSE realtime stream updated.' : 'Using the default MQTT realtime relay.',
      accent: 'shivam',
      icon: '🔥',
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="sync-settings"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-settings-title"
            initial={{ opacity: 0, y: 28, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-[#0C1017]/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl backdrop-blur-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="size-8 object-contain drop-shadow-[0_0_10px_rgba(0,242,254,0.3)]" />
            <div>
              <h2 id="sync-settings-title" className="text-sm font-semibold tracking-wider uppercase text-white/97">
                Cloud Sync &amp; Identity
              </h2>
              <p className="text-[11px] text-white/64">Cross-phone real-time sync for Shivam &amp; Noor</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white transition"
            aria-label="Close settings"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs sm:mt-5 sm:space-y-6">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-white/80 mb-2">
              Who is using this phone?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrentUser('shivam')}
                className={`flex items-center justify-center gap-2 rounded-xl p-3 border transition ${
                  currentUser === 'shivam'
                    ? 'border-[#00F2FE] bg-[#00F2FE]/15 text-[#00F2FE] font-medium'
                    : 'border-white/10 bg-white/[0.03] text-white/80'
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
                    : 'border-white/10 bg-white/[0.03] text-white/80'
                }`}
              >
                <Sparkles className="size-4" />
                <span>I am Noor ✨</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/72">Shared Room ID:</span>
              <span className="font-mono text-[11px] text-[#00F2FE] bg-black/40 px-2 py-0.5 rounded border border-white/5">
                {CLOUD_ROOM_KEY}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-white/72">Cloud Engine:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    live.status === 'synced'
                      ? 'bg-emerald-400 animate-pulse'
                      : live.status === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-[#FF0844]'
                  }`}
                />
                <span className="text-right font-mono text-[11px] text-white/88">
                  {live.status === 'synced'
                    ? 'Live MQTT + SSE'
                    : live.status === 'connecting'
                      ? 'Connecting live channel…'
                      : 'Fallback polling'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-white/5 pt-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/88 transition hover:bg-white/10 hover:text-white"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Link Copied!' : 'Copy Partner Sync Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[#00F2FE]/30 bg-[#00F2FE]/10 px-2.5 py-2 text-xs text-[#00F2FE] transition hover:bg-[#00F2FE]/20 disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Force Sync Now'}</span>
              </button>
            </div>
          </div>

          <div>
            <form onSubmit={handleSaveFirebase} className="space-y-2">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/80">
                Custom Firebase Realtime DB URL (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://your-app-default-rtdb.firebaseio.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-[#00F2FE] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl px-3 py-2 bg-white/10 text-white/94 font-medium border border-white/10 hover:bg-white/20 transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-4 flex justify-end border-t border-white/10 bg-[#0C1017]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:mt-6 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-white/15 sm:w-auto sm:py-2"
          >
            Done
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
