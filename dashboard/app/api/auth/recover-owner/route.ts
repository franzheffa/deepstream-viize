import { NextResponse } from 'next/server'
import { applySessionCookie } from '../../../../lib/auth'
import { readEnv } from '../../../../lib/env'
import { prisma } from '../../../../lib/prisma'
import { hashPassword } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const recoveryCode = String(body?.recoveryCode || '').trim()

    if (!email || !email.includes('@') || password.length < 8 || !recoveryCode) {
      return NextResponse.json({ error: 'Informations invalides pour la reprise d acces.' }, { status: 400 })
    }

    const users = await prisma.user.findMany({
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
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (users.length !== 1) {
      return NextResponse.json({ error: 'La reprise owner est desactivee pour cette base.' }, { status: 403 })
    }

    const user = users[0]
    const expectedCode = (readEnv('VIIZE_OWNER_RECOVERY_CODE') || readEnv('DEEPSTREAM_WEBHOOK_SECRET') || '').trim()

    if (!expectedCode || recoveryCode !== expectedCode) {
      return NextResponse.json({ error: 'Code de reprise invalide.' }, { status: 401 })
    }

    if (user.email !== email) {
      return NextResponse.json({ error: 'Le compte owner ne correspond pas a cet email.' }, { status: 403 })
    }

    const membership = user.memberships[0]

    if (!membership) {
      return NextResponse.json({ error: 'Aucun magasin assigne a ce compte owner.' }, { status: 403 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        status: 'active',
      },
    })

    await prisma.auditLog.create({
      data: {
        storeId: membership.storeId,
        userId: updatedUser.id,
        level: 'warn',
        action: 'owner_access_recovered',
        entityType: 'user',
        entityId: updatedUser.id,
        metadata: { email: updatedUser.email },
      },
    })

    const response = NextResponse.json({
      ok: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
      },
      membership: {
        role: membership.role,
        storeId: membership.storeId,
        storeName: membership.store.name,
      },
    })

    applySessionCookie(response, {
      userId: updatedUser.id,
      storeId: membership.storeId,
      role: membership.role,
      email: updatedUser.email,
    })

    return response
  } catch (error) {
    console.error('[auth/recover-owner] failed', error)
    return NextResponse.json({ error: 'Impossible de reprendre l acces owner.' }, { status: 500 })
  }
}
