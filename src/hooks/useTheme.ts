import { useEffect, useState } from 'react'

function getThemeFromClasses(): 'light' | 'dark' {
  const html = document.documentElement
  return html.classList.contains('dark') || html.classList.contains('black') ? 'dark' : 'light'
}

export function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(getThemeFromClasses)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getThemeFromClasses())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return theme
}
