import { useState, useEffect } from 'react'

export type ThemeMode = 'light' | 'dark' | 'black'

const STORAGE_KEY = 'theme-mode'

const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#FFFFFF',
  dark: '#13161B',
  black: '#000000',
}

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'black') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'black' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const html = document.documentElement
  html.classList.remove('dark', 'black')
  if (mode !== 'light') html.classList.add(mode)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[mode])
}

export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)

  useEffect(() => {
    applyTheme(mode)
  }, [mode])

  const setMode = (newMode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, newMode)
    setModeState(newMode)
  }

  return [mode, setMode]
}
