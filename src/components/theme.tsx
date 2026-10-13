import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'svgw:theme'
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#0c0a09' }

/**
 * Runs in <head> before the app renders, so a dark preference never flashes white.
 * Keep in sync with `apply` below.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})()`

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

const systemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'

function apply(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }
  meta.content = THEME_COLORS[theme]
}

interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Follows the operating system's appearance unless the user picks light or dark. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Match the prerendered HTML during hydration. The head script already applies
  // the saved appearance, and we adopt it before any browser paint.
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [system, setSystem] = useState<ResolvedTheme>('light')
  const [ready, setReady] = useState(false)
  const resolved = preference === 'system' ? system : preference

  useLayoutEffect(() => {
    setPreferenceState(readPreference())
    setSystem(systemTheme())
    setReady(true)
  }, [])

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystem(query.matches ? 'dark' : 'light')
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // A layout effect applies the class before children's effects run, so anything that reads theme
  // colors in an effect (the rulers) sees the new values.
  useLayoutEffect(() => {
    if (ready) apply(resolved)
  }, [resolved, ready])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* Storage unavailable: the choice lasts for this session. */
    }
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.')
  return context
}
