import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { ensureStoreSeed } from '../../../lib/seed-data'
import { hasRole } from '../../../lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const memberships = await prisma.storeMembership.findMany({
    where: { userId: membership.userId },
    include: { store: true },
    orderBy: [{ createdAt: 'asc' }],
  })

  return NextResponse.json({
    ok: true,
    stores: memberships.map((item) => ({
      storeId: item.storeId,
      storeSlug: item.store.slug,
      storeName: item.store.name,
      city: item.store.city,
      country: item.store.country,
      role: item.role,
      status: item.store.status,
    })),
  })
}

export async function POST(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  if (!hasRole(membership.role, 'owner')) {
    return NextResponse.json({ error: 'Role insuffisant.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const slug = String(body?.slug || '').trim().toLowerCase()
  const name = String(body?.name || '').trim()
  const city = String(body?.city || '').trim() || 'Montreal'
  const country = String(body?.country || '').trim() || 'CA'
  const address = String(body?.address || '').trim() || null
  const type = String(body?.type || '').trim() || 'supermarket'

  if (!slug || !name) {
    return NextResponse.json({ error: 'slug et name requis.' }, { status: 400 })
  }

  const store = await prisma.store.create({
    data: {
      slug,
      name,
      city,
      country,
      address,
      type,
      metadata: {
        parking: true,
        voiceAssistant: true,
        lidarIntake: true,
      },
    },
  })

  await prisma.storeMembership.create({
    data: {
      userId: membership.userId,
      storeId: store.id,
      role: 'owner',
    },
  })

  await ensureStoreSeed(store.id)

  await prisma.auditLog.create({
    data: {
      storeId: store.id,
      userId: membership.userId,
      level: 'info',
      action: 'store_created',
      entityType: 'store',
      entityId: store.id,
      metadata: { slug, name, city, country, type },
    },
  })

  return NextResponse.json({ ok: true, store })
}
