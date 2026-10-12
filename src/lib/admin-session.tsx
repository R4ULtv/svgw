import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cloudApi, CloudError } from './cloud-api'
import {
  ADMIN_SESSION_DURATION,
  ADMIN_SESSION_STORAGE_KEY,
  LEGACY_ADMIN_KEY_STORAGE_KEY,
  parseSavedAdminSession,
  type SavedAdminSession,
} from './saved-admin-session'

function readSavedSession() {
  try {
    const session = parseSavedAdminSession(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY))
    if (session) return session
  } catch {
    /* Try tab storage when persistent storage is unavailable. */
  }
  try {
    return parseSavedAdminSession(sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY))
  } catch {
    return null
  }
}

function useSession() {
  // Cloud requests use this bearer token; the admin key is only used to log in.
  const key = useRef('')
  const generation = useRef(0)
  const [admin, setAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)

  const lock = useCallback(() => {
    ++generation.current
    key.current = ''
    setAdmin(false)
    setAuthReady(true)
    setExpiresAt(null)
    try {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    } catch {
      /* Memory and tab storage are still cleared. */
    }
    try {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
      sessionStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE_KEY)
    } catch {
      /* Memory is still cleared when browser storage is blocked. */
    }
  }, [])

  const remember = useCallback(
    (session: SavedAdminSession) => {
      if (session.expiresAt <= Date.now()) {
        lock()
        return
      }
      key.current = session.token
      setAdmin(true)
      setExpiresAt(session.expiresAt)
      const value = JSON.stringify(session)
      try {
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, value)
        try {
          sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
        } catch {
          /* The persistent session is already saved. */
        }
      } catch {
        try {
          sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, value)
        } catch {
          /* Keep the token in memory until it expires or this tab closes. */
        }
      }
      try {
        sessionStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE_KEY)
      } catch {
        /* Storage may be blocked. */
      }
    },
    [lock],
  )

  const unlock = useCallback(
    async (value: string) => {
      const candidate = value.trim()
      if (!candidate) throw new Error('Enter the key.')
      const attempt = ++generation.current
      let result: Awaited<ReturnType<typeof cloudApi.login>>
      try {
        result = await cloudApi.login(candidate)
      } catch (cause) {
        if (cause instanceof CloudError && cause.status === 401)
          throw new Error('The key is incorrect. Try again.')
        throw cause
      }
      if (!result.configured) throw new Error('Remote access is not configured for this instance.')
      if (!result.admin) throw new Error('The key is incorrect. Try again.')
      if (attempt === generation.current) remember(result.session)
    },
    [remember],
  )

  useEffect(() => {
    async function restore(stored: SavedAdminSession | null, legacyKey = '') {
      const attempt = ++generation.current
      if (!stored && !legacyKey) {
        lock()
        return
      }
      try {
        if (stored) {
          const result = await cloudApi.admin(stored.token)
          if (attempt !== generation.current) return
          if (result.admin && result.configured) remember(stored)
          else lock()
        } else {
          // Upgrade an existing tab's login without saving the original key on disk.
          const result = await cloudApi.login(legacyKey)
          if (attempt !== generation.current) return
          if (result.admin && result.configured) remember(result.session)
          else lock()
        }
      } catch (cause) {
        if (attempt !== generation.current) return
        if (stored && cause instanceof CloudError && (cause.status === 0 || cause.status === 503)) {
          // Keep an unexpired session available locally while offline.
          remember(stored)
        } else lock()
      }
      if (attempt === generation.current) setAuthReady(true)
    }

    const stored = readSavedSession()
    let legacyKey = ''
    try {
      if (!stored) legacyKey = sessionStorage.getItem(LEGACY_ADMIN_KEY_STORAGE_KEY) ?? ''
    } catch {
      /* No legacy session to upgrade. */
    }
    void restore(stored, legacyKey)

    const sync = (event: StorageEvent) => {
      if (event.key !== ADMIN_SESSION_STORAGE_KEY && event.key !== null) return
      try {
        if (event.storageArea !== localStorage) return
      } catch {
        return
      }
      void restore(parseSavedAdminSession(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => {
      // oxlint-disable-next-line react/exhaustive-deps -- Invalidate pending authentication requests; this ref is a generation counter, not a DOM node.
      ++generation.current
      window.removeEventListener('storage', sync)
    }
  }, [lock, remember])

  useEffect(() => {
    if (expiresAt === null) return
    let timer: number | undefined
    const expire = () => {
      window.clearTimeout(timer)
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) lock()
      else timer = window.setTimeout(expire, Math.min(ADMIN_SESSION_DURATION, remaining))
    }
    expire()
    window.addEventListener('focus', expire)
    document.addEventListener('visibilitychange', expire)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', expire)
      document.removeEventListener('visibilitychange', expire)
    }
  }, [expiresAt, lock])

  return { key, admin, authReady, unlock, lock }
}

const AdminContext = createContext<ReturnType<typeof useSession> | null>(null)

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  return <AdminContext.Provider value={session}>{children}</AdminContext.Provider>
}

export function useAdminSession() {
  const session = useContext(AdminContext)
  if (!session) throw new Error('Admin session requires <AdminSessionProvider>.')
  return session
}
