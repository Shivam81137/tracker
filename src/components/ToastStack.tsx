import { AnimatePresence, motion } from 'framer-motion'
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
  neutral: 'text-white/70',
}

export function ToastStack() {
  const { toasts, dismissToast } = useOrbit()

  return (
    <div className="pointer-events-none fixed top-[68px] right-3 z-50 flex w-[min(92vw,336px)] flex-col gap-2 sm:right-5">
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
            className={`pointer-events-auto w-full cursor-pointer rounded-2xl border bg-black/55 px-3.5 py-3 text-left backdrop-blur-[20px] ${ACCENT_RING[toast.accent]}`}
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-px text-[13px] leading-none ${ACCENT_ICON[toast.accent]}`}>
                {toast.icon ?? '✦'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium tracking-tight text-white/92">
                  {toast.title}
                </span>
                {toast.body && (
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/45">{toast.body}</span>
                )}
              </span>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
