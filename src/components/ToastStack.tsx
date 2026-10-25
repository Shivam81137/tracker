import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useOrbit } from '../lib/orbit-context'
import type { Accent } from '../lib/types'

const ACCENT_RING: Record<Accent, string> = {
  shivam: 'border-[#00F2FE]/30 shadow-[0_0_36px_-12px_rgba(0,242,254,0.55)]',
  noor: 'border-[#FF0844]/30 shadow-[0_0_36px_-12px_rgba(255,8,68,0.55)]',
  sync: 'border-[#F59E0B]/30 shadow-[0_0_36px_-12px_rgba(245,158,11,0.55)]',
  neutral: 'border-white/[0.08]',
}

const ACCENT_ICON: Record<Accent, string> = {
  shivam: 'text-[#00F2FE]',
  noor: 'text-[#FFB199]',
  sync: 'text-[#F59E0B]',
  neutral: 'text-white/80',
}

const ACCENT_BAR: Record<Accent, string> = {
  shivam: 'bg-[#00F2FE]',
  noor: 'bg-[#FF0844]',
  sync: 'bg-[#F59E0B]',
  neutral: 'bg-white/25',
}

export function ToastStack() {
  const { toasts, dismissToast } = useOrbit()

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(68px+env(safe-area-inset-top))] right-3 z-50 flex w-[min(92vw,336px)] flex-col gap-2 sm:right-5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            onClick={() => dismissToast(toast.id)}
            initial={{ opacity: 0, x: 28, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 28, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
            className={`group pointer-events-auto relative w-full cursor-pointer overflow-hidden rounded-2xl border bg-[#0B0B10]/82 px-3.5 py-3 pl-4 text-left backdrop-blur-[20px] transition-colors hover:bg-[#0B0B10]/92 ${ACCENT_RING[toast.accent]}`}
            aria-label={`${toast.title}. Dismiss notification.`}
            title="Dismiss"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-2.5 left-0 w-[2px] rounded-full ${ACCENT_BAR[toast.accent]}`}
            />
            <div className="flex items-start gap-2.5">
              <span className={`mt-px text-[13px] leading-none ${ACCENT_ICON[toast.accent]}`}>
                {toast.icon ?? '✦'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium tracking-tight text-white/95">
                  {toast.title}
                </span>
                {toast.body && (
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/60">{toast.body}</span>
                )}
              </span>
              <span aria-hidden="true" className="mt-px text-white/38 transition-colors group-hover:text-white/76">
                <X className="size-3.5" strokeWidth={2.2} />
              </span>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
