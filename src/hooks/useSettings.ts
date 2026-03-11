import { useState, useEffect } from 'react'

export type ExamenPropositoTarget = 'today' | 'tomorrow'

const EXAMEN_PROPOSITO_TARGET_KEY = 'settings-examen-proposito-target'

export function useExamenPropositoTarget(): [ExamenPropositoTarget, (value: ExamenPropositoTarget) => void] {
  const [target, setTargetState] = useState<ExamenPropositoTarget>(() => {
    return (localStorage.getItem(EXAMEN_PROPOSITO_TARGET_KEY) as ExamenPropositoTarget) || 'tomorrow'
  })

  const setTarget = (value: ExamenPropositoTarget) => {
    localStorage.setItem(EXAMEN_PROPOSITO_TARGET_KEY, value)
    setTargetState(value)
  }

  return [target, setTarget]
}

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

const PRACTICE_FONT_SIZE_KEY = 'settings-practice-font-size'
const UI_FONT_SIZE_KEY = 'settings-ui-font-size'

export type FontSizeLevel = 'small' | 'medium' | 'large'

const practiceFontScales: Record<FontSizeLevel, number> = {
  small: 1,
  medium: 1.15,
  large: 1.35,
}

const uiFontScales: Record<FontSizeLevel, number> = {
  small: 0.9,
  medium: 1,
  large: 1.1,
}

function applyFontSize(key: string, scale: number) {
  document.documentElement.style.setProperty(key, String(scale))
}

export function usePracticeFontSize(): [FontSizeLevel, (level: FontSizeLevel) => void] {
  const [level, setLevelState] = useState<FontSizeLevel>(() => {
    return (localStorage.getItem(PRACTICE_FONT_SIZE_KEY) as FontSizeLevel) || 'medium'
  })

  useEffect(() => {
    applyFontSize('--font-scale-practice', practiceFontScales[level])
  }, [level])

  const setLevel = (value: FontSizeLevel) => {
    localStorage.setItem(PRACTICE_FONT_SIZE_KEY, value)
    setLevelState(value)
  }

  return [level, setLevel]
}

export function useUIFontSize(): [FontSizeLevel, (level: FontSizeLevel) => void] {
  const [level, setLevelState] = useState<FontSizeLevel>(() => {
    return (localStorage.getItem(UI_FONT_SIZE_KEY) as FontSizeLevel) || 'medium'
  })

  useEffect(() => {
    applyFontSize('--font-scale-ui', uiFontScales[level])
  }, [level])

  const setLevel = (value: FontSizeLevel) => {
    localStorage.setItem(UI_FONT_SIZE_KEY, value)
    setLevelState(value)
  }

  return [level, setLevel]
}
