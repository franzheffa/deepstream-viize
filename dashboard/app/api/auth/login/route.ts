import { NextResponse } from 'next/server'
import { applySessionCookie } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { ensureStoreSeed } from '../../../../lib/seed-data'
import { verifyPassword } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const requestedStoreId = String(body?.storeId || '').trim()

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            store: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 })
    }

    const membership =
      user.memberships.find((item) => item.storeId === requestedStoreId) ||
      user.memberships[0]

    if (!membership) {
      return NextResponse.json({ error: 'Aucun magasin assigne a ce compte.' }, { status: 403 })
    }

    await ensureStoreSeed(membership.storeId)

    await prisma.auditLog.create({
      data: {
        storeId: membership.storeId,
        userId: user.id,
        action: 'login_success',
        entityType: 'user',
        entityId: user.id,
        metadata: { email },
      },
    })

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      membership: {
        role: membership.role,
        storeId: membership.storeId,
        storeName: membership.store.name,
      },
    })

    applySessionCookie(response, {
      userId: user.id,
      storeId: membership.storeId,
      role: membership.role,
      email: user.email,
    })

    return response
  } catch (error) {
    console.error('[auth/login] failed', error)
    return NextResponse.json({ error: 'Impossible de se connecter.' }, { status: 500 })
  }
}
