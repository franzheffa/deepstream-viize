import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '../../../lib/auth'
import { healthPayload, loadStoreRuntime } from '../../../lib/dashboard-data'
import { prisma } from '../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)

  if (session) {
    const runtime = await loadStoreRuntime(session.storeId)

    if (runtime) {
      return NextResponse.json(runtime.health)
    }
  }

  const fallbackStore =
    (await prisma.store.findFirst({
      orderBy: { createdAt: 'asc' },
    })) || null

  const base = healthPayload(fallbackStore?.slug || (process.env.NEXT_PUBLIC_STORE_ID ?? 'epicerie-saint-denis-mtl').trim())

  return NextResponse.json({
    ...base,
    sourceCount: fallbackStore ? await prisma.cameraSource.count({ where: { storeId: fallbackStore.id } }) : 0,
    persistence: fallbackStore ? 'prisma-postgres' : 'bootstrap-pending',
  })
}
