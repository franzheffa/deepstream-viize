import { NextResponse } from 'next/server'
import { getHealthPayload, getSourcesPayload } from '../../../lib/runtime-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health = getHealthPayload()
  const sources = await getSourcesPayload()

  return NextResponse.json({
    ...health,
    sourceCount: sources.sources.length,
    persistence: sources.persistence,
  })
}
