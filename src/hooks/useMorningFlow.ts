import { useState } from 'react'
import { getTodayStr } from '../utils/dates'

type MorningFlowStep = 'yesterday-review' | 'missed-reasons' | 'done'

const STORAGE_KEY = 'morning-flow-last-reviewed-date'

export function useMorningFlow() {
  const todayStr = getTodayStr()

  const [step, setStep] = useState<MorningFlowStep>(() => {
    const lastReviewed = localStorage.getItem(STORAGE_KEY)
    return lastReviewed === todayStr ? 'done' : 'yesterday-review'
  })

  const advanceToMissedReasons = () => setStep('missed-reasons')

  const completeFlow = () => {
    localStorage.setItem(STORAGE_KEY, todayStr)
    setStep('done')
  }

  return { step, advanceToMissedReasons, completeFlow }
}
