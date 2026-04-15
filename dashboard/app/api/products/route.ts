import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { loadStoreRuntime, normalizeStockStatus } from '../../../lib/dashboard-data'
import { prisma } from '../../../lib/prisma'
import { hasRole } from '../../../lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const runtime = await loadStoreRuntime(membership.storeId)

  return NextResponse.json({
    ok: true,
    products: runtime?.products || [],
  })
}

export async function POST(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  if (!hasRole(membership.role, 'manager')) {
    return NextResponse.json({ error: 'Role insuffisant.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const sku = String(body?.sku || '').trim().toUpperCase()
  const barcode = String(body?.barcode || '').trim() || null
  const name = String(body?.name || '').trim()
  const category = String(body?.category || '').trim() || null
  const unit = String(body?.unit || '').trim() || 'unit'
  const aisle = String(body?.aisle || '').trim() || null
  const shelf = String(body?.shelf || '').trim() || null
  const threshold = Number(body?.threshold || 0)
  const stockOnHand = Number(body?.stockOnHand || 0)

  if (!sku || !name) {
    return NextResponse.json({ error: 'sku et name requis.' }, { status: 400 })
  }

  const product = await prisma.product.upsert({
    where: {
      storeId_sku: {
        storeId: membership.storeId,
        sku,
      },
    },
    update: {
      barcode,
      name,
      category,
      unit,
      aisle,
      shelf,
      threshold,
      stockOnHand,
      status: normalizeStockStatus(stockOnHand, threshold),
    },
    create: {
      storeId: membership.storeId,
      sku,
      barcode,
      name,
      category,
      unit,
      aisle,
      shelf,
      threshold,
      stockOnHand,
      status: normalizeStockStatus(stockOnHand, threshold),
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId: membership.storeId,
      userId: membership.userId,
      level: 'info',
      action: 'product_upserted',
      entityType: 'product',
      entityId: product.id,
      metadata: { sku, barcode, stockOnHand, threshold },
    },
  })

  return NextResponse.json({ ok: true, product })
}
