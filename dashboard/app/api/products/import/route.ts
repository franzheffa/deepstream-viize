import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../../lib/auth'
import { normalizeStockStatus } from '../../../../lib/dashboard-data'
import { prisma } from '../../../../lib/prisma'
import { hasRole } from '../../../../lib/roles'
import { parseCatalogCsv } from '../../../../lib/retail-onboarding'

export const dynamic = 'force-dynamic'

type ImportRow = {
  sku: string
  barcode?: string | null
  name: string
  category?: string | null
  unit?: string | null
  aisle?: string | null
  shelf?: string | null
  threshold?: number
  stockOnHand?: number
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
  const csvText = String(body?.csvText || '').trim()
  const items = Array.isArray(body?.items) ? (body?.items as ImportRow[]) : []

  const rows = csvText ? parseCatalogCsv(csvText) : items

  if (!rows.length) {
    return NextResponse.json({ error: 'Aucun produit exploitable a importer.' }, { status: 400 })
  }

  const imported: { sku: string; name: string }[] = []

  for (const row of rows) {
    const sku = String(row.sku || '').trim().toUpperCase()
    const name = String(row.name || '').trim()

    if (!sku || !name) {
      continue
    }

    const barcode = String(row.barcode || '').trim() || null
    const threshold = Number(row.threshold || 0)
    const stockOnHand = Number(row.stockOnHand || 0)

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
        category: String(row.category || '').trim() || null,
        unit: String(row.unit || '').trim() || 'unit',
        aisle: String(row.aisle || '').trim() || null,
        shelf: String(row.shelf || '').trim() || null,
        threshold,
        stockOnHand,
        status: normalizeStockStatus(stockOnHand, threshold),
      },
      create: {
        storeId: membership.storeId,
        sku,
        barcode,
        name,
        category: String(row.category || '').trim() || null,
        unit: String(row.unit || '').trim() || 'unit',
        aisle: String(row.aisle || '').trim() || null,
        shelf: String(row.shelf || '').trim() || null,
        threshold,
        stockOnHand,
        status: normalizeStockStatus(stockOnHand, threshold),
      },
    })

    imported.push({ sku: product.sku, name: product.name })
  }

  await prisma.auditLog.create({
    data: {
      storeId: membership.storeId,
      userId: membership.userId,
      level: 'info',
      action: 'catalog_imported',
      entityType: 'product_batch',
      entityId: membership.storeId,
      metadata: {
        count: imported.length,
        source: csvText ? 'csv' : 'json',
      },
    },
  })

  return NextResponse.json({
    ok: true,
    importedCount: imported.length,
    imported,
  })
}
