import { useCallback, useEffect, useState } from 'react'

const KEY = 'qcs-theme'
export const THEMES = ['system', 'light', 'dark']

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.includes(v) ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState(read)
  useEffect(() => apply(theme), [theme])
  const setTheme = useCallback((next) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      /* storage blocked: theme still applies for this visit */
    }
    setThemeState(next)
  }, [])
  return [theme, setTheme]
}
