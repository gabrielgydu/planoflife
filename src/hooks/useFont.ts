import { useState, useEffect } from 'react'

export type FontKey = 'cormorant' | 'lora' | 'dm-sans'

const FONT_MAP: Record<FontKey, string> = {
  cormorant: "'Cormorant Garamond', serif",
  lora: "'Lora', serif",
  'dm-sans': "'DM Sans', sans-serif",
}

const STORAGE_KEY = 'font-heading'

function getInitialFont(): FontKey {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && stored in FONT_MAP) return stored as FontKey
  return 'cormorant'
}

export function useFont(): [FontKey, (key: FontKey) => void] {
  const [fontKey, setFontKeyState] = useState<FontKey>(getInitialFont)

  useEffect(() => {
    document.documentElement.style.setProperty('--font-heading', FONT_MAP[fontKey])
  }, [fontKey])

  const setFontKey = (key: FontKey) => {
    localStorage.setItem(STORAGE_KEY, key)
    setFontKeyState(key)
  }

  return [fontKey, setFontKey]
}

export { FONT_MAP }
