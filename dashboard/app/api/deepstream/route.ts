import { NextRequest, NextResponse } from "next/server";

const SECRET = process.env.DEEPSTREAM_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("x-webhook-secret") ?? "";
  if (SECRET && sig !== SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { source, streamId, payload, timestamp } = body;
    const detections = payload?.detections ?? [];

    // ── Stock alerts ──────────────────────────────────────────────────────────
    const alerts = [];
    const THRESHOLDS: Record<string,number> = {
      "bouteille_eau_500ml": 8,
      "pain_baguette": 5,
      "yaourt_nature": 10,
    };
    for (const det of detections) {
      const thresh = THRESHOLDS[det.label] ?? 0;
      if (thresh > 0 && (det.count ?? 0) < thresh) {
        alerts.push({
          skuCode: det.label,
          zone: det.zone ?? streamId,
          currentCount: det.count ?? 0,
          threshold: thresh,
          confidence: det.confidence,
          alertType: (det.count ?? 0) === 0 ? "RUPTURE" : "STOCK_BAS",
        });
      }
    }

    console.log(JSON.stringify({
      ts: timestamp ?? new Date().toISOString(),
      streamId,
      source,
      detections: detections.length,
      alerts: alerts.length,
    }));

    return NextResponse.json({
      ok: true,
      received: detections.length,
      alerts: alerts.length,
      alertList: alerts,
      storeId: process.env.NEXT_PUBLIC_STORE_ID ?? "epicerie-saint-denis-mtl",
    });
  } catch (err: any) {
    console.error("[webhook] parse error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "VIIZE DeepStream Webhook",
    version: "1.0.0",
    store: process.env.NEXT_PUBLIC_STORE_ID ?? "epicerie-saint-denis-mtl",
    uptime: process.uptime(),
  });
}
