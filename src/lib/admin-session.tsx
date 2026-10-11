import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cloudApi, CloudError } from './cloud-api'

const SESSION_KEY = 'svgw:admin-key'

function useSession() {
  const key = useRef('')
  const [admin, setAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  function lock() {
    key.current = ''
    setAdmin(false)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* Session memory still works. */
    }
  }

  async function unlock(value: string) {
    const candidate = value.trim()
    if (!candidate) throw new Error('Enter the key.')
    let result: Awaited<ReturnType<typeof cloudApi.admin>>
    try {
      result = await cloudApi.admin(candidate)
    } catch (cause) {
      if (cause instanceof CloudError && cause.status === 401)
        throw new Error('The key is incorrect. Try again.')
      throw cause
    }
    if (!result.configured) throw new Error('Remote access is not configured for this instance.')
    if (!result.admin) throw new Error('The key is incorrect. Try again.')
    key.current = candidate
    setAdmin(true)
    try {
      sessionStorage.setItem(SESSION_KEY, candidate)
    } catch {
      /* Keep the key in memory for this session. */
    }
  }

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      let stored = ''
      try {
        stored = sessionStorage.getItem(SESSION_KEY) ?? ''
      } catch {
        /* No persistent session. */
      }
      if (stored) {
        try {
          const result = await cloudApi.admin(stored)
          if (!cancelled) {
            if (result.admin) {
              key.current = stored
              setAdmin(true)
            } else lock()
          }
        } catch (cause) {
          if (!cancelled) {
            if (cause instanceof CloudError && (cause.status === 0 || cause.status === 503)) {
              // A previously connected session can keep working locally while offline.
              key.current = stored
              setAdmin(true)
            } else lock()
          }
        }
      }
      if (!cancelled) setAuthReady(true)
    }
    void initialize()
    return () => {
      cancelled = true
    }
  }, [])

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
