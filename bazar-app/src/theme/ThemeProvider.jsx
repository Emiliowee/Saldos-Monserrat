import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

function resolvePref(pref) {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyDom(pref) {
  const r = resolvePref(pref)
  document.documentElement.setAttribute('data-theme', r)
  document.documentElement.classList.toggle('dark', r === 'dark')
  document.documentElement.style.colorScheme = r
  return r
}

export function ThemeProvider({ children }) {
  const [themePref, setThemePrefState] = useState('system')
  const [resolvedTheme, setResolvedTheme] = useState('light')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const s = await window.bazar?.settings?.get?.()
      if (cancel) return
      const p =
        s?.theme === 'light' || s?.theme === 'dark' || s?.theme === 'system' ? s.theme : 'system'
      setThemePrefState(p)
      setResolvedTheme(applyDom(p))
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    setResolvedTheme(applyDom(themePref))
    if (themePref !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(applyDom('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [themePref])

  const setTheme = useCallback(async (next) => {
    setThemePrefState(next)
    setResolvedTheme(applyDom(next))
    try {
      await window.bazar?.settings?.set?.({ theme: next })
    } catch {
      /* ignore */
    }
  }, [])

  const cycleTheme = useCallback(() => {
    const seq = ['system', 'light', 'dark']
    const i = seq.indexOf(themePref)
    const next = seq[(i + 1) % seq.length]
    void setTheme(next)
  }, [themePref, setTheme])

  const value = useMemo(
    () => ({ themePref, resolvedTheme, setTheme, cycleTheme }),
    [themePref, resolvedTheme, setTheme, cycleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}
