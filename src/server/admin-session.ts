import {
  ADMIN_SESSION_DURATION,
  ADMIN_SESSION_TOKEN_PATTERN,
  type SavedAdminSession,
} from '../lib/saved-admin-session'

function signingKey(adminKey: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(adminKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function createAdminSession(
  adminKey: string,
  now = Date.now(),
): Promise<SavedAdminSession> {
  const expiresAt = now + ADMIN_SESSION_DURATION
  const payload = `svgw-session-v1.${expiresAt}.${crypto.randomUUID()}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(adminKey),
    new TextEncoder().encode(payload),
  )
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return { token: `${payload}.${hex}`, expiresAt }
}

export async function verifyAdminSession(token: string, adminKey: string, now = Date.now()) {
  const match = ADMIN_SESSION_TOKEN_PATTERN.exec(token)
  if (!match || !adminKey) return false
  const expiresAt = Number(match[1])
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false
  const signature = Uint8Array.from(match[3].match(/../g)!, (byte) => parseInt(byte, 16))
  return crypto.subtle.verify(
    'HMAC',
    await signingKey(adminKey),
    signature,
    new TextEncoder().encode(token.slice(0, token.lastIndexOf('.'))),
  )
}
