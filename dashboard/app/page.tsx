'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const GOLD  = '#C9A227'
const BLACK = '#0A0A0A'

// ── Caméras déclarées (sync avec pipeline_rtsp.py) ───────────────────────────
const CAMERA_DEFS = [
  { id: 'cam-01',    name: 'Entrée principale', location: 'Entrée'  },
  { id: 'cam-02',    name: 'Zone parking',      location: 'Parking' },
  { id: 'iphone-01', name: 'iPhone Live',       location: 'Mobile'  },
]

interface Event {
  entry?: number
  exit?: number
  occupancy?: number
  ts: string
  streamId?: string
  detections?: number
}

interface CamState {
  id: string
  name: string
  location: string
  online: boolean
  persons: number
  detections: number
  lastTs: string | null
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [kpi, setKpi]       = useState({ entry: 0, exit: 0, occupancy: 0 })
  const [cams, setCams]     = useState<CamState[]>(
    CAMERA_DEFS.map(c => ({ ...c, online: false, persons: 0, detections: 0, lastTs: null }))
  )
  const [tick, setTick]     = useState(0)

  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch('/api/events')
        const data = await res.json()
        const evts: Event[] = data.events ?? []
        if (evts.length > 0) {
          setEvents(evts.slice(0, 30).reverse())
          const l = evts[0]
          setKpi({ entry: l.entry ?? 0, exit: l.exit ?? 0, occupancy: l.occupancy ?? 0 })
          setCams(prev =>
            prev.map(cam => {
              const hit = evts.find(e => e.streamId === cam.id)
              return hit
                ? { ...cam, online: true, persons: hit.occupancy ?? 0, detections: hit.detections ?? 0, lastTs: hit.ts }
                : cam
            })
          )
        }
        setTick(t => t + 1)
      } catch { /* network */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  const totalOnline = cams.filter(c => c.online).length

  return (
    <main style={{ minHeight: '100vh', background: '#fff', color: BLACK, fontFamily: 'system-ui, sans-serif' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{
        background: BLACK,
        borderBottom: `3px solid ${GOLD}`,
        padding: '0.9rem 2.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div style={{ width: 3, height: 34, background: GOLD, borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: '0.58rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
              Buttertech · Viize
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              People Analytics
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: totalOnline > 0 ? GOLD : '#333',
              boxShadow: totalOnline > 0 ? `0 0 10px ${GOLD}88` : 'none',
            }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: totalOnline > 0 ? GOLD : '#444' }}>
              {totalOnline > 0 ? `${totalOnline}/${cams.length} LIVE` : 'AWAITING SIGNAL'}
            </span>
          </div>
        </div>
      </header>

      <div style={{ padding: '1.75rem 2.5rem', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── CAMERA GRID ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionTitle>Camera Feeds — DeepStream 9.0 · PeopleNet</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            {cams.map(cam => <CameraCard key={cam.id} cam={cam} tick={tick} />)}
          </div>
        </section>

        {/* ── KPI ROW ─────────────────────────────────────────────────────── */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Entry',    value: kpi.entry,     symbol: '↑' },
            { label: 'Total Exit',     value: kpi.exit,      symbol: '↓' },
            { label: 'Live Occupancy', value: kpi.occupancy, symbol: '◉' },
          ].map(({ label, value, symbol }) => (
            <div key={label} style={{
              border: `1.5px solid ${BLACK}`,
              borderTop: `3px solid ${GOLD}`,
              borderRadius: 6,
              padding: '1.25rem 1.5rem',
              background: '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: '0.5rem' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '2.8rem', fontWeight: 900, color: BLACK, lineHeight: 1 }}>
                    {value}
                  </div>
                </div>
                <span style={{ fontSize: '1.4rem', color: GOLD }}>{symbol}</span>
              </div>
            </div>
          ))}
        </section>

        {/* ── CHART ───────────────────────────────────────────────────────── */}
        <section style={{
          border: `1.5px solid ${BLACK}`,
          borderTop: `3px solid ${GOLD}`,
          borderRadius: 6,
          padding: '1.5rem',
          marginBottom: '1.5rem',
          background: '#fff',
        }}>
          <SectionTitle>Detection Timeline</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={events} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#aaa' }} tickFormatter={v => v.slice(11, 19)} />
              <YAxis tick={{ fill: '#aaa', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: BLACK, border: `1px solid ${GOLD}`, borderRadius: 4, fontSize: 11, color: '#fff' }}
                labelStyle={{ color: GOLD, fontWeight: 600, fontSize: 10 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="entry"     name="Entry"     stroke={GOLD}  dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="exit"      name="Exit"      stroke={BLACK} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="occupancy" name="Occupancy" stroke="#bbb"  dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* ── SYSTEM BAR ──────────────────────────────────────────────────── */}
        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            {[
              ['GPU',      'NVIDIA H200 NVLink · 141GB'],
              ['ENGINE',   'DeepStream 9.0 · Nebius'],
              ['MODEL',    'PeopleNet · YOLO'],
              ['REGION',   'GCP iad1'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.58rem', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>{label}</span>
                <span style={{ fontSize: '0.58rem', color: '#aaa' }}>{value}</span>
              </div>
            ))}
          </div>

        </footer>

      </div>
    </main>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
      <div style={{ width: 3, height: 14, background: GOLD, borderRadius: 1 }} />
      <span style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: BLACK }}>
        {children}
      </span>
    </div>
  )
}

function CameraCard({ cam, tick }: { cam: CamState; tick: number }) {
  const active = cam.online

  return (
    <div style={{
      background: BLACK,
      borderRadius: 6,
      overflow: 'hidden',
      border: `1.5px solid ${active ? GOLD : '#1c1c1c'}`,
      boxShadow: active ? `0 0 16px rgba(201,162,39,0.12)` : 'none',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>

      {/* ── Viewfinder ── */}
      <div style={{
        position: 'relative',
        height: 168,
        background: '#060606',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* CRT scan lines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, transparent 1px, transparent 4px)',
        }} />

        {/* Corner viewfinder brackets */}
        {(['tl','tr','bl','br'] as const).map(pos => (
          <ViewfinderCorner key={pos} pos={pos} active={active} />
        ))}

        {active ? (
          <>
            {/* Person count */}
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {cam.persons}
              </div>
              <div style={{ fontSize: '0.58rem', color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.3rem' }}>
                persons detected
              </div>
            </div>

            {/* REC dot */}
            <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: '#ef4444',
                opacity: tick % 2 === 0 ? 1 : 0.25,
                transition: 'opacity 0.8s',
              }} />
              <span style={{ fontSize: '0.52rem', color: '#ef4444', fontWeight: 800, letterSpacing: '0.12em' }}>REC</span>
            </div>

            {/* Detection count top-left */}
            <div style={{ position: 'absolute', top: 10, left: 12, fontSize: '0.52rem', color: '#555', fontFamily: 'monospace' }}>
              {cam.detections} obj
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontSize: '0.6rem', color: '#2a2a2a', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 600 }}>
              No Signal
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, justifyContent: 'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#1a1a1a' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Camera info bar ── */}
      <div style={{
        padding: '0.7rem 1rem',
        borderTop: `1px solid #141414`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e5e5e5' }}>{cam.name}</div>
          <div style={{ fontSize: '0.58rem', color: '#444', marginTop: 2, letterSpacing: '0.04em' }}>
            {cam.id} · {cam.location}
          </div>
          {cam.lastTs && (
            <div style={{ fontSize: '0.52rem', color: '#333', marginTop: 2, fontFamily: 'monospace' }}>
              {cam.lastTs.slice(11, 19)} UTC
            </div>
          )}
        </div>
        <div style={{
          background: active ? 'rgba(201,162,39,0.12)' : '#0e0e0e',
          border: `1px solid ${active ? GOLD : '#1c1c1c'}`,
          borderRadius: 20,
          padding: '0.2rem 0.65rem',
          fontSize: '0.52rem',
          color: active ? GOLD : '#2a2a2a',
          fontWeight: 800,
          letterSpacing: '0.12em',
          transition: 'all 0.3s',
        }}>
          {active ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </div>
  )
}

function ViewfinderCorner({ pos, active }: { pos: 'tl'|'tr'|'bl'|'br'; active: boolean }) {
  const color = active ? GOLD : '#1e1e1e'
  const size = 12
  const inset = 8
  const style: React.CSSProperties = {
    position: 'absolute',
    width: size, height: size,
    borderTop:    (pos === 'tl' || pos === 'tr') ? `1.5px solid ${color}` : 'none',
    borderBottom: (pos === 'bl' || pos === 'br') ? `1.5px solid ${color}` : 'none',
    borderLeft:   (pos === 'tl' || pos === 'bl') ? `1.5px solid ${color}` : 'none',
    borderRight:  (pos === 'tr' || pos === 'br') ? `1.5px solid ${color}` : 'none',
    top:    (pos === 'tl' || pos === 'tr') ? inset : undefined,
    bottom: (pos === 'bl' || pos === 'br') ? inset : undefined,
    left:   (pos === 'tl' || pos === 'bl') ? inset : undefined,
    right:  (pos === 'tr' || pos === 'br') ? inset : undefined,
    transition: 'border-color 0.3s',
  }
  return <div style={style} />
}
