import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  let bootstrapAllowed = true
  let databaseReady = true

  try {
    bootstrapAllowed = (await prisma.user.count()) === 0
  } catch (error) {
    databaseReady = false
    console.error('[auth/me] user.count failed', error)
  }

  if (!session) {
    return NextResponse.json({ authenticated: false, bootstrapAllowed, databaseReady })
  }

  try {
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
      return NextResponse.json({ authenticated: false, bootstrapAllowed, databaseReady }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      bootstrapAllowed,
      databaseReady,
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
  } catch (error) {
    console.error('[auth/me] user lookup failed', error)
    return NextResponse.json({
      authenticated: false,
      bootstrapAllowed,
      databaseReady: false,
      error: 'database_unavailable',
    })
  }
}
