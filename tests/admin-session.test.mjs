import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ADMIN_SESSION_DURATION, parseSavedAdminSession } from '../src/lib/saved-admin-session.ts'

const now = 1_800_000_000_000
const savedSession = (expiresAt = now + ADMIN_SESSION_DURATION) => ({
  token: `svgw-session-v1.${expiresAt}.00000000-0000-4000-8000-000000000000.${'a'.repeat(64)}`,
  expiresAt,
})

test('saved login survives reopening until its original seven-day expiry', () => {
  const session = savedSession()
  const stored = JSON.stringify(session)
  assert.deepEqual(parseSavedAdminSession(stored, now), session)
  assert.deepEqual(parseSavedAdminSession(stored, now - 5 * 60 * 1000), session)
  assert.deepEqual(parseSavedAdminSession(stored, now + 6 * 24 * 60 * 60 * 1000), session)
  assert.deepEqual(parseSavedAdminSession(stored, session.expiresAt - 1), session)
  assert.equal(parseSavedAdminSession(stored, session.expiresAt), null)
  assert.equal(parseSavedAdminSession(stored, session.expiresAt + 1), null)
})

test('missing, corrupt, legacy, or invalid saved logins cannot restore access', () => {
  for (const value of [
    null,
    '',
    'not json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ key: 'an-old-admin-key' }),
    JSON.stringify({ ...savedSession(), token: 'an-admin-key' }),
    JSON.stringify({ ...savedSession(), token: 'svgw-session-v1.malformed' }),
    JSON.stringify({ ...savedSession(), expiresAt: String(now + ADMIN_SESSION_DURATION) }),
    JSON.stringify({ ...savedSession(), expiresAt: now + 1 }),
    JSON.stringify(savedSession(now - 1)),
  ]) {
    assert.equal(parseSavedAdminSession(value, now), null)
  }
})
