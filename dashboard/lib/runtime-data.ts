import fs from 'node:fs/promises'
import path from 'node:path'

export type SourcePayload = {
  id: string
  name: string
  type: string
  input: string
  playback: string | null
  status: string
  zone?: string
  purpose?: string
  capabilities?: {
    iphone?: boolean
    lidarReady?: boolean
    appleIntelligenceReady?: boolean
    stockScanning?: boolean
    parking?: boolean
  }
}

export type HealthPayload = {
  ok: boolean
  service: string
  status: string
  runtime: string
  timestamp: string
  store: string
  posture: string
  privacy: string
}

const sourcesFilePath = path.join(process.cwd(), '..', 'config', 'sources.json')
const storeId = process.env.NEXT_PUBLIC_STORE_ID ?? 'epicerie-saint-denis-mtl'

const DEFAULT_SOURCES: SourcePayload[] = [
  {
    id: 'cam-01',
    name: 'Entree principale',
    type: 'rtsp-camera',
    input: 'rtsp',
    playback: 'webrtc-or-hls',
    status: 'pending',
    zone: 'entree',
    purpose: 'surveillance + comptage + conversion',
    capabilities: { parking: false, stockScanning: false },
  },
  {
    id: 'cam-02',
    name: 'Rayon epicerie',
    type: 'rtsp-camera',
    input: 'rtsp',
    playback: 'webrtc-or-hls',
    status: 'pending',
    zone: 'rayons',
    purpose: 'stock + facing + rupture',
    capabilities: { stockScanning: true },
  },
  {
    id: 'mobile-lidar-01',
    name: 'iPhone LiDAR Scanner',
    type: 'iphone-lidar',
    input: 'browser-camera',
    playback: 'webrtc',
    status: 'ready',
    zone: 'reserve',
    purpose: 'scan produit + inventaire + reception',
    capabilities: {
      iphone: true,
      lidarReady: true,
      appleIntelligenceReady: true,
      stockScanning: true,
    },
  },
]

declare global {
  // eslint-disable-next-line no-var
  var __viize_sources: SourcePayload[] | undefined
}

global.__viize_sources ??= undefined

async function readSourcesFromDisk(): Promise<SourcePayload[] | null> {
  try {
    const raw = await fs.readFile(sourcesFilePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function getSourcesPayload() {
  if (global.__viize_sources?.length) {
    return {
      ok: true,
      sources: global.__viize_sources,
      note: 'RTSP direct browser playback is not supported; use HLS or WebRTC bridge.',
      persistence: 'memory-bootstrap',
    }
  }

  const diskSources = await readSourcesFromDisk()
  if (diskSources?.length) {
    global.__viize_sources = diskSources
    return {
      ok: true,
      sources: diskSources,
      note: 'RTSP direct browser playback is not supported; use HLS or WebRTC bridge.',
      persistence: 'disk',
    }
  }

  global.__viize_sources = DEFAULT_SOURCES

  return {
    ok: true,
    sources: DEFAULT_SOURCES,
    note: 'RTSP direct browser playback is not supported; use HLS or WebRTC bridge.',
    persistence: 'default-bootstrap',
  }
}

export async function addSource(source: SourcePayload) {
  const payload = await getSourcesPayload()
  const existing = payload.sources.find((item) => item.id === source.id)

  if (existing) {
    global.__viize_sources = payload.sources.map((item) => (item.id === source.id ? { ...item, ...source } : item))
  } else {
    global.__viize_sources = [source, ...payload.sources]
  }

  return global.__viize_sources
}

export function getHealthPayload(): HealthPayload {
  return {
    ok: true,
    service: 'deepstream-viize',
    status: 'ok',
    runtime: 'nextjs',
    timestamp: new Date().toISOString(),
    store: storeId,
    posture: 'fdx-grade retail telemetry',
    privacy: 'camera analytics + least-data + regional controls',
  }
}
