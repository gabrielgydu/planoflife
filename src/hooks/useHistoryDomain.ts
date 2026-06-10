import { useState } from 'react'
import type { PracticeDomain } from '../types'

const HISTORY_DOMAIN_KEY = 'history-domain'

// Which domain the History stats are showing — spiritual devotions vs lifestyle
// habits. Persisted to localStorage so the choice survives the HistoryView ->
// DayDetail navigation (they are sibling routes, not parent/child, so it can't be
// passed as a prop) and page reloads. Deliberately device-local: it is NOT routed
// through the sync settings bus, because which stats tab you last looked at is a
// transient view filter, not a preference worth syncing across devices.
export function useHistoryDomain(): [PracticeDomain, (domain: PracticeDomain) => void] {
  const [domain, setDomainState] = useState<PracticeDomain>(() => {
    const stored = localStorage.getItem(HISTORY_DOMAIN_KEY)
    return stored === 'lifestyle' || stored === 'career' ? stored : 'spiritual'
  })

  const setDomain = (value: PracticeDomain) => {
    localStorage.setItem(HISTORY_DOMAIN_KEY, value)
    setDomainState(value)
  }

  return [domain, setDomain]
}
