'use client'

import { useEffect, useRef, useState } from 'react'

const GOLD = '#C9A227'

export default function MobileCameraPublisher() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    isIPhone: false,
    supportsMediaDevices: false,
    supportsWebRTC: false,
    lidarReady: false,
    appleIntelligenceReady: true,
  })

  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isIPhone = /iPhone/i.test(ua)
    const supportsMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
    const supportsWebRTC = typeof window !== 'undefined' && !!window.RTCPeerConnection

    setDeviceInfo({
      isIPhone,
      supportsMediaDevices,
      supportsWebRTC,
      lidarReady: isIPhone,
      appleIntelligenceReady: true,
    })

    return () => {
      stopCamera()
    }
  }, [])

  async function startCamera() {
    try {
      setError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported on this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        videoRef.current.playsInline = true

        try {
          await videoRef.current.play()
        } catch {
          setError('Flux camera obtenu, mais lecture video bloquee par Safari ou permissions.')
        }
      }

      setRunning(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start camera')
      setRunning(false)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setRunning(false)
  }

  async function registerSource(sourceId: string, mode: 'iphone-lidar' | 'parking-camera') {
    try {
      setError(null)

      const payload =
        mode === 'iphone-lidar'
          ? {
              id: sourceId,
              name: 'iPhone LiDAR Scanner',
              type: 'iphone-lidar',
              input: 'browser-camera',
              playback: 'webrtc',
              status: running ? 'live' : 'ready',
              zone: 'reserve',
              purpose: 'scan produit + reception + inventaire',
              edgeRegion: 'northamerica-northeast1',
              autoProvisionBridge: true,
              capabilities: {
                iphone: true,
                lidarReady: deviceInfo.lidarReady,
                appleIntelligenceReady: true,
                stockScanning: true,
              },
            }
          : {
              id: sourceId,
              name: 'Parking Logistics Camera',
              type: 'parking-camera',
              input: 'rtsp',
              playback: 'hls-or-webrtc',
              status: 'planned',
              zone: 'parking',
              purpose: 'occupation + livraison + quai + flotte',
              edgeRegion: 'northamerica-northeast1',
              autoProvisionBridge: true,
              capabilities: {
                parking: true,
              },
            }

      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.error || 'Unable to register source')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register source')
    }
  }

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #E8E6DE',
        borderRadius: 2,
        padding: '1.25rem',
      }}
    >
      <div style={{ fontSize: '0.6rem', letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 800, color: GOLD }}>
        iPhone · LiDAR · Mobile edge
      </div>
      <h3 style={{ margin: '0.55rem 0 0', fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
        Onboarding mobile pour scanner, compter et verifier les rayons
      </h3>
      <p style={{ margin: '0.8rem 0 1rem', fontSize: '0.72rem', color: '#666', lineHeight: 1.7 }}>
        Utilise l iPhone comme source de capture terrain pour le scan produit, la reception marchandise, le comptage reserve
        et la preparation d inventaire. La readiness LiDAR est exposee pour le pipeline Apple.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,280px) 1fr', gap: '1rem', alignItems: 'start' }}>
        <div>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: '100%',
              height: 420,
              objectFit: 'cover',
              background: '#0A0A0A',
              borderRadius: 2,
              display: 'block',
            }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <button
              type="button"
              onClick={startCamera}
              style={{
                background: '#0A0A0A',
                color: GOLD,
                border: 'none',
                borderRadius: 2,
                padding: '0.75rem 0.9rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Start mobile camera
            </button>
            <button
              type="button"
              onClick={stopCamera}
              style={{
                background: '#fff',
                color: '#111',
                border: '1px solid #D7D1C6',
                borderRadius: 2,
                padding: '0.75rem 0.9rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Stop
            </button>
          </div>

          <div style={{ marginTop: '0.55rem', fontSize: '0.66rem', color: '#7E786F' }}>
            {running ? 'Camera active' : 'Camera inactive'}
          </div>
        </div>

        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
            {[
              ['📱 iPhone', deviceInfo.isIPhone ? 'Detected' : 'Not detected'],
              ['📷 MediaDevices', deviceInfo.supportsMediaDevices ? 'Supported' : 'Missing'],
              ['📡 WebRTC', deviceInfo.supportsWebRTC ? 'Supported' : 'Missing'],
              ['🧭 LiDAR readiness', deviceInfo.lidarReady ? 'Ready' : 'Pending'],
              ['🧠 Apple intelligence', deviceInfo.appleIntelligenceReady ? 'Planned' : 'Pending'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: '#F9F8F4', border: '1px solid #E8E6DE', borderRadius: 2, padding: '0.85rem' }}>
                <div style={{ color: '#7E786F', fontSize: 11, marginBottom: 6 }}>{label}</div>
                <div style={{ fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem', display: 'grid', gap: 10 }}>
            {[
              {
                emoji: '📦',
                title: 'Register iPhone LiDAR scanner',
                subtitle: 'Declare the mobile intake source for stock, reception and shelf validation.',
                onClick: () => registerSource('mobile-lidar-01', 'iphone-lidar'),
              },
              {
                emoji: '🅿️',
                title: 'Register parking logistics camera',
                subtitle: 'Track deliveries, bay occupancy and vehicle turnover outside the store.',
                onClick: () => registerSource('parking-01', 'parking-camera'),
              },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.onClick}
                style={{
                  background: '#fff',
                  border: '1px solid #E8E6DE',
                  borderLeft: `3px solid ${GOLD}`,
                  borderRadius: 2,
                  padding: '0.9rem 1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{item.emoji} {item.title}</div>
                <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#666', lineHeight: 1.6 }}>{item.subtitle}</div>
              </button>
            ))}
          </div>

          {error ? (
            <div style={{ marginTop: '0.9rem', background: '#FFF4F4', color: '#9F2D2D', border: '1px solid #F1C4C4', borderRadius: 2, padding: '0.8rem' }}>
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
