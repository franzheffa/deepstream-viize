"""
Agent Smith-Heffa — DeepStream 9.0 RTSP Pipeline
Nebius H200 NVLink → webhook Vercel /api/deepstream
Sources: caméras IP RTSP plug-and-play, iPhone, scanner
Couleurs: Blanc · Noir · Or Pharaon
"""

import os
import json
import time
import platform
import threading
import urllib.request
from datetime import datetime, timezone

import gi
gi.require_version("Gst", "1.0")
from gi.repository import Gst, GLib

# ── Configuration ────────────────────────────────────────────────────────────
VERCEL_URL      = os.environ.get("VERCEL_WEBHOOK_URL",
                  "https://agent-smith-heffa-coding-buttertech-team.vercel.app/api/deepstream")
WEBHOOK_SECRET  = os.environ.get("DEEPSTREAM_WEBHOOK_SECRET", "ds-secret-change-me-in-prod")
CONFIDENCE_MIN  = float(os.environ.get("CONFIDENCE_MIN", "0.4"))
WEBHOOK_INTERVAL = int(os.environ.get("WEBHOOK_INTERVAL_SEC", "5"))

# Caméras RTSP plug-and-play — ajouter vos URIs ici
CAMERAS = [
    {
        "id": "cam-01",
        "name": "Entrée principale",
        "uri": os.environ.get("RTSP_CAM_01", ""),
        "location": "Entrée",
    },
    {
        "id": "cam-02",
        "name": "Zone parking",
        "uri": os.environ.get("RTSP_CAM_02", ""),
        "location": "Parking",
    },
    {
        "id": "iphone-01",
        "name": "iPhone live",
        "uri": os.environ.get("RTSP_IPHONE", ""),
        "location": "Mobile",
    },
]

# Filtre: seulement les caméras avec URI configurée
ACTIVE = [c for c in CAMERAS if c["uri"].strip()]

# Mode test si aucune caméra configurée
TEST_URI = "file://" + os.path.abspath(
    os.environ.get(
        "TEST_VIDEO",
        "/opt/nvidia/deepstream/deepstream/samples/streams/sample_720p.mp4"
    )
)
USE_TEST = len(ACTIVE) == 0

# ── État global ──────────────────────────────────────────────────────────────
detections_buffer: list = []
last_send = 0.0
lock = threading.Lock()

