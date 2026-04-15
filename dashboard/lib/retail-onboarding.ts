type CsvProductRow = {
  sku: string
  barcode: string | null
  name: string
  category: string | null
  unit: string
  aisle: string | null
  shelf: string | null
  threshold: number
  stockOnHand: number
}

function slugifySegment(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

export function normalizeStoreSlug(value: string, fallback = 'store') {
  return slugifySegment(value, fallback)
}

export function normalizeSourceKey(value: string, fallback = 'camera') {
  return slugifySegment(value, fallback)
}

export function buildBridgeProvisioning({
  storeSlug,
  sourceKey,
  edgeRegion,
}: {
  storeSlug: string
  sourceKey: string
  edgeRegion?: string | null
}) {
  const safeStore = normalizeStoreSlug(storeSlug, 'store')
  const safeSource = normalizeSourceKey(sourceKey, 'camera')
  const region = (edgeRegion || 'northamerica-northeast1').trim() || 'northamerica-northeast1'
  const host = `${safeStore}.${region}.viize.edge.buttertech.io`

  return {
    profileKey: `${safeSource}-bridge`,
    name: `Bridge ${safeSource.toUpperCase()}`,
    mode: 'rtsp-to-webrtc-hls',
    edgeRegion: region,
    rtspUrl: `rtsp://${host}/ingest/${safeSource}`,
    webrtcUrl: `webrtc://${host}/play/${safeSource}`,
    hlsUrl: `https://${host}/hls/${safeSource}/master.m3u8`,
    status: 'planned',
    metadata: {
      host,
      provisionedBy: 'viize-auto-bridge',
      onboarding: 'plug-and-play',
    },
  }
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parseCatalogCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return []
  }

  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase())
  const indexOf = (name: string) => header.indexOf(name)

  const rows: CsvProductRow[] = []

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const sku = String(cells[indexOf('sku')] || '').trim().toUpperCase()
    const name = String(cells[indexOf('name')] || '').trim()

    if (!sku || !name) {
      continue
    }

    rows.push({
      sku,
      barcode: String(cells[indexOf('barcode')] || '').trim() || null,
      name,
      category: String(cells[indexOf('category')] || '').trim() || null,
      unit: String(cells[indexOf('unit')] || '').trim() || 'unit',
      aisle: String(cells[indexOf('aisle')] || '').trim() || null,
      shelf: String(cells[indexOf('shelf')] || '').trim() || null,
      threshold: toNumber(cells[indexOf('threshold')], 0),
      stockOnHand: toNumber(cells[indexOf('stockonhand')], 0),
    })
  }

  return rows
}

export function sampleCatalogCsv() {
  return [
    'sku,barcode,name,category,unit,aisle,shelf,threshold,stockOnHand',
    'EAU-1500,377001000011,Eau minerale 1.5L,Boissons,unit,B1,etagere 1,12,30',
    'PATES-500,377001000012,Pates fusilli 500g,Epicerie,unit,C4,etagere 3,18,42',
    'POMMES-1KG,377001000013,Pommes 1kg,Fruits,unit,F2,ilot fruits,10,16',
  ].join('\n')
}
