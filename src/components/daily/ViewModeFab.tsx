import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Cross, Sparkles, LayoutList, type LucideIcon } from 'lucide-react'
import type { DailyViewMode } from '../../hooks/useSettings'

const MODE_META: Record<DailyViewMode, { icon: LucideIcon; label: string }> = {
  plano: { icon: Cross, label: 'Plano de Vida' },
  extras: { icon: Sparkles, label: 'Extras' },
  all: { icon: LayoutList, label: 'Todas' },
}

const LABEL_MS = 1400

interface ViewModeFabProps {
  mode: DailyViewMode
  onCycle: () => void
}

/**
 * Floating mode cycler for the daily checklist: each tap advances plano →
 * extras → all → plano and briefly shows the new mode's name. Sits above the
 * bottom nav (which is h-16 + safe area on mobile, a floating pill on sm:) and
 * below the z-50 reader overlays.
 */
export function ViewModeFab({ mode, onCycle }: ViewModeFabProps) {
  const [showLabel, setShowLabel] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { icon: Icon, label } = MODE_META[mode]

  const handleTap = () => {
    onCycle()
    setShowLabel(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShowLabel(false), LABEL_MS)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  return (
    <div className="fixed right-4 bottom-[calc(5rem+var(--safe-area-bottom))] sm:bottom-6 z-40 flex items-center gap-2">
      <AnimatePresence>
        {showLabel && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-text-primary-dark border border-border dark:border-border-dark shadow-lg whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleTap}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="w-12 h-12 rounded-full flex items-center justify-center bg-btn dark:bg-btn-dark text-btn-text dark:text-btn-dark-text shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-light"
        aria-label={`Modo de exibição: ${label}. Toque para alternar.`}
      >
        <Icon className="w-5 h-5" />
      </motion.button>
    </div>
  )
}
