import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { hasRole } from '../../../lib/roles'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const bridges = await prisma.bridgeProfile.findMany({
    where: { storeId: membership.storeId },
    include: {
      cameraSource: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  return NextResponse.json({
    ok: true,
    bridgeProfiles: bridges.map((bridge) => ({
      id: bridge.id,
      profileKey: bridge.profileKey,
      name: bridge.name,
      mode: bridge.mode,
      rtspUrl: bridge.rtspUrl,
      webrtcUrl: bridge.webrtcUrl,
      hlsUrl: bridge.hlsUrl,
      edgeRegion: bridge.edgeRegion,
      status: bridge.status,
      sourceName: bridge.cameraSource?.name || null,
      metadata: bridge.metadata,
    })),
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
  const profileKey = String(body?.profileKey || '').trim()
  const name = String(body?.name || '').trim()
  const mode = String(body?.mode || '').trim() || 'rtsp-to-webrtc-hls'
  const sourceKey = String(body?.sourceKey || '').trim()
  const rtspUrl = String(body?.rtspUrl || '').trim() || null
  const webrtcUrl = String(body?.webrtcUrl || '').trim() || null
  const hlsUrl = String(body?.hlsUrl || '').trim() || null
  const edgeRegion = String(body?.edgeRegion || '').trim() || null
  const status = String(body?.status || '').trim() || 'planned'
  const metadata = body?.metadata ?? null

  if (!profileKey || !name) {
    return NextResponse.json({ error: 'profileKey et name requis.' }, { status: 400 })
  }

  const cameraSource = sourceKey
    ? await prisma.cameraSource.findFirst({
        where: {
          storeId: membership.storeId,
          sourceKey,
        },
      })
    : null

  const bridge = await prisma.bridgeProfile.upsert({
    where: {
      storeId_profileKey: {
        storeId: membership.storeId,
        profileKey,
      },
    },
    update: {
      name,
      mode,
      rtspUrl,
      webrtcUrl,
      hlsUrl,
      edgeRegion,
      status,
      metadata: metadata as never,
      cameraSourceId: cameraSource?.id || null,
    },
    create: {
      storeId: membership.storeId,
      profileKey,
      name,
      mode,
      rtspUrl,
      webrtcUrl,
      hlsUrl,
      edgeRegion,
      status,
      metadata: metadata as never,
      cameraSourceId: cameraSource?.id || null,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId: membership.storeId,
      userId: membership.userId,
      level: 'info',
      action: 'bridge_profile_upserted',
      entityType: 'bridge_profile',
      entityId: bridge.id,
      metadata: {
        profileKey,
        sourceKey,
        mode,
        status,
        rtspUrl,
        webrtcUrl,
        hlsUrl,
      },
    },
  })

  return NextResponse.json({ ok: true, bridge })
}
