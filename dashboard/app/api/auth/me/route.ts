import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '../../../../lib/auth'
import { readRuntimeDatabaseUrl } from '../../../../lib/env'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  let bootstrapAllowed = true
  let databaseReady = true
  let databaseError: string | null = null
  const runtimeUrl = readRuntimeDatabaseUrl()
  const databaseUrlKind = runtimeUrl.startsWith('prisma+postgres://')
    ? 'prisma+postgres'
    : runtimeUrl.startsWith('postgres://') || runtimeUrl.startsWith('postgresql://')
      ? 'postgres'
      : 'missing'

  try {
    bootstrapAllowed = (await prisma.user.count()) === 0
  } catch (error) {
    databaseReady = false
    databaseError = error instanceof Error ? error.message : 'database_error'
    console.error('[auth/me] user.count failed', error)
  }

  if (!session) {
    return NextResponse.json({ authenticated: false, bootstrapAllowed, databaseReady, databaseError, databaseUrlKind })
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
      databaseError,
      databaseUrlKind,
      error: 'database_unavailable',
    })
  }
}
