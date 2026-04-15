import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '../../../lib/auth'
import { loadStoreRuntime } from '../../../lib/dashboard-data'
import { prisma } from '../../../lib/prisma'
import { hasRole } from '../../../lib/roles'
import { buildBridgeProvisioning } from '../../../lib/retail-onboarding'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const membership = await requireSession(request)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  const runtime = await loadStoreRuntime(membership.storeId)

  return NextResponse.json({
    ok: true,
    sources: runtime?.sources || [],
    note: 'RTSP direct browser playback is not supported; use HLS or WebRTC bridge.',
    persistence: 'prisma-postgres',
  })
}

export async function POST(req: NextRequest) {
  const membership = await requireSession(req)

  if (!membership) {
    return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 })
  }

  if (!hasRole(membership.role, 'operator')) {
    return NextResponse.json({ error: 'Role insuffisant.' }, { status: 403 })
  }

  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const sourceKey = String(body?.id || body?.sourceKey || '').trim()
  const name = String(body?.name || '').trim()
  const type = String(body?.type || '').trim()
  const input = String(body?.input || '').trim() || 'rtsp'
  const playbackUrl = String(body?.playback || body?.playbackUrl || '').trim() || null
  const ingestUrl = String(body?.ingestUrl || '').trim() || null
  const zone = String(body?.zone || '').trim() || null
  const purpose = String(body?.purpose || '').trim() || null
  const status = String(body?.status || '').trim() || 'pending'
  const autoProvisionBridge = body?.autoProvisionBridge !== false
  const edgeRegion = String(body?.edgeRegion || '').trim() || 'northamerica-northeast1'

  if (!sourceKey || !name || !type) {
    return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
  }

  const store = await prisma.store.findUnique({
    where: { id: membership.storeId },
    select: { slug: true },
  })

  const source = await prisma.cameraSource.upsert({
    where: {
      storeId_sourceKey: {
        storeId: membership.storeId,
        sourceKey,
      },
    },
    update: {
      name,
      type,
      input,
      ingestUrl,
      playbackUrl,
      zone,
      purpose,
      status,
      capabilities: (body?.capabilities ?? null) as never,
    },
    create: {
      storeId: membership.storeId,
      sourceKey,
      name,
      type,
      input,
      ingestUrl,
      playbackUrl,
      zone,
      purpose,
      status,
      capabilities: (body?.capabilities ?? null) as never,
    },
  })

  await prisma.auditLog.create({
    data: {
      storeId: membership.storeId,
      userId: membership.userId,
      level: 'info',
      action: 'camera_source_upserted',
      entityType: 'camera_source',
      entityId: source.id,
      metadata: { sourceKey, name, type, input, status, zone, purpose },
    },
  })

  let bridge = null

  if (autoProvisionBridge && store?.slug) {
    const plan = buildBridgeProvisioning({
      storeSlug: store.slug,
      sourceKey,
      edgeRegion,
    })

    bridge = await prisma.bridgeProfile.upsert({
      where: {
        storeId_profileKey: {
          storeId: membership.storeId,
          profileKey: plan.profileKey,
        },
      },
      update: {
        name: plan.name,
        mode: plan.mode,
        rtspUrl: ingestUrl || plan.rtspUrl,
        webrtcUrl: playbackUrl?.startsWith('webrtc://') ? playbackUrl : plan.webrtcUrl,
        hlsUrl: playbackUrl?.endsWith('.m3u8') ? playbackUrl : plan.hlsUrl,
        edgeRegion: plan.edgeRegion,
        status: 'planned',
        metadata: {
          ...(plan.metadata as Record<string, unknown>),
          sourceName: name,
          sourceType: type,
        } as never,
        cameraSourceId: source.id,
      },
      create: {
        storeId: membership.storeId,
        profileKey: plan.profileKey,
        name: plan.name,
        mode: plan.mode,
        rtspUrl: ingestUrl || plan.rtspUrl,
        webrtcUrl: playbackUrl?.startsWith('webrtc://') ? playbackUrl : plan.webrtcUrl,
        hlsUrl: playbackUrl?.endsWith('.m3u8') ? playbackUrl : plan.hlsUrl,
        edgeRegion: plan.edgeRegion,
        status: 'planned',
        metadata: {
          ...(plan.metadata as Record<string, unknown>),
          sourceName: name,
          sourceType: type,
        } as never,
        cameraSourceId: source.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        storeId: membership.storeId,
        userId: membership.userId,
        level: 'info',
        action: 'bridge_profile_autoprovisioned',
        entityType: 'bridge_profile',
        entityId: bridge.id,
        metadata: {
          sourceKey,
          profileKey: plan.profileKey,
          edgeRegion: plan.edgeRegion,
        },
      },
    })
  }

  const runtime = await loadStoreRuntime(membership.storeId)

  return NextResponse.json({
    ok: true,
    source,
    bridge,
    sources: runtime?.sources || [],
  })
}
