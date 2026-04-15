'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EnterpriseFooter from '../components/EnterpriseFooter'
import MobileCameraPublisher from '../components/MobileCameraPublisher'

const GOLD = '#C9A227'
const BLACK = '#0A0A0A'
const PANEL = '#F9F8F4'
const BORDER = '#E8E6DE'

type TabKey = 'overview' | 'cameras' | 'stock' | 'operations' | 'gemini' | 'reports'

type EventRecord = {
  entry?: number
  exit?: number
  occupancy?: number
  ts: string
  streamId?: string
  detections?: number
}

type SourceRecord = {
  id: string
  name: string
  type: string
  input: string
  playback: string | null
  status: string
  zone?: string
  purpose?: string
  capabilities?: {
    iphone?: boolean
    lidarReady?: boolean
    appleIntelligenceReady?: boolean
    stockScanning?: boolean
    parking?: boolean
  }
}

type GeminiMessage = {
  role: 'user' | 'ai'
  text: string
  ts: string
}

type HealthRecord = {
  ok: boolean
  status: string
  store: string
  posture: string
  sourceCount: number
  persistence: string
  privacy: string
}

const REPLIES: Record<string, string> = {
  report:
    'Rapport retail mondial: frequentation soutenue, deux ruptures a traiter, parking fluide et reserve stable. Priorite: eau, pain et facing promotionnel sur le rayon boisson.',
  stock:
    'Stocks: eau 500 ml critique, pain baguette bas, yaourt sous seuil, produits frais stables. Je recommande reappro reserve, scan iPhone LiDAR des palettes et verification camera du facing.',
  parking:
    'Parking et logistique: occupation client 62%, une baie livraison libre, file reception stable. Je peux preparer le flux quai -> reserve -> rayon pour la prochaine livraison.',
  cameras:
    'Cameras: entree, rayons, caisse et parking peuvent couvrir surveillance, comptage, rupture rayon, heatmap et files d attente. Les flux web doivent rester HLS ou WebRTC, jamais RTSP direct en navigateur.',
  marketing:
    'Marketing temps reel: trafic fort 11h-13h, promo jus et snacking a pousser en tete de rayon, message vocal doux a diffuser sur les heures creuses et upsell sur les produits complementaires.',
  lidar:
    'iPhone LiDAR: utile pour scanner reception, volumes, cartons, inventaire reserve et verification mise en rayon. Il complete la vision fixe magasin avec un intake mobile terrain.',
  default:
    'Je consolide les flux DeepStream, les stocks et les signaux magasin. Demande-moi un rapport, une action stock, une lecture parking ou un plan marketing.',
}

const STOCK_ROWS = [
  { emoji: '💧', sku: 'Eau 500ml', zone: 'B3', count: 3, threshold: 8, status: 'CRITIQUE', confidence: 94 },
  { emoji: '🥖', sku: 'Pain baguette', zone: 'A2', count: 2, threshold: 5, status: 'BAS', confidence: 89 },
  { emoji: '🥛', sku: 'Yaourt nature', zone: 'C1', count: 4, threshold: 10, status: 'BAS', confidence: 91 },
  { emoji: '🍊', sku: 'Jus orange 1L', zone: 'D2', count: 12, threshold: 6, status: 'OK', confidence: 96 },
  { emoji: '🥔', sku: 'Chips nature', zone: 'E1', count: 18, threshold: 5, status: 'OK', confidence: 92 },
  { emoji: '🥛', sku: 'Lait entier 1L', zone: 'B1', count: 9, threshold: 8, status: 'OK', confidence: 97 },
]

const PARKING_ROWS = [
  { emoji: '🚚', label: 'Baie livraison A', value: 'Libre dans 12 min', tone: '#1D6A45' },
  { emoji: '🚗', label: 'Occupation parking client', value: '62%', tone: GOLD },
  { emoji: '🛒', label: 'Retours chariots', value: '8 a redistribuer', tone: '#8B6000' },
  { emoji: '📦', label: 'Reserve vers rayon', value: '2 missions ouvertes', tone: '#C0392B' },
]

