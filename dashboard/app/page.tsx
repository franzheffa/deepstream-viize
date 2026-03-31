'use client'
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const GOLD  = '#C9A227'
const BLACK = '#0A0A0A'
const GRAY  = '#F5F5F5'

interface Event {
  entry?: number
  exit?: number
  occupancy?: number
  ts: string
}

export default function Dashboard() {
  const [events, setEvents]   = useState<Event[]>([])
  const [latest, setLatest]   = useState({ entry: 0, exit: 0, occupancy: 0 })
  const [online, setOnline]   = useState(false)

  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch('/api/events')
        const data = await res.json()
        if (data.events?.length) {
          setEvents(data.events.slice(0, 20).reverse())
          const l = data.events[0]
          setLatest({ entry: l.entry ?? 0, exit: l.exit ?? 0, occupancy: l.occupancy ?? 0 })
          setOnline(true)
        }
      } catch { setOnline(false) }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <main style={{ minHeight: '100vh', background: '#fff', color: BLACK }}>
      {/* Header */}
      <div style={{
        borderBottom: `2px solid ${BLACK}`,
        padding: '1.5rem 2.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD }} />
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
              Buttertech · Viize
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            People Analytics
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: online ? GOLD : '#ccc' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: online ? GOLD : '#999' }}>
            {online ? 'LIVE' : 'NO SIGNAL'}
          </span>
        </div>
      </div>

      <div style={{ padding: '2.5rem', maxWidth: 1100, margin: '0 auto' }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {[
            { label: 'Total Entry',        value: latest.entry,     border: GOLD  },
            { label: 'Total Exit',         value: latest.exit,      border: BLACK },
            { label: 'Current Occupancy',  value: latest.occupancy, border: GOLD  },
          ].map(({ label, value, border }) => (
            <div key={label} style={{
              background: GRAY,
              borderRadius: 8,
              padding: '1.75rem 1.5rem',
              borderTop: `3px solid ${border}`,
            }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#777', marginBottom: '0.5rem' }}>
                {label}
              </div>
              <div style={{ fontSize: '2.75rem', fontWeight: 800, color: BLACK, lineHeight: 1 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: GRAY, borderRadius: 8, padding: '1.75rem', border: `1.5px solid #E5E5E5` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 4, height: 18, background: GOLD, borderRadius: 2 }} />
            <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: BLACK }}>
              Entry / Exit · Live Feed
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={events} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="ts" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={v => v.slice(11, 19)} />
              <YAxis tick={{ fill: '#999', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: `1px solid ${BLACK}`, borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: BLACK, fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="entry"     stroke={GOLD}  dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="exit"      stroke={BLACK} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="occupancy" stroke="#999"  dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#bbb', letterSpacing: '0.05em' }}>
            DeepStream 9.0 · NVIDIA H200 NVLink · Nebius
          </span>
          <span style={{ fontSize: '0.7rem', color: '#bbb' }}>
            GCP Marketplace · NVIDIA AI Enterprise
          </span>
        </div>
      </div>
    </main>
  )
}
