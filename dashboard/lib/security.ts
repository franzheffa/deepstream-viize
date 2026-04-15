import crypto from 'node:crypto'
import { readEnv } from './env'

const SESSION_SECRET = readEnv('VIIZE_SESSION_SECRET', 'DEEPSTREAM_WEBHOOK_SECRET') || 'viize-session-secret-change-me'

function b64url(input: Buffer | string) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return value.toString('base64url')
}

function fromB64url(input: string) {
  return Buffer.from(input, 'base64url')
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt:${b64url(salt)}:${b64url(hash)}`
}

export function verifyPassword(password: string, storedHash: string) {
  if (!storedHash.startsWith('scrypt:')) {
    return false
  }

  const [, saltValue, hashValue] = storedHash.split(':')
  const salt = fromB64url(saltValue)
  const expected = fromB64url(hashValue)
  const actual = crypto.scryptSync(password, salt, expected.length)

  return crypto.timingSafeEqual(actual, expected)
}

export type SessionPayload = {
  userId: string
  storeId: string
  role: string
  email: string
  exp: number
}

export function signSession(payload: SessionPayload) {
  const encodedPayload = b64url(JSON.stringify(payload))
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

export function verifySession(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url')
  const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

  if (!matches) {
    return null
  }

  try {
    const payload = JSON.parse(fromB64url(encodedPayload).toString('utf8')) as SessionPayload

    if (payload.exp < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
