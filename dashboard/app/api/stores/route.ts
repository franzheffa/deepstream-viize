import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { ensureStoreSeed } from '../../../lib/seed-data'
import { hasRole } from '../../../lib/roles'
import { normalizeStoreSlug } from '../../../lib/retail-onboarding'

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
  const slug = normalizeStoreSlug(String(body?.slug || '').trim(), 'store')
  const name = String(body?.name || '').trim()
  const city = String(body?.city || '').trim() || 'Montreal'
  const country = String(body?.country || '').trim() || 'CA'
  const address = String(body?.address || '').trim() || null
  const type = String(body?.type || '').trim() || 'supermarket'
  const timezone = String(body?.timezone || '').trim() || 'America/Toronto'
  const brandName = String(body?.brandName || '').trim() || null
  const parkingEnabled = body?.parkingEnabled !== false
  const lidarEnabled = body?.lidarEnabled !== false
  const voiceAssistantEnabled = body?.voiceAssistantEnabled !== false
  const onboardingMode = String(body?.onboardingMode || '').trim() || 'plug-and-play'
  const cameraPlan = String(body?.cameraPlan || '').trim() || 'starter'

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
      timezone,
      metadata: {
        brandName,
        parking: parkingEnabled,
        voiceAssistant: voiceAssistantEnabled,
        lidarIntake: lidarEnabled,
        onboardingMode,
        cameraPlan,
        onboardingChecklist: [
          'create-owner',
          'create-store',
          'provision-first-camera',
          'import-catalog',
          'start-first-scan',
        ],
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
      metadata: { slug, name, city, country, type, timezone, parkingEnabled, lidarEnabled, voiceAssistantEnabled, onboardingMode, cameraPlan },
    },
  })

  return NextResponse.json({
    ok: true,
    store,
    onboarding: {
      mode: onboardingMode,
      next: [
        'registrer une camera ou un iPhone',
        'laisser VIIZE provisionner le bridge',
        'importer le catalogue produit',
      ],
    },
  })
}
