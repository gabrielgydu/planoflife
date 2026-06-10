import { motion } from 'motion/react'
import { Briefcase } from 'lucide-react'
import { useCareerEnabled } from '../../hooks/useCareerEnabled'
import { EmptyState } from '../shared/EmptyState'
import { NowPanel } from './NowPanel'

/**
 * Career section ("Carreira" tab). Only reachable on installs whose synced data
 * carries career rows — see useCareerEnabled. App chrome stays PT like the rest
 * of the app; the career content itself renders in whatever language the
 * published data carries (mostly EN).
 *
 * One glanceable scroll: Now panel (phase 1), habit chain (2), outreach + ladder
 * trackers (3), roadmap + wins/log feed (4).
 */
export function CareerView() {
  const enabled = useCareerEnabled()

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center justify-between px-4 h-16">
          <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Carreira
          </h1>
        </div>
      </header>

      {enabled ? (
        <motion.div
          className="flex-1 px-4 py-4 space-y-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <NowPanel />
        </motion.div>
      ) : (
        <EmptyState icon={Briefcase} message="Nenhum dado de carreira" />
      )}
    </div>
  )
}