const MARKETING_ROWS = [
  { emoji: '📣', title: 'Message audio', text: 'Promouvoir la zone snacking entre 16h et 18h avec message vocal doux et contexte meteo.' },
  { emoji: '🧃', title: 'Cross-sell', text: 'Associer jus orange, viennoiserie et yaourt aux zones de trafic eleve.' },
  { emoji: '🔥', title: 'Hot zones', text: 'Le rayon boisson et la caisse restent les meilleurs points de conversion aujourd hui.' },
]

const HEATMAP = [4, 7, 11, 15, 21, 26, 23, 29, 34, 30, 24, 19, 24, 31, 37, 33, 27, 21, 17, 12, 8, 6, 4, 3]

function askReply(question: string) {
  const value = question.toLowerCase()
  if (value.includes('rapport') || value.includes('summary')) return REPLIES.report
  if (value.includes('stock') || value.includes('rupture')) return REPLIES.stock
  if (value.includes('parking') || value.includes('logistique')) return REPLIES.parking
  if (value.includes('camera') || value.includes('surveillance')) return REPLIES.cameras
  if (value.includes('marketing') || value.includes('promo')) return REPLIES.marketing
  if (value.includes('lidar') || value.includes('iphone')) return REPLIES.lidar
  return REPLIES.default
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1rem' }}>
      <div style={{ width: 3, height: 14, background: GOLD, borderRadius: 1 }} />
      <span style={{ fontSize: '0.6rem', letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 800, color: BLACK }}>
        {children}
      </span>
    </div>
  )
}

