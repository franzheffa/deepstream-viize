import { NextRequest, NextResponse } from 'next/server'
import { addSource, getSourcesPayload, type SourcePayload } from '../../../lib/runtime-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getSourcesPayload()
  return NextResponse.json(payload)
}

export async function POST(req: NextRequest) {
  let body: SourcePayload

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  if (!body?.id || !body?.name || !body?.type) {
    return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
  }

  const sources = await addSource(body)

  return NextResponse.json({
    ok: true,
    source: body,
    sources,
  })
}
