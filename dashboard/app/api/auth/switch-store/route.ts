import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookie, requireSession } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const storeId = String(body?.storeId || '').trim()

  if (!storeId) {
    return NextResponse.json({ error: 'storeId requis.' }, { status: 400 })
  }

  const nextMembership = await prisma.storeMembership.findFirst({
    where: {
      userId: membership.userId,
      storeId,
    },
    include: {
      store: true,
      user: true,
    },
  })

  if (!nextMembership) {
    return NextResponse.json({ error: 'Magasin non autorise.' }, { status: 403 })
  }

  await prisma.auditLog.create({
    data: {
      storeId,
      userId: membership.userId,
      level: 'info',
      action: 'store_switched',
      entityType: 'store',
      entityId: storeId,
      metadata: {
        fromStoreId: membership.storeId,
        toStoreId: storeId,
      },
    },
  })

  const response = NextResponse.json({
    ok: true,
    membership: {
      storeId,
      storeName: nextMembership.store.name,
      role: nextMembership.role,
    },
  })

  applySessionCookie(response, {
    userId: membership.userId,
    storeId,
    role: nextMembership.role,
    email: nextMembership.user.email,
  })

  return response
}