function InfoTile({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderTop: `3px solid ${color}`, borderRadius: 2, padding: '1rem 1.1rem' }}>
      <div style={{ fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color: BLACK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.62rem', color: '#A3A3A3', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function statusColor(status: string) {
  if (status === 'CRITIQUE') return '#C0392B'
  if (status === 'BAS' || status === 'planned') return '#8B6000'
  if (status === 'live' || status === 'ready' || status === 'OK') return '#1D6A45'
  return '#7E786F'
}

export default function DashboardPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [events, setEvents] = useState<EventRecord[]>([])
  const [sources, setSources] = useState<SourceRecord[]>([])
  const [health, setHealth] = useState<HealthRecord | null>(null)
  const [kpi, setKpi] = useState({ entry: 0, exit: 0, occupancy: 14 })
  const [tick, setTick] = useState(0)
  const [messages, setMessages] = useState<GeminiMessage[]>([
    {
      role: 'ai',
      text: 'Bonjour. VIIZE est pret pour le pilotage complet du magasin: surveillance, stock, parking, marketing et scan mobile iPhone LiDAR.',
      ts: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const [eventsRes, sourcesRes, healthRes] = await Promise.all([
          fetch('/api/events', { cache: 'no-store' }),
          fetch('/api/sources', { cache: 'no-store' }),
          fetch('/api/health', { cache: 'no-store' }),
        ])

        const eventsData = await eventsRes.json()
        const sourceData = await sourcesRes.json()
        const healthData = await healthRes.json()

        const nextEvents: EventRecord[] = Array.isArray(eventsData.events) ? eventsData.events.slice(0, 32).reverse() : []
        setEvents(nextEvents)
        setSources(Array.isArray(sourceData.sources) ? sourceData.sources : [])
        setHealth(healthData)

        if (nextEvents.length > 0) {
          const latest = nextEvents[nextEvents.length - 1]
          setKpi({
            entry: latest.entry ?? 0,
            exit: latest.exit ?? 0,
            occupancy: latest.occupancy ?? 14,
          })
        }

        setTick((value) => value + 1)
      } catch {
        setTick((value) => value + 1)
      }
    }

    poll()
    const id = setInterval(poll, 2500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingAi])

  const criticalCount = STOCK_ROWS.filter((item) => item.status === 'CRITIQUE').length
  const lowCount = STOCK_ROWS.filter((item) => item.status === 'BAS').length
  const liveSources = useMemo(() => sources.filter((source) => ['live', 'ready'].includes(source.status)).length, [sources])

  function sendAi(question: string) {
    const value = question.trim()
    if (!value) return

    setMessages((current) => [...current, { role: 'user', text: value, ts: new Date().toISOString() }])
    setLoadingAi(true)
    setInput('')

    window.setTimeout(() => {
      setMessages((current) => [...current, { role: 'ai', text: askReply(value), ts: new Date().toISOString() }])
      setLoadingAi(false)
    }, 850)
  }

  const navItems: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Vue d ensemble' },
    { key: 'cameras', label: 'Cameras live' },
    { key: 'stock', label: 'Stocks' },
    { key: 'operations', label: 'Operations' },
    { key: 'gemini', label: 'Gemini IA' },
    { key: 'reports', label: 'Rapports' },
  ]

  return (
    <main style={{ minHeight: '100vh', background: '#fff', color: BLACK, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: BLACK, borderBottom: `3px solid ${GOLD}`, padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div style={{ width: 3, height: 36, background: GOLD, borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: '0.56rem', letterSpacing: '.25em', textTransform: 'uppercase', color: GOLD, fontWeight: 800 }}>
              Buttertech · DeepStream · VIIZE
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
              Enterprise supermarket intelligence platform
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '.05em' }}>
            {health?.store || 'Saint-Denis flagship'} · Montreal
          </span>
          <span style={{ fontSize: '0.6rem', color: '#666' }}>
            {health?.privacy || 'camera analytics + regional controls'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: liveSources > 0 ? '#4CAF50' : GOLD }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.1em', color: liveSources > 0 ? '#4CAF50' : GOLD }}>
              {liveSources > 0 ? `${liveSources}/${Math.max(sources.length, 1)} READY` : 'AWAITING SIGNAL'}
            </span>
          </div>
        </div>
      </header>

      <nav style={{ background: PANEL, borderBottom: `1px solid ${BORDER}`, display: 'flex', padding: '0 2rem', overflowX: 'auto' }}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === item.key ? GOLD : 'transparent'}`,
              padding: '0.78rem 1rem',
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: tab === item.key ? BLACK : '#888',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: '1.5rem 2rem 2rem', maxWidth: 1460, margin: '0 auto' }}>
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <InfoTile label="Personnes en magasin" value={kpi.occupancy || 14} sub="+3 vs hier" color={GOLD} />
              <InfoTile label="Ruptures critiques" value={criticalCount} sub={`${lowCount} alertes basses`} color="#C0392B" />
              <InfoTile label="Sources connectees" value={`${liveSources}/${Math.max(sources.length, 1)}`} sub={health?.persistence || 'runtime'} color="#1D6A45" />
              <InfoTile label="Latence IA" value="118ms" sub={health?.posture || 'fdx-grade retail telemetry'} color="#1D6A45" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1rem', marginBottom: '1rem' }}>
              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Stocks critiques et rayons a traiter</SectionTitle>
                {STOCK_ROWS.map((item) => {
                  const color = statusColor(item.status)
                  return (
                    <div key={item.sku} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F2EFE6' }}>
                      <span style={{ fontSize: '0.8rem', minWidth: 24 }}>{item.emoji}</span>
                      <span style={{ fontSize: '0.72rem', color: BLACK, flex: 1 }}>{item.sku} · {item.zone}</span>
                      <div style={{ flex: 2, height: 3, background: '#F0EDE5' }}>
                        <div style={{ height: 3, width: `${Math.round((item.count / item.threshold) * 100)}%`, background: color }} />
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color, minWidth: 24, textAlign: 'right' }}>{item.count}</span>
                      <span style={{ fontSize: '0.55rem', padding: '2px 7px', background: `${color}12`, color, fontWeight: 800, letterSpacing: '.05em' }}>
                        {item.status}
                      </span>
                    </div>
                  )
                })}
              </section>

              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Operations terrain et parking</SectionTitle>
                <div style={{ display: 'grid', gap: 10 }}>
                  {PARKING_ROWS.map((item) => (
                    <div key={item.label} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${item.tone}`, borderRadius: 2, padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 900 }}>{item.emoji} {item.label}</div>
                      <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#666' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Marketing temps reel</SectionTitle>
                <div style={{ display: 'grid', gap: 10 }}>
                  {MARKETING_ROWS.map((item) => (
                    <div key={item.title} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '0.9rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 900 }}>{item.emoji} {item.title}</div>
                      <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#666', lineHeight: 1.7 }}>{item.text}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Gemini retail summary</SectionTitle>
                <div style={{ background: BLACK, borderLeft: `3px solid ${GOLD}`, borderRadius: 2, padding: '1rem' }}>
                  <div style={{ fontSize: '0.55rem', color: GOLD, letterSpacing: '.12em', fontWeight: 800, marginBottom: 6 }}>GEMINI SUMMARY</div>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,.74)', lineHeight: 1.7, margin: 0 }}>
                    Le magasin peut maintenant etre pilote de l entree au parking: surveillance, frequentation, file caisse,
                    ruptures, reserve, reception, scanning mobile et marketing temps reel dans une seule surface.
                  </p>
                </div>
                <div style={{ marginTop: '0.9rem', display: 'grid', gap: 8 }}>
                  {[
                    '🎥 Camera onboarding simplifie pour toute flotte magasin',
                    '📱 iPhone LiDAR pour reception et inventaire',
                    '🔐 Posture retail enterprise inspiree des exigences de Smith-Heffa Paygate',
                  ].map((item) => (
                    <div key={item} style={{ fontSize: '0.68rem', color: '#666' }}>{item}</div>
                  ))}
                </div>
              </section>
            </div>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Frequentation et pression magasin 06h-22h</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 3 }}>
                {HEATMAP.map((value, index) => {
                  const power = value / 37
                  const background = power > 0.55 ? `rgba(201,162,39,${0.18 + power * 0.75})` : `rgba(10,10,10,${0.04 + power * 0.2})`
                  return (
                    <div key={index} style={{ height: 28, background, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', fontWeight: 800, color: power > 0.5 ? '#6C5100' : '#777' }}>
                      {value}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {tab === 'cameras' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {sources.filter((item) => item.type.includes('camera') || item.id.startsWith('cam-')).map((source) => (
                <div key={source.id} style={{ background: BLACK, border: `1px solid ${statusColor(source.status)}`, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: 180, background: '#050505', display: 'grid', placeItems: 'center', color: '#333', fontSize: '0.62rem', letterSpacing: '.2em', textTransform: 'uppercase' }}>
                    {source.status === 'live' || source.status === 'ready' ? 'Vision feed ready' : 'No signal'}
                  </div>
                  <div style={{ padding: '0.8rem 0.95rem', borderTop: '1px solid #141414', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '0.74rem', fontWeight: 800 }}>{source.name}</div>
                      <div style={{ color: '#555', fontSize: '0.56rem', marginTop: 4 }}>{source.id} · {source.zone || 'zone non definie'}</div>
                    </div>
                    <div style={{ color: statusColor(source.status), fontSize: '0.55rem', fontWeight: 800, letterSpacing: '.1em' }}>{source.status.toUpperCase()}</div>
                  </div>
                </div>
              ))}
            </div>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Detections actives · video intelligence</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead>
                  <tr>
                    {['Camera', 'Objet', 'Confiance', 'Zone', 'Action', 'Temps'].map((header) => (
                      <th key={header} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, fontSize: '0.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 800 }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['cam-01', '👤 Personne', '97%', 'Entree', 'Flux client', '04:07:31'],
                    ['cam-02', '📦 Rayon vide', '94%', 'B3 etagere 2', 'Alerte rupture', '04:07:22'],
                    ['cam-03', '🧾 File caisse', '91%', 'Caisse', 'Pilotage personnel', '04:07:18'],
                    ['parking-01', '🚚 Livraison', '88%', 'Parking', 'Reception reserve', '04:06:59'],
                  ].map((row) => (
                    <tr key={row.join('-')} style={{ borderBottom: '1px solid #F2EFE6' }}>
                      {row.map((cell, index) => (
                        <td key={`${cell}-${index}`} style={{ padding: '9px 8px', color: index === 2 ? '#1D6A45' : BLACK, fontWeight: index === 2 ? 800 : 500 }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tab === 'stock' && (
          <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
            <SectionTitle>Stocks, scanning iPhone et recommandations rayon</SectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr>
                  {['Produit', 'Zone', 'Stock', 'Seuil', 'IA conf.', 'Statut', 'Action terrain'].map((header) => (
                    <th key={header} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, fontSize: '0.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 800 }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STOCK_ROWS.map((item) => {
                  const color = statusColor(item.status)
                  return (
                    <tr key={item.sku} style={{ borderBottom: '1px solid #F2EFE6' }}>
                      <td style={{ padding: '9px 8px' }}>{item.emoji} {item.sku}</td>
                      <td>{item.zone}</td>
                      <td style={{ color, fontWeight: 800 }}>{item.count}</td>
                      <td>{item.threshold}</td>
                      <td>{item.confidence}%</td>
                      <td>
                        <span style={{ fontSize: '0.55rem', padding: '2px 8px', background: `${color}12`, color, fontWeight: 800, letterSpacing: '.05em' }}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {item.status !== 'OK' ? (
                          <button
                            type="button"
                            onClick={() => sendAi(`Stock ${item.sku} ${item.zone}`)}
                            style={{ background: 'none', border: `1px solid ${GOLD}`, color: '#7A5E10', fontSize: '0.55rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 800 }}
                          >
                            Scan + reappro
                          </button>
                        ) : (
                          'stable'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'operations' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '1rem', marginBottom: '1rem' }}>
              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Fleet onboarding · sources declarees</SectionTitle>
                <div style={{ display: 'grid', gap: 10 }}>
                  {sources.map((source) => (
                    <div key={source.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${statusColor(source.status)}`, borderRadius: 2, padding: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 900 }}>{source.name}</div>
                          <div style={{ marginTop: 4, fontSize: '0.64rem', color: '#666' }}>
                            {source.type} · {source.input} · {source.playback || 'n/a'}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.55rem', color: statusColor(source.status), fontWeight: 800, letterSpacing: '.1em' }}>
                          {source.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: '0.66rem', color: '#666' }}>
                        Zone: {source.zone || 'non definie'} · Usage: {source.purpose || 'telemetry'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Workforce numerique magasin</SectionTitle>
                <div style={{ display: 'grid', gap: 10 }}>
                  {[
                    '🛡️ Surveillance et anomalies rayon, caisse, entree et reserve',
                    '📦 Stock temps reel, facing, rupture et reception livraison',
                    '🅿️ Parking, quais, occupation et rotation flotte',
                    '📣 Marketing, trafic, zones chaudes et recommandations promo',
                    '🧠 Gemini pour synthese voix, texte et commandes terrain',
                  ].map((item) => (
                    <div key={item} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '0.9rem', fontSize: '0.68rem', color: '#555' }}>
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <MobileCameraPublisher />
          </>
        )}

        {tab === 'gemini' && (
          <section style={{ background: BLACK, border: `1px solid rgba(201,162,39,.22)`, borderRadius: 2, padding: '1.5rem', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ width: 38, height: 38, background: GOLD, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '1rem', color: BLACK, fontWeight: 900 }}>
                G
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '.12em', color: '#fff' }}>Gemini retail orchestrator</div>
                <div style={{ fontSize: '0.56rem', color: 'rgba(201,162,39,.72)' }}>
                  vision · voix · parking · stock · magasin · reserve
                </div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#4CAF50', fontSize: '0.56rem', fontWeight: 800, letterSpacing: '.1em' }}>ACTIVE</div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              {['Rapport magasin', 'Stock critique', 'Parking logistique', 'Plan marketing', 'iPhone LiDAR'].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendAi(label)}
                  style={{ fontSize: '0.55rem', padding: '0.3rem 0.65rem', border: '1px solid rgba(201,162,39,.2)', color: 'rgba(201,162,39,.72)', background: 'none', cursor: 'pointer', fontWeight: 800 }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 330 }}>
              {messages.map((message, index) => (
                <div
                  key={`${message.ts}-${index}`}
                  style={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                    background: message.role === 'ai' ? 'rgba(247,245,239,.05)' : 'rgba(201,162,39,.09)',
                    borderLeft: message.role === 'ai' ? `2px solid ${GOLD}` : 'none',
                    borderRight: message.role === 'user' ? '2px solid rgba(201,162,39,.4)' : 'none',
                    borderRadius: 2,
                    padding: '0.75rem 0.9rem',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.72rem', color: message.role === 'ai' ? 'rgba(255,255,255,.74)' : 'rgba(255,255,255,.62)', lineHeight: 1.7 }}>
                    {message.text}
                  </p>
                </div>
              ))}

              {loadingAi ? (
                <div style={{ background: 'rgba(247,245,239,.05)', borderLeft: `2px solid ${GOLD}`, borderRadius: 2, padding: '0.75rem 0.9rem', alignSelf: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: GOLD, fontStyle: 'italic' }}>Gemini analyse...</p>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendAi(input)
                }}
                placeholder="Demande un rapport, une action stock, une lecture parking ou une strategie promo..."
                style={{ flex: 1, background: 'rgba(247,245,239,.05)', border: '1px solid rgba(201,162,39,.16)', borderRadius: 2, padding: '0.8rem 0.9rem', color: '#fff', fontSize: '0.72rem', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => sendAi(input)}
                style={{ background: GOLD, color: BLACK, border: 'none', borderRadius: 2, padding: '0.8rem 1rem', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Envoyer
              </button>
            </div>
          </section>
        )}

        {tab === 'reports' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              {
                emoji: '📊',
                title: 'Rapport exploitation magasin',
                desc: 'Frequentation, file caisse, ruptures, reserve, parking et performance rayon.',
              },
              {
                emoji: '🚚',
                title: 'Rapport logistique et parking',
                desc: 'Quais, rotations, livraison, occupation parking et passage reserve.',
              },
              {
                emoji: '📦',
                title: 'Rapport stock et inventaire',
                desc: 'Ruptures, seuils, reappro et scans iPhone LiDAR reception + reserve.',
              },
              {
                emoji: '📣',
                title: 'Rapport marketing temps reel',
                desc: 'Zones chaudes, campagnes vocales, trafic et recommandations promotionnelles.',
              },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => sendAi(item.title)}
                style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem', textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{item.emoji} {item.title}</span>
                  <span style={{ fontSize: '0.55rem', padding: '2px 8px', background: 'rgba(201,162,39,.12)', color: '#7A5E10', border: '1px solid rgba(201,162,39,.24)', fontWeight: 800 }}>
                    Gemini
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.68rem', color: '#666', lineHeight: 1.7 }}>{item.desc}</p>
              </button>
            ))}
          </div>
        )}

        <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem', marginTop: '1rem' }}>
          <SectionTitle>Timeline detections et occupation</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={events} margin={{ top: 0, right: 10, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE5" />
              <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#AAA' }} tickFormatter={(value) => String(value).slice(11, 19)} />
              <YAxis tick={{ fontSize: 9, fill: '#AAA' }} />
              <Tooltip
                contentStyle={{ background: BLACK, border: `1px solid ${GOLD}`, borderRadius: 2, fontSize: 11, color: '#fff' }}
                labelStyle={{ color: GOLD, fontSize: 10 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="entry" name="Entry" stroke={GOLD} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="exit" name="Exit" stroke={BLACK} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="occupancy" name="Occupancy" stroke="#999" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <EnterpriseFooter />
      </div>
    </main>
  )
}
