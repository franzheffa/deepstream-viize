import { NextRequest, NextResponse } from "next/server";
const SECRET = process.env.DEEPSTREAM_WEBHOOK_SECRET ?? "";
const THRESHOLDS: Record<string,number> = {
  bouteille_eau_500ml: 8,
  pain_baguette: 5,
  yaourt_nature: 10,
};
export async function POST(req: NextRequest) {
  const sig = req.headers.get("x-webhook-secret") ?? "";
  if (SECRET && sig !== SECRET)
    return NextResponse.json({ ok:false, error:"Unauthorized" }, { status:401 });
  try {
    const body = await req.json();
    const dets = body?.payload?.detections ?? [];
    const alerts = dets
      .filter((d:any) => THRESHOLDS[d.label] && (d.count??0) < THRESHOLDS[d.label])
      .map((d:any) => ({
        skuCode: d.label, zone: d.zone ?? body.streamId,
        currentCount: d.count ?? 0, threshold: THRESHOLDS[d.label],
        confidence: d.confidence,
        alertType: (d.count??0) === 0 ? "RUPTURE" : "STOCK_BAS",
      }));
    console.log(JSON.stringify({ ts: body.timestamp, streamId: body.streamId, dets: dets.length, alerts: alerts.length }));
    return NextResponse.json({ ok:true, received:dets.length, alerts:alerts.length, alertList:alerts,
      storeId: process.env.NEXT_PUBLIC_STORE_ID ?? "epicerie-saint-denis-mtl" });
  } catch(e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status:400 });
  }
}
export async function GET() {
  return NextResponse.json({ ok:true, service:"VIIZE DeepStream Webhook", version:"1.0.0",
    store: process.env.NEXT_PUBLIC_STORE_ID ?? "epicerie-saint-denis-mtl", uptime: process.uptime() });
}
