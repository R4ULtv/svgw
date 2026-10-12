export const ADMIN_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000
export const ADMIN_SESSION_STORAGE_KEY = 'svgw:admin-session'
export const LEGACY_ADMIN_KEY_STORAGE_KEY = 'svgw:admin-key'
export const ADMIN_SESSION_TOKEN_PATTERN =
  /^svgw-session-v1\.(\d{1,16})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/

export interface SavedAdminSession {
  token: string
  expiresAt: number
}

export function parseSavedAdminSession(
  value: string | null,
  now = Date.now(),
): SavedAdminSession | null {
  if (!value) return null
  try {
    const session: unknown = JSON.parse(value)
    if (
      !session ||
      typeof session !== 'object' ||
      !('token' in session) ||
      typeof session.token !== 'string' ||
      !ADMIN_SESSION_TOKEN_PATTERN.test(session.token) ||
      session.token.length > 1024 ||
      !('expiresAt' in session) ||
      typeof session.expiresAt !== 'number' ||
      !Number.isSafeInteger(session.expiresAt) ||
      session.expiresAt <= now ||
      Number(session.token.split('.')[1]) !== session.expiresAt
    )
      return null
    return { token: session.token, expiresAt: session.expiresAt }
  } catch {
    return null
  }
}
