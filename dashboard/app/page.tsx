'use client'

import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import { startTransition, useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
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

type Membership = {
  role: string
  storeId: string
  storeSlug: string
  storeName: string
  status: string
}

type AuthPayload = {
  authenticated: boolean
  bootstrapAllowed: boolean
  user?: {
    id: string
    email: string
    displayName: string | null
  }
  currentStoreId?: string
  currentRole?: string
  memberships?: Membership[]
}

type SourceRecord = {
  id: string
  name: string
  type: string
  input: string
  playback: string | null
  status: string
  zone?: string | null
  purpose?: string | null
}

type BridgeRecord = {
  id: string
  profileKey: string
  name: string
  mode: string
  rtspUrl?: string | null
  webrtcUrl?: string | null
  hlsUrl?: string | null
  edgeRegion?: string | null
  status: string
}

type ProductRecord = {
  id: string
  sku: string
  barcode?: string | null
  name: string
  category?: string | null
  unit?: string | null
  aisle?: string | null
  shelf?: string | null
  threshold: number
  stockOnHand: number
  status: string
  emoji: string
}

type ScanRecord = {
  id: string
  sourceType: string
  barcode?: string | null
  quantity: number
  confidence?: number | null
  zone?: string | null
  createdAt: string
  productName?: string | null
  sourceName?: string | null
  actorName?: string | null
}

type AuditRecord = {
  id: string
  level: string
  action: string
  entityType: string
  entityId?: string | null
  createdAt: string
}

type DashboardPayload = {
  ok: boolean
  role: string
  user: {
    id: string
    email: string
    displayName: string | null
  }
  store: {
    id: string
    slug: string
    name: string
    city: string
    country: string
    address?: string | null
  }
  health: {
    ok: boolean
    status: string
    store: string
    posture: string
    sourceCount: number
    persistence: string
    privacy: string
  }
  kpis: {
    criticalProducts: number
    lowProducts: number
    liveSources: number
    sourceCount: number
    scans24h: number
  }
  sources: SourceRecord[]
  bridgeProfiles: BridgeRecord[]
  products: ProductRecord[]
  scans: ScanRecord[]
  audits: AuditRecord[]
}

type EventRecord = {
  entry?: number
  exit?: number
  occupancy?: number
  ts: string
}

type GeminiMessage = {
  role: 'user' | 'ai'
  text: string
  ts: string
}

const REPLIES: Record<string, string> = {
  report:
    'Rapport magasin: la plateforme consolide flux cameras, stocks critiques, scans terrain, bridge edge et traces d audit. Priorite immediate: traiter les produits critiques, valider les sources pending et fiabiliser le bridge du magasin actif.',
  stock:
    'Stocks: les produits sous seuil doivent etre rescannes via iPhone LiDAR ou barcode, puis reapprovisionnes depuis reserve. Chaque mouvement est maintenant journalise en base pour audit et tenancy multi-magasin.',
  parking:
    'Parking et logistique: la camera parking peut couvrir occupation, quais livraison, rotation flotte et attente de reception. Les evenements peuvent ensuite alimenter alertes operationnelles et orchestration magasin.',
  cameras:
    'Video pipeline: chaque magasin peut declarer ses sources RTSP, publier un profil bridge WebRTC/HLS, et rester compatible navigateur sans playback RTSP direct.',
  marketing:
    'Marketing temps reel: combine frequentation, heatmap, ruptures et zones chaudes pour piloter tete de gondole, messages vocaux et campagnes promotionnelles.',
  lidar:
    'iPhone LiDAR: utile pour reception palette, scan barcode, verification facing et inventaire reserve. Il agit comme un edge mobile qui complete les cameras fixes.',
  default:
    'Je peux t aider sur les cameras, le bridge RTSP, les scans stock, la multi-boutique, le parking ou la synthese Gemini du magasin.',
}

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

function statusTone(status: string) {
  const value = status.toLowerCase()
  if (value === 'critical' || value === 'warn' || value === 'offline') return '#C0392B'
  if (value === 'low' || value === 'planned' || value === 'pending') return '#8B6000'
  if (value === 'ready' || value === 'live' || value === 'ok' || value === 'active') return '#1D6A45'
  return '#7E786F'
}

function SectionTitle({ children }: { children: ReactNode }) {
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

function formatDate(value: string) {
  return new Date(value).toLocaleString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
}

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '.16em', textTransform: 'uppercase', color: GOLD, fontWeight: 800 }}>{title}</div>
      <p style={{ margin: '0.65rem 0 1rem', fontSize: '0.72rem', color: '#666', lineHeight: 1.7 }}>{subtitle}</p>
      {children}
    </section>
  )
}

