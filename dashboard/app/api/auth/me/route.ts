import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  const bootstrapAllowed = (await prisma.user.count()) === 0

  if (!session) {
    return NextResponse.json({ authenticated: false, bootstrapAllowed }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
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

  if (!user) {
    return NextResponse.json({ authenticated: false, bootstrapAllowed }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    bootstrapAllowed,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    currentStoreId: session.storeId,
    currentRole: session.role,
    memberships: user.memberships.map((membership) => ({
      role: membership.role,
      storeId: membership.storeId,
      storeSlug: membership.store.slug,
      storeName: membership.store.name,
      status: membership.store.status,
    })),
  })
}