# ── Webhook ──────────────────────────────────────────────────────────────────
def send_webhook(camera: dict, detections: list) -> None:
    payload = {
        "source": "iphone" if "iphone" in camera["id"] else "rtsp_camera",
        "pipeline": "object_detection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "streamId": camera["id"],
        "camera": {
            "id": camera["id"],
            "name": camera["name"],
            "uri": camera["uri"],
            "location": camera.get("location", ""),
            "isLive": True,
        },
        "payload": {
            "detections": detections[:50],
            "metadata": {
                "gpu": "H200-NVLink-141GB",
                "deepstream": "9.0",
                "host": platform.node(),
            },
        },
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        VERCEL_URL, data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Secret": WEBHOOK_SECRET,
            "X-Stream-Id": camera["id"],
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            print(f"[webhook] {camera['id']} → {resp.status} | ok={result.get('ok')}")
    except Exception as exc:
        print(f"[webhook] ERREUR {camera['id']}: {exc}")

# ── Probe metadata ────────────────────────────────────────────────────────────
def probe_callback(pad, info, camera):
    global last_send, detections_buffer
    try:
        import pyds
    except ImportError:
        return Gst.PadProbeReturn.OK

    buf = info.get_buffer()
    if not buf:
        return Gst.PadProbeReturn.OK

    batch = pyds.gst_buffer_get_nvds_batch_meta(hash(buf))
    if not batch:
        return Gst.PadProbeReturn.OK

    frame_dets = []
    for frame in pyds.NvDsFrameMetaList.cast(batch.frame_meta_list):
        if not frame:
            break
        for obj in pyds.NvDsObjectMetaList.cast(frame.obj_meta_list):
            if not obj:
                break
            conf = obj.confidence
            if conf < CONFIDENCE_MIN:
                continue
            r = obj.rect_params
            frame_dets.append({
                "classId": int(obj.class_id),
                "label": str(obj.obj_label),
                "confidence": round(float(conf), 3),
                "bbox": {
                    "x": round(float(r.left), 1),
                    "y": round(float(r.top), 1),
                    "w": round(float(r.width), 1),
                    "h": round(float(r.height), 1),
                },
                "trackId": int(obj.object_id) if obj.object_id else None,
            })

    if frame_dets:
        with lock:
            detections_buffer.extend(frame_dets)

    now = time.time()
    if now - last_send >= WEBHOOK_INTERVAL and detections_buffer:
        with lock:
            to_send = detections_buffer.copy()
            detections_buffer.clear()
        last_send = now
        threading.Thread(
            target=send_webhook, args=(camera, to_send), daemon=True
        ).start()

    return Gst.PadProbeReturn.OK

# ── Pipeline ──────────────────────────────────────────────────────────────────
def build_pipeline(cameras: list) -> Gst.Pipeline:
    Gst.init(None)
    pipeline = Gst.Pipeline.new("smith-heffa-rtsp")

    mux = Gst.ElementFactory.make("nvstreammux", "mux")
    mux.set_property("batch-size", max(1, len(cameras)))
    mux.set_property("width", 1280)
    mux.set_property("height", 720)
    mux.set_property("batched-push-timeout", 4000000)
    if any(c.get("isLive", True) for c in cameras):
        mux.set_property("live-source", 1)
    pipeline.add(mux)

    for idx, cam in enumerate(cameras):
        src = Gst.ElementFactory.make("nvurisrcbin", f"src-{idx}")
        src.set_property("uri", cam["uri"])
        src.set_property("gpu-id", 0)
        pipeline.add(src)

        def on_pad_added(element, pad, mux=mux):
            sink = mux.get_request_pad("sink_%u")
            if sink and not sink.is_linked():
                pad.link(sink)

        src.connect("pad-added", on_pad_added)

    pgie = Gst.ElementFactory.make("nvinfer", "pgie")
    pgie.set_property(
        "config-file-path",
        os.environ.get(
            "NVINFER_CONFIG",
            "/opt/nvidia/deepstream/deepstream/samples/configs/deepstream-app/config_infer_primary.txt"
        )
    )
    pgie.set_property("gpu-id", 0)
    pipeline.add(pgie)

    nvvidconv = Gst.ElementFactory.make("nvvideoconvert", "conv")
    pipeline.add(nvvidconv)

    nvosd = Gst.ElementFactory.make("nvosdbin", "osd")
    pipeline.add(nvosd)

    sink = Gst.ElementFactory.make("fakesink", "sink")
    sink.set_property("sync", 0)
    pipeline.add(sink)

    mux.link(pgie)
    pgie.link(nvvidconv)
    nvvidconv.link(nvosd)
    nvosd.link(sink)

    osd_pad = nvosd.get_static_pad("sink")
    if osd_pad and cameras:
        osd_pad.add_probe(Gst.PadProbeType.BUFFER, probe_callback, cameras[0])

    return pipeline

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    cameras = ACTIVE if not USE_TEST else [
        {"id": "test", "name": "Fichier test", "uri": TEST_URI, "location": "local", "isLive": False}
    ]

    print("=" * 60)
    print("  Agent Smith-Heffa — DeepStream 9.0 RTSP Bridge")
    print("  Blanc · Noir · Or Pharaon · NVIDIA H200 NVLink")
    print("=" * 60)
    print(f"  Sources actives : {len(cameras)}")
    for c in cameras:
        print(f"  · {c['id']:15} {c['name']:20} {c['uri']}")
    print(f"  Webhook → {VERCEL_URL}")
    print(f"  Intervalle : {WEBHOOK_INTERVAL}s | Confiance min : {CONFIDENCE_MIN}")
    print("=" * 60)

    pipeline = build_pipeline(cameras)
    loop = GLib.MainLoop()

    bus = pipeline.get_bus()
    bus.add_signal_watch()

    def on_message(bus, msg):
        if msg.type == Gst.MessageType.EOS:
            print("[pipeline] EOS")
            loop.quit()
        elif msg.type == Gst.MessageType.ERROR:
            err, dbg = msg.parse_error()
            print(f"[pipeline] ERREUR: {err.message}")
            loop.quit()

    bus.connect("message", on_message)
    pipeline.set_state(Gst.State.PLAYING)
    print("[pipeline] En cours — Ctrl+C pour arrêter")

    try:
        loop.run()
    except KeyboardInterrupt:
        print("\n[pipeline] Arrêt")
    finally:
        pipeline.set_state(Gst.State.NULL)
        print("[pipeline] Arrêté proprement")

if __name__ == "__main__":
    main()
