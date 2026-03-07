export interface ThemeColors {
  surface: string
  surface1: string
  surface2: string
  surface3: string
  accent: string
  accentHover: string
}

export interface Theme {
  id: string
  name: string
  dark: ThemeColors
  light: ThemeColors
}

export const THEMES: Theme[] = [
  {
    id: 'violet',
    name: 'Violet',
    dark:  { surface: '#0f1117', surface1: '#1a1d27', surface2: '#22263a', surface3: '#2a2f47', accent: '#7c6af7', accentHover: '#9485f9' },
    light: { surface: '#eef0f7', surface1: '#ffffff', surface2: '#f1f3fa', surface3: '#d8dce8', accent: '#7c6af7', accentHover: '#6d5ef0' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    dark:  { surface: '#0d1117', surface1: '#0f172a', surface2: '#1e2640', surface3: '#263355', accent: '#3b82f6', accentHover: '#60a5fa' },
    light: { surface: '#eff6ff', surface1: '#ffffff', surface2: '#f0f4ff', surface3: '#dbeafe', accent: '#3b82f6', accentHover: '#2563eb' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    dark:  { surface: '#0d1210', surface1: '#141d18', surface2: '#1c2820', surface3: '#24322a', accent: '#10b981', accentHover: '#34d399' },
    light: { surface: '#f0fdf4', surface1: '#ffffff', surface2: '#f0fdf9', surface3: '#d1fae5', accent: '#10b981', accentHover: '#059669' },
  },
  {
    id: 'rose',
    name: 'Rose',
    dark:  { surface: '#130d10', surface1: '#1f1018', surface2: '#2b1524', surface3: '#3d1d33', accent: '#f43f5e', accentHover: '#fb7185' },
    light: { surface: '#fff1f2', surface1: '#ffffff', surface2: '#fff1f4', surface3: '#fecdd3', accent: '#f43f5e', accentHover: '#e11d48' },
  },
  {
    id: 'amber',
    name: 'Amber',
    dark:  { surface: '#12100a', surface1: '#1c180e', surface2: '#26211a', surface3: '#332c1e', accent: '#f59e0b', accentHover: '#fbbf24' },
    light: { surface: '#fffbeb', surface1: '#ffffff', surface2: '#fef9ed', surface3: '#fde68a', accent: '#f59e0b', accentHover: '#d97706' },
  },
]

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}
