import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  /** Vertical travel in px. */
  y?: number
}

/**
 * Subtle scroll-reveal wrapper.
 *
 * Sections fade and rise once as they enter the viewport, then stay put.
 * Motion is skipped entirely for visitors who ask for reduced motion.
 */
export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      // Animate travel only: content is never hidden, even before observers fire.
      initial={reduce ? false : { y }}
      whileInView={reduce ? undefined : { y: 0 }}
      viewport={{ once: true, amount: 0.06, margin: '0px 0px -50px 0px' }}
      transition={{ duration: 0.65, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}
