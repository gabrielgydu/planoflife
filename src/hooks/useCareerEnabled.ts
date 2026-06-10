import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

/**
 * Gate for the whole career section (Carreira tab, History three-way toggle).
 *
 * True only when the local DB carries career data — a published plan or a
 * career-domain practice. Career data only ever arrives via sync from Gabriel's
 * account (seeded by scripts/career-publish.mjs, never in-app), so on every
 * other install this stays false and the public app is unchanged.
 */
export function useCareerEnabled(): boolean {
  return (
    useLiveQuery(async () => {
      const plan = await db.careerPlan.count()
      if (plan > 0) return true
      const careerPractices = await db.practices
        .filter((p) => p.domain === 'career')
        .count()
      return careerPractices > 0
    }, []) ?? false
  )
}
