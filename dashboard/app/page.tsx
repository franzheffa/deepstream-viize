'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Event {
  entry?: number
  exit?: number
  occupancy?: number
  ts: string
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [latest, setLatest] = useState({ entry: 0, exit: 0, occupancy: 0 })

  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/events')
      const data = await res.json()
      if (data.events?.length) {
        setEvents(data.events.slice(0, 20).reverse())
        const l = data.events[0]
        setLatest({
          entry: l.entry ?? 0,
          exit: l.exit ?? 0,
          occupancy: l.occupancy ?? 0,
        })
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <main style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>
        🏢 Viize — People Analytics
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Live · DeepStream + PeopleNet</p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Entry', value: latest.entry, color: '#22c55e' },
          { label: 'Total Exit', value: latest.exit, color: '#ef4444' },
          { label: 'Current Occupancy', value: latest.occupancy, color: '#3b82f6' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#18181b', borderRadius: 12, padding: '1.5rem', borderLeft: `4px solid ${color}` }}>
            <div style={{ color: '#888', fontSize: '0.85rem' }}>{label}</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#18181b', borderRadius: 12, padding: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem', color: '#aaa' }}>Entry / Exit over time</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={events}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="ts" tick={{ fontSize: 10, fill: '#666' }} tickFormatter={v => v.slice(11, 19)} />
            <YAxis tick={{ fill: '#666' }} />
            <Tooltip contentStyle={{ background: '#27272a', border: 'none' }} />
            <Legend />
            <Line type="monotone" dataKey="entry" stroke="#22c55e" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="exit" stroke="#ef4444" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="occupancy" stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  )
}
