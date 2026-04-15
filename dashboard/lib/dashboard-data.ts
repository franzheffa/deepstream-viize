import { prisma } from './prisma'

export function normalizeStockStatus(stockOnHand: number, threshold: number) {
  if (stockOnHand <= Math.max(1, Math.floor(threshold * 0.5))) {
    return 'critical'
  }

  if (stockOnHand <= threshold) {
    return 'low'
  }

  return 'ok'
}

export function healthPayload(storeSlug: string) {
  return {
    ok: true,
    service: 'deepstream-viize',
    status: 'ok',
    runtime: 'nextjs',
    timestamp: new Date().toISOString(),
    store: storeSlug,
    posture: 'fdx-grade retail telemetry',
    privacy: 'camera analytics + least-data + regional controls',
  }
}

export async function loadStoreRuntime(storeId: string) {
  const [store, sources, bridgeProfiles, products, scans, audits] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
    }),
    prisma.cameraSource.findMany({
      where: { storeId },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.bridgeProfile.findMany({
      where: { storeId },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.product.findMany({
      where: { storeId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.inventoryScan.findMany({
      where: { storeId },
      include: {
        product: true,
        cameraSource: true,
        user: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 12,
    }),
    prisma.auditLog.findMany({
      where: { storeId },
      orderBy: [{ createdAt: 'desc' }],
      take: 12,
    }),
  ])

  if (!store) {
    return null
  }

  const normalizedProducts = products.map((product) => {
    const status = normalizeStockStatus(product.stockOnHand, product.threshold)

    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      unit: product.unit,
      aisle: product.aisle,
      shelf: product.shelf,
      threshold: product.threshold,
      stockOnHand: product.stockOnHand,
      status,
      emoji:
        product.category === 'Boissons'
          ? '🥤'
          : product.category === 'Boulangerie'
            ? '🥖'
            : product.category === 'Frais'
              ? '🥛'
              : product.category === 'Snacking'
                ? '🍿'
                : '📦',
    }
  })

  const kpis = {
    criticalProducts: normalizedProducts.filter((item) => item.status === 'critical').length,
    lowProducts: normalizedProducts.filter((item) => item.status === 'low').length,
    liveSources: sources.filter((item) => ['live', 'ready'].includes(item.status)).length,
    sourceCount: sources.length,
    scans24h: scans.length,
  }

  return {
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      city: store.city,
      country: store.country,
      address: store.address,
      timezone: store.timezone,
      type: store.type,
      status: store.status,
      metadata: store.metadata,
    },
    health: {
      ...healthPayload(store.slug),
      sourceCount: sources.length,
      persistence: 'prisma-postgres',
    },
    kpis,
    sources: sources.map((source) => ({
      id: source.sourceKey,
      dbId: source.id,
      name: source.name,
      type: source.type,
      input: source.input,
      ingestUrl: source.ingestUrl,
      playback: source.playbackUrl,
      status: source.status,
      zone: source.zone,
      purpose: source.purpose,
      capabilities: source.capabilities,
    })),
    bridgeProfiles: bridgeProfiles.map((profile) => ({
      id: profile.id,
      profileKey: profile.profileKey,
      name: profile.name,
      mode: profile.mode,
      rtspUrl: profile.rtspUrl,
      webrtcUrl: profile.webrtcUrl,
      hlsUrl: profile.hlsUrl,
      edgeRegion: profile.edgeRegion,
      status: profile.status,
      metadata: profile.metadata,
    })),
    products: normalizedProducts,
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
    audits: audits.map((audit) => ({
      id: audit.id,
      level: audit.level,
      action: audit.action,
      entityType: audit.entityType,
      entityId: audit.entityId,
      createdAt: audit.createdAt,
      metadata: audit.metadata,
    })),
  }
}
