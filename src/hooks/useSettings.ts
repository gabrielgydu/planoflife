import { useState } from 'react'

const INDIVIDUAL_REASONS_KEY = 'settings-individual-reasons'

export function useIndividualReasons(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabledState] = useState(() => {
    return localStorage.getItem(INDIVIDUAL_REASONS_KEY) === 'true'
  })

  const setEnabled = (value: boolean) => {
    localStorage.setItem(INDIVIDUAL_REASONS_KEY, String(value))
    setEnabledState(value)
  }

  return [enabled, setEnabled]
}
