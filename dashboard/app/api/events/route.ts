import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── In-memory circular buffer ─────────────────────────────────────────────────
// Fonctionne en Next.js dev et Vercel (instances chaudes).
// Production persistante → migrer vers Vercel KV :
//   https://vercel.com/docs/storage/vercel-kv
const MAX_EVENTS = 200
const WEBHOOK_SECRET = process.env.DEEPSTREAM_WEBHOOK_SECRET ?? 'ds-secret-change-me-in-prod'

declare global {
  // eslint-disable-next-line no-var
  var __viize_events: EventRecord[]
}
global.__viize_events ??= []

interface EventRecord {
  entry?: number
  exit?: number
  occupancy?: number
  ts: string
  streamId?: string
  detections?: number
}

// ── GET — polling frontend ────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ events: global.__viize_events })
}

// ── POST — webhook DeepStream → dashboard ────────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const payload  = body.payload as Record<string, unknown> | undefined
  const dets     = (payload?.detections as unknown[]) ?? []
  const streamId = (body.streamId as string) ?? 'unknown'

  const occupancy = dets.filter((d: unknown) => {
    const det = d as Record<string, unknown>
    return det.label === 'Person' || det.classId === 0
  }).length

  const record: EventRecord = {
    ts:         (body.timestamp as string) ?? new Date().toISOString(),
    streamId,
    occupancy,
    entry:      occupancy,
    exit:       0,
    detections: dets.length,
  }

  global.__viize_events.unshift(record)
  if (global.__viize_events.length > MAX_EVENTS) {
    global.__viize_events.length = MAX_EVENTS
  }

  return NextResponse.json({ ok: true, processed: dets.length, occupancy })
}
