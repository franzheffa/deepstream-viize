import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { loadStoreRuntime } from '../../../lib/dashboard-data'
import { ensureStoreSeed } from '../../../lib/seed-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  await ensureStoreSeed(membership.storeId)

  const runtime = await loadStoreRuntime(membership.storeId)

  if (!runtime) {
    return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    role: membership.role,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
    },
    ...runtime,
  })
}
