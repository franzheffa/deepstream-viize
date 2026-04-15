import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { normalizeStockStatus } from '../../../lib/dashboard-data'
import { prisma } from '../../../lib/prisma'
import { hasRole } from '../../../lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const scans = await prisma.inventoryScan.findMany({
    where: { storeId: membership.storeId },
    include: {
      product: true,
      cameraSource: true,
      user: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 20,
  })

  return NextResponse.json({
    ok: true,
    scans: scans.map((scan) => ({
      id: scan.id,
      sourceType: scan.sourceType,
      barcode: scan.barcode,
      quantity: scan.quantity,
      confidence: scan.confidence,
      zone: scan.zone,
      createdAt: scan.createdAt,
      productName: scan.product?.name || null,
      sourceName: scan.cameraSource?.name || null,
      actorName: scan.user?.displayName || scan.user?.email || null,
      payload: scan.payload,
    })),
  })
}

export async function POST(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  if (!hasRole(membership.role, 'operator')) {
    return NextResponse.json({ error: 'Role insuffisant.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const barcode = String(body?.barcode || '').trim()
  const sku = String(body?.sku || '').trim().toUpperCase()
  const sourceKey = String(body?.sourceKey || '').trim()
  const sourceType = String(body?.sourceType || '').trim() || 'manual'
  const zone = String(body?.zone || '').trim() || null
  const quantity = Number(body?.quantity || 0)
  const confidence = body?.confidence == null ? null : Number(body.confidence)
  const mode = String(body?.mode || 'set').trim()
  const payload = body?.payload ?? null

  if (!barcode && !sku) {
    return NextResponse.json({ error: 'barcode ou sku requis.' }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: {
      storeId: membership.storeId,
      OR: [{ barcode: barcode || undefined }, { sku: sku || undefined }],
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })
  }

  const cameraSource = sourceKey
    ? await prisma.cameraSource.findFirst({
        where: {
          storeId: membership.storeId,
          sourceKey,
        },
      })
    : null

  const nextStock = mode === 'delta' ? Math.max(0, product.stockOnHand + quantity) : Math.max(0, quantity)

  const updatedProduct = await prisma.product.update({
    where: { id: product.id },
    data: {
      stockOnHand: nextStock,
      status: normalizeStockStatus(nextStock, product.threshold),
    },
  })

  const scan = await prisma.inventoryScan.create({
    data: {
      storeId: membership.storeId,
      productId: product.id,
      cameraSourceId: cameraSource?.id,
      userId: membership.userId,
      sourceType,
      barcode: barcode || product.barcode,
      quantity: nextStock,
      confidence,
      zone,
      payload: payload as never,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId: membership.storeId,
      userId: membership.userId,
      level: updatedProduct.status === 'critical' ? 'warn' : 'info',
      action: 'inventory_scan_recorded',
      entityType: 'inventory_scan',
      entityId: scan.id,
      metadata: {
        productId: product.id,
        sku: product.sku,
        barcode: barcode || product.barcode,
        previousStock: product.stockOnHand,
        nextStock,
        sourceKey,
        sourceType,
      },
    },
  })

  return NextResponse.json({
    ok: true,
    scanId: scan.id,
    product: {
      id: updatedProduct.id,
      sku: updatedProduct.sku,
      name: updatedProduct.name,
      stockOnHand: updatedProduct.stockOnHand,
      threshold: updatedProduct.threshold,
      status: updatedProduct.status,
    },
  })
}
