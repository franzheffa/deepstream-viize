import { prisma } from './prisma'
import { hashPassword } from './security'

type BootstrapInput = {
  email: string
  password: string
  displayName: string
}

const DEFAULT_PRODUCTS = [
  { sku: 'EAU-500', barcode: '377001000001', name: 'Eau 500ml', category: 'Boissons', unit: 'unit', aisle: 'B3', shelf: 'etagere 2', threshold: 8, stockOnHand: 3, status: 'critical' },
  { sku: 'PAIN-BAG', barcode: '377001000002', name: 'Pain baguette', category: 'Boulangerie', unit: 'unit', aisle: 'A2', shelf: 'presentoir', threshold: 5, stockOnHand: 2, status: 'low' },
  { sku: 'YAOURT-NAT', barcode: '377001000003', name: 'Yaourt nature', category: 'Frais', unit: 'unit', aisle: 'C1', shelf: 'frais 1', threshold: 10, stockOnHand: 4, status: 'low' },
  { sku: 'JUS-ORANGE', barcode: '377001000004', name: 'Jus orange 1L', category: 'Boissons', unit: 'unit', aisle: 'D2', shelf: 'frigo', threshold: 6, stockOnHand: 12, status: 'ok' },
  { sku: 'CHIPS-NAT', barcode: '377001000005', name: 'Chips nature', category: 'Snacking', unit: 'unit', aisle: 'E1', shelf: 'snack 1', threshold: 5, stockOnHand: 18, status: 'ok' },
]

const DEFAULT_SOURCES = [
  {
    sourceKey: 'cam-01',
    name: 'Entree principale',
    type: 'rtsp-camera',
    input: 'rtsp',
    ingestUrl: 'rtsp://store-edge/cam-01',
    playbackUrl: 'webrtc://store-edge/cam-01',
    zone: 'entree',
    purpose: 'surveillance + comptage + conversion',
    status: 'pending',
    capabilities: { parking: false, stockScanning: false },
  },
  {
    sourceKey: 'cam-02',
    name: 'Rayon epicerie',
    type: 'rtsp-camera',
    input: 'rtsp',
    ingestUrl: 'rtsp://store-edge/cam-02',
    playbackUrl: 'hls://store-edge/cam-02',
    zone: 'rayons',
    purpose: 'stock + facing + rupture',
    status: 'pending',
    capabilities: { stockScanning: true },
  },
  {
    sourceKey: 'mobile-lidar-01',
    name: 'iPhone LiDAR Scanner',
    type: 'iphone-lidar',
    input: 'browser-camera',
    playbackUrl: 'webrtc://device/mobile-lidar-01',
    zone: 'reserve',
    purpose: 'scan produit + inventaire + reception',
    status: 'ready',
    capabilities: { iphone: true, lidarReady: true, appleIntelligenceReady: true, stockScanning: true },
  },
]

const DEFAULT_BRIDGE_PROFILES = [
  {
    profileKey: 'store-edge-01',
    name: 'Store edge bridge',
    mode: 'rtsp-to-webrtc-hls',
    rtspUrl: 'rtsp://store-edge/ingest',
    webrtcUrl: 'webrtc://store-edge/playback',
    hlsUrl: 'https://store-edge.example/hls/master.m3u8',
    edgeRegion: 'northamerica-northeast1',
    status: 'planned',
    metadata: { provider: 'nvidia-deepstream', deployment: 'edge' },
  },
]

export async function bootstrapOwnerAndStore(input: BootstrapInput) {
  const existingUsers = await prisma.user.count()

  if (existingUsers > 0) {
    throw new Error('bootstrap_locked')
  }

  const user = await prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash: hashPassword(input.password),
      status: 'active',
    },
  })

  const store = await prisma.store.create({
    data: {
      slug: 'epicerie-saint-denis-mtl',
      name: process.env.NEXT_PUBLIC_STORE_NAME?.trim() || 'Epicerie Saint-Denis',
      type: 'supermarket',
      country: 'CA',
      city: 'Montreal',
      address: 'Rue Saint-Denis, Montreal',
      timezone: 'America/Toronto',
      status: 'active',
      metadata: {
        parking: true,
        voiceAssistant: true,
        lidarIntake: true,
      },
    },
  })

  await prisma.storeMembership.create({
    data: {
      userId: user.id,
      storeId: store.id,
      role: 'owner',
    },
  })

  await ensureStoreSeed(store.id)

  await prisma.auditLog.create({
    data: {
      storeId: store.id,
      userId: user.id,
      level: 'info',
      action: 'bootstrap_owner_created',
      entityType: 'store',
      entityId: store.id,
      metadata: { email: user.email },
    },
  })

  return { user, store, role: 'owner' }
}

export async function ensureStoreSeed(storeId: string) {
  const existingSources = await prisma.cameraSource.count({ where: { storeId } })
  if (existingSources === 0) {
    await prisma.cameraSource.createMany({
      data: DEFAULT_SOURCES.map((source) => ({ storeId, ...source })),
    })
  }

  const existingProducts = await prisma.product.count({ where: { storeId } })
  if (existingProducts === 0) {
    await prisma.product.createMany({
      data: DEFAULT_PRODUCTS.map((product) => ({ storeId, ...product })),
    })
  }

  const existingBridges = await prisma.bridgeProfile.count({ where: { storeId } })
  if (existingBridges === 0) {
    await prisma.bridgeProfile.createMany({
      data: DEFAULT_BRIDGE_PROFILES.map((bridge) => ({ storeId, ...bridge })),
    })
  }
}
