import { motion } from 'motion/react'
import { Briefcase } from 'lucide-react'
import { useCareerEnabled } from '../../hooks/useCareerEnabled'
import { EmptyState } from '../shared/EmptyState'
import { NowPanel } from './NowPanel'
import { OutreachTracker } from './OutreachTracker'
import { LadderTracker } from './LadderTracker'
import { RoadmapFeed } from './RoadmapFeed'
import { YearTimeline } from './YearTimeline'

/**
 * Career section ("Carreira" tab). Only reachable on installs whose synced data
 * carries career rows — see useCareerEnabled. App chrome stays PT like the rest
 * of the app; the career content itself renders in whatever language the
 * published data carries (mostly EN).
 *
 * One glanceable scroll: Now panel, outreach + ladder trackers, roadmap +
 * wins/log feed. Deliberately NO streak/heatmap visualizations (Gabriel,
 * 2026-06-10): career habits are tracked in the daily checklist and visible
 * under History's Carreira toggle — this tab stays operational, not motivational.
 */
export function CareerView() {
  const enabled = useCareerEnabled()

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 bg-surface-card dark:bg-surface-card-dark border-b border-border dark:border-border-dark z-10">
        <div className="flex items-center justify-between px-4 h-16 mx-auto w-full max-w-2xl">
          <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary-dark">
            Carreira
          </h1>
        </div>
      </header>

      {enabled ? (
        <motion.div
          className="flex-1 px-4 py-4 space-y-6 mx-auto w-full max-w-2xl"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <NowPanel />
          <YearTimeline />
          <OutreachTracker />
          <LadderTracker />
          <RoadmapFeed />
        </motion.div>
      ) : (
        <EmptyState icon={Briefcase} message="Nenhum dado de carreira" />
      )}
    </div>
  )
}