function AuthScreen({
  bootstrapAllowed,
  actionLoading,
  authError,
  loginForm,
  bootstrapForm,
  setLoginForm,
  setBootstrapForm,
  onLogin,
  onBootstrap,
}: {
  bootstrapAllowed: boolean
  actionLoading: boolean
  authError: string | null
  loginForm: { email: string; password: string }
  bootstrapForm: { displayName: string; email: string; password: string }
  setLoginForm: Dispatch<SetStateAction<{ email: string; password: string }>>
  setBootstrapForm: Dispatch<SetStateAction<{ displayName: string; email: string; password: string }>>
  onLogin: () => void
  onBootstrap: () => void
}) {
  return (
    <main style={{ minHeight: '100vh', background: '#fff', color: BLACK, fontFamily: 'system-ui, sans-serif', display: 'grid', gridTemplateRows: '1fr auto' }}>
      <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', padding: '2.2rem 2rem 2rem' }}>
        <div style={{ background: BLACK, border: `1px solid rgba(201,162,39,.16)`, borderRadius: 2, padding: '2rem', color: '#fff', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '.22em', textTransform: 'uppercase', color: GOLD, fontWeight: 800 }}>
            Buttertech · VIIZE · Retail control plane
          </div>
          <h1 style={{ margin: '0.8rem 0 0', fontSize: '3rem', lineHeight: 0.96, letterSpacing: '-0.06em' }}>
            Intelligence video, stock et operations.
          </h1>
          <p style={{ margin: '1rem 0 0', maxWidth: 860, fontSize: '0.84rem', lineHeight: 1.8, color: 'rgba(255,255,255,.72)' }}>
            Une surface enterprise pour deployer la surveillance, les ruptures, le parking, la reception marchandise,
            les scans barcode/LiDAR et le bridge RTSP vers WebRTC/HLS par magasin avec multi-tenancy, roles et audit.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: bootstrapAllowed ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          {bootstrapAllowed ? (
            <AuthCard
              title="Bootstrap owner"
              subtitle="Premier demarrage production: creation du compte owner, du premier magasin et du seed supermarket."
            >
              <div style={{ display: 'grid', gap: 10 }}>
                <input value={bootstrapForm.displayName} onChange={(event) => setBootstrapForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nom complet" style={inputStyle} />
                <input value={bootstrapForm.email} onChange={(event) => setBootstrapForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" style={inputStyle} />
                <input value={bootstrapForm.password} onChange={(event) => setBootstrapForm((current) => ({ ...current, password: event.target.value }))} placeholder="Mot de passe fort" type="password" style={inputStyle} />
                <button type="button" onClick={onBootstrap} disabled={actionLoading} style={primaryButton}>
                  Lancer le bootstrap owner
                </button>
              </div>
            </AuthCard>
          ) : null}

          <AuthCard
            title="Connexion enterprise"
            subtitle="Acces par session signee, role, magasin courant et audit de connexion."
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <input value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" style={inputStyle} />
              <input value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} placeholder="Mot de passe" type="password" style={inputStyle} />
              <button type="button" onClick={onLogin} disabled={actionLoading} style={primaryButton}>
                Se connecter
              </button>
            </div>
          </AuthCard>
        </div>

        {authError ? (
          <div style={{ marginTop: '1rem', border: '1px solid #F1C4C4', background: '#FFF4F4', color: '#9F2D2D', padding: '0.9rem 1rem', borderRadius: 2 }}>
            {authError}
          </div>
        ) : null}
      </div>

      <EnterpriseFooter />
    </main>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 2,
  padding: '0.85rem 0.9rem',
  fontSize: '0.74rem',
  outline: 'none',
}

const primaryButton: CSSProperties = {
  background: BLACK,
  color: GOLD,
  border: 'none',
  borderRadius: 2,
  padding: '0.85rem 1rem',
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const secondaryButton: CSSProperties = {
  background: '#fff',
  color: BLACK,
  border: `1px solid ${BORDER}`,
  borderRadius: 2,
  padding: '0.75rem 0.9rem',
  fontSize: '0.62rem',
  fontWeight: 800,
  cursor: 'pointer',
}

export default function DashboardPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [auth, setAuth] = useState<AuthPayload | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [events, setEvents] = useState<EventRecord[]>([])
  const [messages, setMessages] = useState<GeminiMessage[]>([
    {
      role: 'ai',
      text: 'VIIZE est pret pour les cameras, le bridge edge, le stock reel, la multi-boutique et l audit enterprise.',
      ts: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [bootstrapForm, setBootstrapForm] = useState({ displayName: '', email: '', password: '' })
  const [scanForm, setScanForm] = useState({ barcode: '', quantity: '0', sourceType: 'iphone-lidar', zone: 'reserve', mode: 'set' })
  const [storeForm, setStoreForm] = useState({ slug: '', name: '', city: 'Montreal', country: 'CA' })
  const [bridgeForm, setBridgeForm] = useState({ profileKey: '', name: '', sourceKey: '', rtspUrl: '', webrtcUrl: '', hlsUrl: '', edgeRegion: 'northamerica-northeast1', status: 'planned' })
  const endRef = useRef<HTMLDivElement>(null)

  async function fetchJson<T>(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error((data as { error?: string }).error || 'Requete impossible.')
    }
    return data as T
  }

  async function refreshAuth() {
    try {
      const data = await fetchJson<AuthPayload>('/api/auth/me')
      setAuth(data)
      return data
    } catch {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await response.json().catch(() => ({ authenticated: false, bootstrapAllowed: false }))
      setAuth(data as AuthPayload)
      return data as AuthPayload
    }
  }

  async function refreshDashboard() {
    const [dashboardData, eventsData] = await Promise.all([
      fetchJson<DashboardPayload>('/api/dashboard'),
      fetch('/api/events', { cache: 'no-store' }).then((response) => response.json()).catch(() => ({ events: [] })),
    ])

    setDashboard(dashboardData)
    setEvents(Array.isArray(eventsData.events) ? eventsData.events.slice(0, 24).reverse() : [])
  }

  useEffect(() => {
    startTransition(async () => {
      const me = await refreshAuth()
      if (me.authenticated) {
        await refreshDashboard()
      }
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!auth?.authenticated) {
      return
    }

    const id = window.setInterval(() => {
      startTransition(() => {
        refreshDashboard().catch(() => undefined)
      })
    }, 6000)

    return () => window.clearInterval(id)
  }, [auth?.authenticated, auth?.currentStoreId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingAi])

  function sendAi(question: string) {
    const value = question.trim()
    if (!value) return

    setMessages((current) => [...current, { role: 'user', text: value, ts: new Date().toISOString() }])
    setLoadingAi(true)
    setInput('')

    window.setTimeout(() => {
      setMessages((current) => [...current, { role: 'ai', text: askReply(value), ts: new Date().toISOString() }])
      setLoadingAi(false)
    }, 700)
  }

  async function handleLogin() {
    setActionLoading(true)
    setAuthError(null)
    try {
      await fetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })
      const me = await refreshAuth()
      if (me.authenticated) {
        await refreshDashboard()
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBootstrap() {
    setActionLoading(true)
    setAuthError(null)
    try {
      await fetchJson('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify(bootstrapForm),
      })
      const me = await refreshAuth()
      if (me.authenticated) {
        await refreshDashboard()
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Bootstrap impossible.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLogout() {
    await fetchJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) })
    setAuth(null)
    setDashboard(null)
    setEvents([])
    await refreshAuth()
  }

  async function handleStoreSwitch(storeId: string) {
    try {
      await fetchJson('/api/auth/switch-store', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      })
      await refreshAuth()
      await refreshDashboard()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossible de changer de magasin.')
    }
  }

  async function submitScan() {
    try {
      await fetchJson('/api/scans', {
        method: 'POST',
        body: JSON.stringify({
          barcode: scanForm.barcode,
          quantity: Number(scanForm.quantity),
          sourceType: scanForm.sourceType,
          zone: scanForm.zone,
          mode: scanForm.mode,
          payload: { lidar: scanForm.sourceType === 'iphone-lidar' },
        }),
      })
      await refreshDashboard()
      setScanForm((current) => ({ ...current, barcode: '', quantity: '0' }))
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Scan impossible.')
    }
  }

  async function submitStore() {
    try {
      await fetchJson('/api/stores', {
        method: 'POST',
        body: JSON.stringify(storeForm),
      })
      const me = await refreshAuth()
      if (me.memberships?.length) {
        await handleStoreSwitch(me.memberships[me.memberships.length - 1].storeId)
      }
      setStoreForm({ slug: '', name: '', city: 'Montreal', country: 'CA' })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Creation magasin impossible.')
    }
  }

  async function submitBridge() {
    try {
      await fetchJson('/api/bridge', {
        method: 'POST',
        body: JSON.stringify(bridgeForm),
      })
      await refreshDashboard()
      setBridgeForm({ profileKey: '', name: '', sourceKey: '', rtspUrl: '', webrtcUrl: '', hlsUrl: '', edgeRegion: 'northamerica-northeast1', status: 'planned' })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Bridge impossible.')
    }
  }

  if (authLoading) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>Chargement VIIZE...</main>
  }

  if (!auth?.authenticated || !dashboard) {
    return (
      <AuthScreen
        bootstrapAllowed={Boolean(auth?.bootstrapAllowed)}
        actionLoading={actionLoading}
        authError={authError}
        loginForm={loginForm}
        bootstrapForm={bootstrapForm}
        setLoginForm={setLoginForm}
        setBootstrapForm={setBootstrapForm}
        onLogin={handleLogin}
        onBootstrap={handleBootstrap}
      />
    )
  }

  const navItems: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Vue d ensemble' },
    { key: 'cameras', label: 'Cameras live' },
    { key: 'stock', label: 'Stocks' },
    { key: 'operations', label: 'Operations' },
    { key: 'gemini', label: 'Gemini IA' },
    { key: 'reports', label: 'Rapports' },
  ]

  const currentMembership = auth.memberships?.find((item) => item.storeId === auth.currentStoreId) || null
  const occupancySeries = events.length ? events : [{ ts: new Date().toISOString(), occupancy: 0, entry: 0, exit: 0 }]

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
              Supermarket intelligence platform
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <select value={auth.currentStoreId} onChange={(event) => handleStoreSwitch(event.target.value)} style={{ ...secondaryButton, minWidth: 220 }}>
            {auth.memberships?.map((membership) => (
              <option key={membership.storeId} value={membership.storeId}>
                {membership.storeName} · {membership.role}
              </option>
            ))}
          </select>
          <div style={{ fontSize: '0.62rem', color: '#B8B8B8' }}>
            {dashboard.store.city} · {dashboard.store.country} · {currentMembership?.role || dashboard.role}
          </div>
          <button type="button" onClick={handleLogout} style={{ ...secondaryButton, color: '#fff', borderColor: '#333', background: '#111' }}>
            Quitter
          </button>
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
        {authError ? (
          <div style={{ marginBottom: '1rem', border: '1px solid #F1C4C4', background: '#FFF4F4', color: '#9F2D2D', padding: '0.85rem 1rem', borderRadius: 2 }}>
            {authError}
          </div>
        ) : null}

        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <InfoTile label="Magasin" value={dashboard.store.name} sub={dashboard.store.address || dashboard.store.slug} color={GOLD} />
              <InfoTile label="Sources connectees" value={`${dashboard.kpis.liveSources}/${dashboard.kpis.sourceCount}`} sub={dashboard.health.persistence} color="#1D6A45" />
              <InfoTile label="Stocks critiques" value={dashboard.kpis.criticalProducts} sub={`${dashboard.kpis.lowProducts} produits bas`} color="#C0392B" />
              <InfoTile label="Scans recents" value={dashboard.kpis.scans24h} sub={dashboard.health.posture} color="#1D6A45" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem', marginBottom: '1rem' }}>
              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Frequentation et pression magasin</SectionTitle>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={occupancySeries}>
                      <CartesianGrid stroke="#F0EDE5" />
                      <XAxis dataKey="ts" tickFormatter={(value) => new Date(value).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })} fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="occupancy" stroke={GOLD} strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Gemini retail summary</SectionTitle>
                <div style={{ background: BLACK, borderLeft: `3px solid ${GOLD}`, borderRadius: 2, padding: '1rem' }}>
                  <div style={{ fontSize: '0.55rem', color: GOLD, letterSpacing: '.12em', fontWeight: 800, marginBottom: 6 }}>GEMINI SUMMARY</div>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,.74)', lineHeight: 1.7, margin: 0 }}>
                    {dashboard.store.name} dispose maintenant d un socle exploitable: sources persistees, profils bridge, scans stock
                    reels, audit et roles par magasin avec onboarding iPhone LiDAR.
                  </p>
                </div>
                <div style={{ marginTop: '0.9rem', display: 'grid', gap: 8 }}>
                  {[
                    `🔐 ${dashboard.health.privacy}`,
                    `🏬 ${dashboard.store.city} · ${dashboard.store.country}`,
                    `📡 ${dashboard.bridgeProfiles.length} profils bridge actives ou planifies`,
                  ].map((item) => (
                    <div key={item} style={{ fontSize: '0.68rem', color: '#666' }}>{item}</div>
                  ))}
                </div>
              </section>
            </div>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Produits a traiter</SectionTitle>
              <div style={{ display: 'grid', gap: 10 }}>
                {dashboard.products.slice(0, 6).map((product) => (
                  <div key={product.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 1fr auto auto', gap: '0.75rem', alignItems: 'center', borderBottom: '1px solid #F2EFE6', padding: '0.7rem 0' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700 }}>{product.emoji} {product.name}</div>
                    <div style={{ height: 4, background: '#F0EDE5' }}>
                      <div style={{ height: 4, width: `${Math.min(100, Math.max(8, Math.round((product.stockOnHand / Math.max(product.threshold, 1)) * 100)))}%`, background: statusTone(product.status) }} />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: statusTone(product.status), fontWeight: 800 }}>{product.stockOnHand} / {product.threshold}</div>
                    <button type="button" onClick={() => sendAi(`Stock ${product.name}`)} style={secondaryButton}>Analyser</button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'cameras' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {dashboard.sources.map((source) => (
                <div key={source.id} style={{ background: BLACK, border: `1px solid ${statusTone(source.status)}`, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: 180, background: '#050505', display: 'grid', placeItems: 'center', color: '#333', fontSize: '0.62rem', letterSpacing: '.2em', textTransform: 'uppercase' }}>
                    {source.status === 'live' || source.status === 'ready' ? 'Vision feed ready' : 'Awaiting signal'}
                  </div>
                  <div style={{ padding: '0.8rem 0.95rem', borderTop: '1px solid #141414', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '0.74rem', fontWeight: 800 }}>{source.name}</div>
                      <div style={{ color: '#666', fontSize: '0.56rem', marginTop: 4 }}>{source.id} · {source.zone || 'zone non definie'}</div>
                    </div>
                    <div style={{ color: statusTone(source.status), fontSize: '0.55rem', fontWeight: 800, letterSpacing: '.1em' }}>{source.status.toUpperCase()}</div>
                  </div>
                </div>
              ))}
            </div>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Bridge RTSP → WebRTC / HLS</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead>
                  <tr>
                    {['Profil', 'Mode', 'RTSP', 'WebRTC', 'HLS', 'Region', 'Statut'].map((header) => (
                      <th key={header} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, fontSize: '0.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 800 }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.bridgeProfiles.map((bridge) => (
                    <tr key={bridge.id} style={{ borderBottom: '1px solid #F2EFE6' }}>
                      <td style={{ padding: '9px 8px' }}>{bridge.name}</td>
                      <td>{bridge.mode}</td>
                      <td>{bridge.rtspUrl || 'n/a'}</td>
                      <td>{bridge.webrtcUrl || 'n/a'}</td>
                      <td>{bridge.hlsUrl || 'n/a'}</td>
                      <td>{bridge.edgeRegion || 'n/a'}</td>
                      <td style={{ color: statusTone(bridge.status), fontWeight: 800 }}>{bridge.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {tab === 'stock' && (
          <>
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem', marginBottom: '1rem' }}>
              <SectionTitle>Stocks reels et base produit</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr>
                    {['Produit', 'Barcode', 'Zone', 'Stock', 'Seuil', 'Statut', 'Action'].map((header) => (
                      <th key={header} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, fontSize: '0.55rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 800 }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.products.map((product) => (
                    <tr key={product.id} style={{ borderBottom: '1px solid #F2EFE6' }}>
                      <td style={{ padding: '9px 8px' }}>{product.emoji} {product.name}</td>
                      <td>{product.barcode || 'n/a'}</td>
                      <td>{product.aisle || 'n/a'}</td>
                      <td style={{ color: statusTone(product.status), fontWeight: 800 }}>{product.stockOnHand}</td>
                      <td>{product.threshold}</td>
                      <td><span style={{ color: statusTone(product.status), fontWeight: 800 }}>{product.status.toUpperCase()}</span></td>
                      <td>
                        <button type="button" onClick={() => setScanForm((current) => ({ ...current, barcode: product.barcode || current.barcode, quantity: String(product.stockOnHand) }))} style={secondaryButton}>
                          Preparer scan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Ingestion produit · barcode · LiDAR</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr)) auto', gap: '0.75rem', alignItems: 'end' }}>
                <input value={scanForm.barcode} onChange={(event) => setScanForm((current) => ({ ...current, barcode: event.target.value }))} placeholder="Barcode" style={inputStyle} />
                <input value={scanForm.quantity} onChange={(event) => setScanForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantite" style={inputStyle} />
                <select value={scanForm.sourceType} onChange={(event) => setScanForm((current) => ({ ...current, sourceType: event.target.value }))} style={inputStyle}>
                  <option value="iphone-lidar">iPhone LiDAR</option>
                  <option value="barcode-scanner">Barcode scanner</option>
                  <option value="camera-vision">Camera vision</option>
                  <option value="manual">Manual</option>
                </select>
                <input value={scanForm.zone} onChange={(event) => setScanForm((current) => ({ ...current, zone: event.target.value }))} placeholder="Zone" style={inputStyle} />
                <select value={scanForm.mode} onChange={(event) => setScanForm((current) => ({ ...current, mode: event.target.value }))} style={inputStyle}>
                  <option value="set">Set stock</option>
                  <option value="delta">Delta stock</option>
                </select>
                <button type="button" onClick={submitScan} style={primaryButton}>Enregistrer</button>
              </div>

              <div style={{ marginTop: '1rem', display: 'grid', gap: 10 }}>
                {dashboard.scans.map((scan) => (
                  <div key={scan.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '0.85rem 0.95rem' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800 }}>{scan.productName || scan.barcode || 'Scan sans produit'} · {scan.quantity}</div>
                    <div style={{ marginTop: 4, fontSize: '0.64rem', color: '#666' }}>
                      {scan.sourceType} · {scan.zone || 'zone n/a'} · {scan.sourceName || 'source manuelle'} · {formatDate(scan.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'operations' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Ajouter un magasin</SectionTitle>
                <div style={{ display: 'grid', gap: 10 }}>
                  <input value={storeForm.slug} onChange={(event) => setStoreForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Slug magasin" style={inputStyle} />
                  <input value={storeForm.name} onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nom magasin" style={inputStyle} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                    <input value={storeForm.city} onChange={(event) => setStoreForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ville" style={inputStyle} />
                    <input value={storeForm.country} onChange={(event) => setStoreForm((current) => ({ ...current, country: event.target.value }))} placeholder="Pays" style={inputStyle} />
                  </div>
                  <button type="button" onClick={submitStore} style={primaryButton}>Creer le magasin</button>
                </div>
              </section>

              <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
                <SectionTitle>Configurer un bridge edge</SectionTitle>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input value={bridgeForm.profileKey} onChange={(event) => setBridgeForm((current) => ({ ...current, profileKey: event.target.value }))} placeholder="profileKey" style={inputStyle} />
                    <input value={bridgeForm.name} onChange={(event) => setBridgeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nom du bridge" style={inputStyle} />
                  </div>
                  <select value={bridgeForm.sourceKey} onChange={(event) => setBridgeForm((current) => ({ ...current, sourceKey: event.target.value }))} style={inputStyle}>
                    <option value="">Associer une source</option>
                    {dashboard.sources.map((source) => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </select>
                  <input value={bridgeForm.rtspUrl} onChange={(event) => setBridgeForm((current) => ({ ...current, rtspUrl: event.target.value }))} placeholder="rtsp://..." style={inputStyle} />
                  <input value={bridgeForm.webrtcUrl} onChange={(event) => setBridgeForm((current) => ({ ...current, webrtcUrl: event.target.value }))} placeholder="webrtc://..." style={inputStyle} />
                  <input value={bridgeForm.hlsUrl} onChange={(event) => setBridgeForm((current) => ({ ...current, hlsUrl: event.target.value }))} placeholder="https://.../master.m3u8" style={inputStyle} />
                  <button type="button" onClick={submitBridge} style={primaryButton}>Enregistrer le bridge</button>
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
                  vision · voix · stock · parking · audit · multi-store
                </div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#4CAF50', fontSize: '0.56rem', fontWeight: 800, letterSpacing: '.1em' }}>ACTIVE</div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              {['Rapport magasin', 'Stock critique', 'Parking logistique', 'Plan marketing', 'iPhone LiDAR'].map((label) => (
                <button key={label} type="button" onClick={() => sendAi(label)} style={{ ...secondaryButton, background: 'transparent', color: GOLD, borderColor: 'rgba(201,162,39,.2)' }}>
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
              {loadingAi ? <div style={{ color: GOLD, fontSize: '0.72rem' }}>Gemini analyse...</div> : null}
              <div ref={endRef} />
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
              <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendAi(input) }} placeholder="Demande un rapport, un statut bridge, un risque stock ou un plan terrain..." style={{ ...inputStyle, background: 'rgba(247,245,239,.05)', color: '#fff', borderColor: 'rgba(201,162,39,.16)' }} />
              <button type="button" onClick={() => sendAi(input)} style={{ ...primaryButton, background: GOLD, color: BLACK }}>Envoyer</button>
            </div>
          </section>
        )}

        {tab === 'reports' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Audit enterprise</SectionTitle>
              <div style={{ display: 'grid', gap: 10 }}>
                {dashboard.audits.map((audit) => (
                  <div key={audit.id} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${statusTone(audit.level)}`, borderRadius: 2, padding: '0.85rem 0.95rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800 }}>{audit.action}</div>
                    <div style={{ marginTop: 4, fontSize: '0.62rem', color: '#666' }}>{audit.entityType} · {audit.entityId || 'n/a'} · {formatDate(audit.createdAt)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 2, padding: '1.25rem' }}>
              <SectionTitle>Tenancy et magasins</SectionTitle>
              <div style={{ display: 'grid', gap: 10 }}>
                {auth.memberships?.map((membership) => (
                  <div key={membership.storeId} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 2, padding: '0.85rem 0.95rem' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800 }}>{membership.storeName}</div>
                    <div style={{ marginTop: 4, fontSize: '0.64rem', color: '#666' }}>{membership.storeSlug} · {membership.role} · {membership.status}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <EnterpriseFooter />
    </main>
  )
}
