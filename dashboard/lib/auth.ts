import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { signSession, verifySession, type SessionPayload } from './security'

export const SESSION_COOKIE = 'viize_session'

export async function getSessionFromRequest(request?: NextRequest): Promise<SessionPayload | null> {
  const cookieStore = request ? request.cookies : await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) {
    return null
  }

  const session = verifySession(token)

  if (!session) {
    return null
  }

  return session
}

export function applySessionCookie(response: NextResponse, payload: Omit<SessionPayload, 'exp'>) {
  const token = signSession({
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  })

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export async function requireSession(request?: NextRequest) {
  const session = await getSessionFromRequest(request)

  if (!session) {
    return null
  }

  const membership = await prisma.storeMembership.findFirst({
    where: {
      userId: session.userId,
      storeId: session.storeId,
      role: session.role,
    },
    include: {
      store: true,
      user: true,
    },
  })

  return membership
}
