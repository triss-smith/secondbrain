import { useEffect, useState } from 'react'
import { getTheme } from '../themes'
import { getSettings, saveTheme } from '../api'

type Mode = 'dark' | 'light'

export function useTheme() {
  const [mode, setMode] = useState<Mode>('dark')
  const [themeId, setThemeId] = useState('violet')

  // Load theme from config.json (server)
  useEffect(() => {
    getSettings().then(d => {
      setMode((d.theme_mode as Mode) ?? 'dark')
      setThemeId(d.theme_id ?? 'violet')
    })
  }, [])

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
  }, [mode, themeId])

  // Persist theme to config.json when user changes it
  const persistTheme = (newMode: Mode, newThemeId: string) => {
    saveTheme({ theme_mode: newMode, theme_id: newThemeId }).catch(() => {})
  }

  const setModeAndPersist = (next: Mode) => {
    setMode(next)
    persistTheme(next, themeId)
  }

  const setThemeIdAndPersist = (next: string) => {
    setThemeId(next)
    persistTheme(mode, next)
  }

  const toggleMode = () => setModeAndPersist(mode === 'dark' ? 'light' : 'dark')

  return { mode, isDark: mode === 'dark', themeId, setThemeId: setThemeIdAndPersist, toggleMode }
}
