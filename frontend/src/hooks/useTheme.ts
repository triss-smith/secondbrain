import { useEffect, useState } from 'react'
import { getTheme } from '../themes'

type Mode = 'dark' | 'light'

export function useTheme() {
  const [mode, setMode] = useState<Mode>(() =>
    (localStorage.getItem('theme-mode') as Mode) ?? 'dark'
  )
  const [themeId, setThemeId] = useState(() =>
    localStorage.getItem('theme-id') ?? 'violet'
  )

  useEffect(() => {
    const theme = getTheme(themeId)
    const colors = mode === 'dark' ? theme.dark : theme.light
    const root = document.documentElement
    root.style.setProperty('--color-surface',       colors.surface)
    root.style.setProperty('--color-surface-1',     colors.surface1)
    root.style.setProperty('--color-surface-2',     colors.surface2)
    root.style.setProperty('--color-surface-3',     colors.surface3)
    root.style.setProperty('--color-accent',        colors.accent)
    root.style.setProperty('--color-accent-hover',  colors.accentHover)
    root.setAttribute('data-theme', mode)
    localStorage.setItem('theme-mode', mode)
    localStorage.setItem('theme-id', themeId)
  }, [mode, themeId])

  const toggleMode = () => setMode(m => (m === 'dark' ? 'light' : 'dark'))

  return { mode, isDark: mode === 'dark', themeId, setThemeId, toggleMode }
}
