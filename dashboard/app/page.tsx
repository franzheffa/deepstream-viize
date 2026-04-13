'use client'
import { useEffect, useState, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const GOLD  = '#C9A227'
const BLACK = '#0A0A0A'

const CAMERA_DEFS = [
  { id: 'cam-01', name: 'Entrée principale', location: 'Entrée',  zone: 'entree' },
  { id: 'cam-02', name: 'Rayon épicerie',    location: 'Rayons',  zone: 'rayons' },
  { id: 'cam-03', name: 'Caisse',            location: 'Caisse',  zone: 'caisse' },
]

interface Event { entry?:number; exit?:number; occupancy?:number; ts:string; streamId?:string; detections?:number }
interface CamState { id:string; name:string; location:string; zone:string; online:boolean; persons:number; detections:number; lastTs:string|null }
interface GeminiMsg { role:'user'|'ai'; text:string; ts:string }

const REPLIES: Record<string,string> = {
  rapport:  "Rapport du jour — Fréquentation : 47 passages (+12% vs hier). Ruptures actives : Eau 500ml rayon B3, Pain baguette A2. Réappro recommandé depuis réserve R-12. Pic prévu : 11h30-13h.",
  commande: "Bon de commande généré — Eau 500ml : 48 unités, Pain baguette : 20 unités, Yaourt nature : 30 unités. Total estimé : 127 CAD. Voulez-vous que j'envoie la commande au fournisseur ?",
  camera:   "J'analyse CAM-02 rayon B3 en temps réel. 3 bouteilles d'eau détectées étagère 2 (seuil : 8). Caméra entrée : 14 personnes. Aucune anomalie comportementale.",
  stock:    "Stocks — Critique : Eau 500ml (3/8), Pain baguette (2/5). Bas : Yaourt (4/10). OK : Jus orange (12), Lait (9), Chips (18). 2 réapprovisionnements urgents.",
  prevision:"Prévision 7 jours — Weekend +35% fréquentation. Risque rupture : Eau (vendredi), Yaourt (samedi), Chips (dimanche). Génération commandes préventives ?",
  default:  "Bien reçu. J'analyse vos données DeepStream et caméras en temps réel. Que puis-je faire pour vous ?",
}

function geminiReply(q:string):string {
  const ql = q.toLowerCase()
  if (ql.includes('rapport') || ql.includes('résumé')) return REPLIES.rapport
  if (ql.includes('commande') || ql.includes('commander')) return REPLIES.commande
  if (ql.includes('camera') || ql.includes('caméra') || ql.includes('analyse')) return REPLIES.camera
  if (ql.includes('stock') || ql.includes('rupture')) return REPLIES.stock
  if (ql.includes('prévi') || ql.includes('weekend')) return REPLIES.prevision
  return REPLIES.default
}

const STOCK_DATA = [
  { sku:'Eau 500ml',     zone:'B3', count:3,  threshold:8,  status:'CRITIQUE' },
  { sku:'Pain baguette', zone:'A2', count:2,  threshold:5,  status:'BAS' },
  { sku:'Yaourt nature', zone:'C1', count:4,  threshold:10, status:'BAS' },
  { sku:'Jus orange 1L', zone:'D2', count:12, threshold:6,  status:'OK' },
  { sku:'Lait entier 1L',zone:'B1', count:9,  threshold:8,  status:'OK' },
  { sku:'Chips nature',  zone:'E1', count:18, threshold:5,  status:'OK' },
]

const HEATMAP = [2,5,9,14,20,24,21,27,31,28,22,17,23,29,33,31,25,19,15,11,8,5,3,2]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
      <div style={{ width:3, height:14, background:GOLD, borderRadius:1 }} />
      <span style={{ fontSize:'0.6rem', letterSpacing:'.2em', textTransform:'uppercase', fontWeight:700, color:BLACK }}>{children}</span>
    </div>
  )
}

function ViewfinderCorner({ pos, active }: { pos:'tl'|'tr'|'bl'|'br'; active:boolean }) {
  const color = active ? GOLD : '#1e1e1e'
  const size = 12, inset = 8
  return <div style={{
    position:'absolute', width:size, height:size,
    borderTop:    (pos==='tl'||pos==='tr') ? `1.5px solid ${color}` : 'none',
    borderBottom: (pos==='bl'||pos==='br') ? `1.5px solid ${color}` : 'none',
    borderLeft:   (pos==='tl'||pos==='bl') ? `1.5px solid ${color}` : 'none',
    borderRight:  (pos==='tr'||pos==='br') ? `1.5px solid ${color}` : 'none',
    top:    (pos==='tl'||pos==='tr') ? inset : undefined,
    bottom: (pos==='bl'||pos==='br') ? inset : undefined,
    left:   (pos==='tl'||pos==='bl') ? inset : undefined,
    right:  (pos==='tr'||pos==='br') ? inset : undefined,
    transition:'border-color .3s',
  }} />
}

function CameraCard({ cam, tick }: { cam:CamState; tick:number }) {
  const active = cam.online
  return (
    <div style={{ background:BLACK, borderRadius:2, overflow:'hidden', border:`1.5px solid ${active?GOLD:'#1c1c1c'}`, boxShadow:active?`0 0 16px rgba(201,162,39,0.12)`:'none', transition:'border-color .3s,box-shadow .3s' }}>
      <div style={{ position:'relative', height:160, background:'#060606', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0px,transparent 1px,transparent 4px)' }} />
        {(['tl','tr','bl','br'] as const).map(p => <ViewfinderCorner key={p} pos={p} active={active} />)}
        {active ? (
          <>
            <div style={{ textAlign:'center', zIndex:1 }}>
              <div style={{ fontSize:'3rem', fontWeight:900, color:GOLD, lineHeight:1 }}>{cam.persons}</div>
              <div style={{ fontSize:'0.55rem', color:'#555', letterSpacing:'.2em', textTransform:'uppercase', marginTop:'0.3rem' }}>personnes</div>
            </div>
            <div style={{ position:'absolute', top:10, right:12, display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', opacity:tick%2===0?1:.25, transition:'opacity .8s' }} />
              <span style={{ fontSize:'0.5rem', color:'#ef4444', fontWeight:800, letterSpacing:'.12em' }}>REC</span>
            </div>
            <div style={{ position:'absolute', top:10, left:12, fontSize:'0.5rem', color:'#555', fontFamily:'monospace' }}>{cam.detections} obj</div>
          </>
        ) : (
          <div style={{ textAlign:'center', zIndex:1 }}>
            <div style={{ fontSize:'0.58rem', color:'#2a2a2a', letterSpacing:'.25em', textTransform:'uppercase', fontWeight:600 }}>No Signal</div>
            <div style={{ marginTop:8, display:'flex', gap:4, justifyContent:'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width:4, height:4, borderRadius:'50%', background:'#1a1a1a' }} />)}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding:'0.65rem 0.9rem', borderTop:'1px solid #141414', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#e5e5e5' }}>{cam.name}</div>
          <div style={{ fontSize:'0.55rem', color:'#444', marginTop:2 }}>{cam.id} · {cam.location}</div>
          {cam.lastTs && <div style={{ fontSize:'0.5rem', color:'#333', marginTop:2, fontFamily:'monospace' }}>{cam.lastTs.slice(11,19)} UTC</div>}
        </div>
        <div style={{ background:active?'rgba(201,162,39,0.12)':'#0e0e0e', border:`1px solid ${active?GOLD:'#1c1c1c'}`, borderRadius:20, padding:'0.2rem 0.65rem', fontSize:'0.5rem', color:active?GOLD:'#2a2a2a', fontWeight:800, letterSpacing:'.12em', transition:'all .3s' }}>
          {active ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [tab, setTab]           = useState<'overview'|'cameras'|'stock'|'gemini'|'reports'>('overview')
  const [events, setEvents]     = useState<Event[]>([])
  const [kpi, setKpi]           = useState({ entry:0, exit:0, occupancy:0 })
  const [cams, setCams]         = useState<CamState[]>(CAMERA_DEFS.map(c => ({ ...c, online:false, persons:0, detections:0, lastTs:null })))
  const [tick, setTick]         = useState(0)
  const [gemMsgs, setGemMsgs]   = useState<GeminiMsg[]>([{ role:'ai', text:"Bonjour gérant. J'analyse vos caméras DeepStream. 3 alertes stock actives. Fréquentation : 14 personnes. Que voulez-vous que je fasse ?", ts:new Date().toISOString() }])
  const [gemInput, setGemInput] = useState('')
  const [gemLoading, setGemLoading] = useState(false)
  const gemEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch('/api/events')
        const data = await res.json()
        const evts: Event[] = data.events ?? []
        if (evts.length > 0) {
          setEvents(evts.slice(0,30).reverse())
          const l = evts[0]
          setKpi({ entry:l.entry??0, exit:l.exit??0, occupancy:l.occupancy??0 })
          setCams(prev => prev.map(cam => {
            const hit = evts.find(e => e.streamId === cam.id)
            return hit ? { ...cam, online:true, persons:hit.occupancy??0, detections:hit.detections??0, lastTs:hit.ts } : cam
          }))
        }
        setTick(t => t + 1)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { gemEnd.current?.scrollIntoView({ behavior:'smooth' }) }, [gemMsgs])

  const totalOnline = cams.filter(c => c.online).length

  const sendGemini = () => {
    const q = gemInput.trim()
    if (!q) return
    setGemMsgs(m => [...m, { role:'user', text:q, ts:new Date().toISOString() }])
    setGemInput('')
    setGemLoading(true)
    setTimeout(() => {
      setGemMsgs(m => [...m, { role:'ai', text:geminiReply(q), ts:new Date().toISOString() }])
      setGemLoading(false)
    }, 900)
  }

  const quickAsk = (q: string) => {
    setTab('gemini')
    setTimeout(() => {
      setGemMsgs(m => [...m, { role:'user', text:q, ts:new Date().toISOString() }])
      setTimeout(() => setGemMsgs(m => [...m, { role:'ai', text:geminiReply(q), ts:new Date().toISOString() }]), 900)
    }, 100)
  }

  const criticalCount = STOCK_DATA.filter(s => s.status === 'CRITIQUE').length
  const navItems = [
    { key:'overview' as const, label:"Vue d'ensemble" },
    { key:'cameras'  as const, label:'Cameras live' },
    { key:'stock'    as const, label:'Stocks' },
    { key:'gemini'   as const, label:'Gemini IA' },
    { key:'reports'  as const, label:'Rapports' },
  ]

  return (
    <main style={{ minHeight:'100vh', background:'#fff', color:BLACK, fontFamily:'system-ui,sans-serif' }}>

      <header style={{ background:BLACK, borderBottom:`3px solid ${GOLD}`, padding:'0.9rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.9rem' }}>
          <div style={{ width:3, height:34, background:GOLD, borderRadius:2 }} />
          <div>
            <div style={{ fontSize:'0.55rem', letterSpacing:'.25em', textTransform:'uppercase', color:GOLD, fontWeight:700 }}>Buttertech · Viize</div>
            <div style={{ fontSize:'1.1rem', fontWeight:900, color:'#fff', letterSpacing:'-0.02em' }}>Intelligence Platform</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
          <span style={{ fontSize:'0.6rem', color:'#666', letterSpacing:'.05em' }}>Epicerie Saint-Denis · Montreal</span>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:totalOnline>0?'#4CAF50':GOLD }} />
            <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'.1em', color:totalOnline>0?'#4CAF50':GOLD }}>
              {totalOnline > 0 ? `${totalOnline}/${cams.length} LIVE` : 'AWAITING SIGNAL'}
            </span>
          </div>
        </div>
      </header>

      <nav style={{ background:'#F9F8F4', borderBottom:'1px solid #E8E6DE', display:'flex', padding:'0 2rem', overflowX:'auto' }}>
        {navItems.map(n => (
          <button key={n.key} onClick={() => setTab(n.key)} style={{ background:'none', border:'none', borderBottom:`2px solid ${tab===n.key?GOLD:'transparent'}`, padding:'0.75rem 1rem', fontSize:'0.68rem', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:tab===n.key?BLACK:'#888', cursor:'pointer', whiteSpace:'nowrap' }}>
            {n.label}
          </button>
        ))}
      </nav>

      <div style={{ padding:'1.5rem 2rem', maxWidth:1400, margin:'0 auto' }}>

        {tab === 'overview' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
              {[
                { label:'Personnes en magasin', value:kpi.occupancy||14, sub:'+3 vs hier', color:GOLD },
                { label:'Alertes critiques',    value:criticalCount,     sub:'B3 · A2',   color:'#C0392B' },
                { label:'Cameras actives',      value:`${totalOnline}/3`,sub:'DeepStream', color:'#888' },
                { label:'Latence IA',           value:'118ms',           sub:'H200 optimal',color:'#1D6A45' },
              ].map(k => (
                <div key={k.label} style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderTop:`2px solid ${k.color}`, borderRadius:2, padding:'1rem 1.25rem' }}>
                  <div style={{ fontSize:'0.55rem', letterSpacing:'1.2px', textTransform:'uppercase', color:'#888', marginBottom:6 }}>{k.label}</div>
                  <div style={{ fontSize:'2rem', fontWeight:900, color:BLACK, lineHeight:1 }}>{k.value}</div>
                  <div style={{ fontSize:'0.6rem', color:'#aaa', marginTop:4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
              <div style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem' }}>
                <SectionTitle>Stocks critiques</SectionTitle>
                {STOCK_DATA.map(s => {
                  const c = s.status==='CRITIQUE'?'#C0392B':s.status==='BAS'?'#8B6000':'#1D6A45'
                  return (
                    <div key={s.sku} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'0.5px solid #F0EDE5' }}>
                      <span style={{ fontSize:'0.7rem', color:BLACK, flex:1 }}>{s.sku} · {s.zone}</span>
                      <div style={{ flex:2, height:3, background:'#F0EDE5' }}>
                        <div style={{ height:3, width:`${Math.round(s.count/s.threshold*100)}%`, background:c, transition:'width .4s' }} />
                      </div>
                      <span style={{ fontSize:'0.7rem', fontWeight:700, color:c, minWidth:20, textAlign:'right' }}>{s.count}</span>
                      <span style={{ fontSize:'0.55rem', padding:'2px 7px', background:`rgba(${s.status==='CRITIQUE'?'192,57,43':s.status==='BAS'?'139,96,0':'29,106,69'},.1)`, color:c, fontWeight:700, letterSpacing:'.5px' }}>{s.status}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem' }}>
                <SectionTitle>Alertes recentes</SectionTitle>
                {[
                  { type:'RUPTURE', msg:'Eau 500ml · B3 — 3 unites · seuil 8',       t:'04:07', color:'#C0392B' },
                  { type:'BAS',     msg:'Pain baguette · A2 — 2 unites · seuil 5',    t:'03:52', color:'#8B6000' },
                  { type:'BAS',     msg:'Yaourt nature · C1 — 4 unites · seuil 10',   t:'03:41', color:'#8B6000' },
                  { type:'OK',      msg:'Pipeline DeepStream · actif · 118ms',         t:'02:00', color:'#1D6A45' },
                ].map((a,i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'0.5px solid #F0EDE5' }}>
                    <div style={{ width:2, background:a.color, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'0.7rem', fontWeight:700, color:BLACK }}>{a.type}</div>
                      <div style={{ fontSize:'0.6rem', color:'#aaa' }}>{a.msg}</div>
                    </div>
                    <span style={{ fontSize:'0.6rem', color:'#ccc' }}>{a.t}</span>
                  </div>
                ))}
                <div style={{ marginTop:'1rem', background:BLACK, borderRadius:1, padding:'0.9rem', borderLeft:`2px solid ${GOLD}` }}>
                  <div style={{ fontSize:'0.55rem', color:GOLD, letterSpacing:'1px', fontWeight:700, marginBottom:4 }}>GEMINI · RESUME</div>
                  <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,.7)', lineHeight:1.6, margin:0 }}>
                    3 ruptures critiques detectees. Frequentation : 14 personnes, +21% vs hier. Reappro recommande depuis reserve R-12.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem', marginBottom:'1rem' }}>
              <SectionTitle>Frequentation · heatmap 06h-22h</SectionTitle>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(24,1fr)', gap:3 }}>
                {HEATMAP.map((v,i) => {
                  const p = v/33
                  const bg = p>0.6?`rgba(201,162,39,${0.2+p*0.7})`:p>0.3?`rgba(10,10,10,${0.06+p*0.2})`:`rgba(10,10,10,0.04)`
                  return <div key={i} style={{ height:28, background:bg, borderRadius:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.45rem', color:p>0.5?'#7A5E10':'rgba(10,10,10,.35)', fontWeight:700 }}>{v}</div>
                })}
              </div>
            </div>

            <div style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem' }}>
              <SectionTitle>Timeline detections</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={events} margin={{ top:0, right:10, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE5" />
                  <XAxis dataKey="ts" tick={{ fontSize:9, fill:'#aaa' }} tickFormatter={v => v.slice(11,19)} />
                  <YAxis tick={{ fill:'#aaa', fontSize:9 }} />
                  <Tooltip contentStyle={{ background:BLACK, border:`1px solid ${GOLD}`, borderRadius:2, fontSize:11, color:'#fff' }} labelStyle={{ color:GOLD, fontSize:10 }} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Line type="monotone" dataKey="entry"     name="Entry"     stroke={GOLD}  dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="exit"      name="Exit"      stroke={BLACK} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="occupancy" name="Occupancy" stroke="#bbb"  dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'cameras' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1.25rem', marginBottom:'1.5rem' }}>
              {cams.map(cam => <CameraCard key={cam.id} cam={cam} tick={tick} />)}
            </div>
            <div style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem' }}>
              <SectionTitle>Detections actives · DeepStream · TensorRT</SectionTitle>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.7rem' }}>
                <thead>
                  <tr>{['Camera','Objet','Confiance','Zone','Action','Temps'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #E8E6DE', fontSize:'0.55rem', letterSpacing:'1px', textTransform:'uppercase', color:'#888', fontWeight:700 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom:'0.5px solid #F0EDE5' }}><td style={{ padding:'9px 8px' }}>CAM-01</td><td>Personne</td><td style={{ color:'#1D6A45', fontWeight:700 }}>97%</td><td>Entree</td><td>Entree magasin</td><td style={{ fontFamily:'monospace', fontSize:'0.6rem' }}>04:07:31</td></tr>
                  <tr style={{ borderBottom:'0.5px solid #F0EDE5' }}><td style={{ padding:'9px 8px' }}>CAM-02</td><td>Rayon vide</td><td style={{ color:'#C0392B', fontWeight:700 }}>94%</td><td>B3 etagere 2</td><td>Alerte rupture</td><td style={{ fontFamily:'monospace', fontSize:'0.6rem' }}>04:07:22</td></tr>
                  <tr><td style={{ padding:'9px 8px' }}>CAM-01</td><td>Personne</td><td style={{ color:'#1D6A45', fontWeight:700 }}>91%</td><td>Zone centrale</td><td>Suivi actif</td><td style={{ fontFamily:'monospace', fontSize:'0.6rem' }}>04:07:18</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'stock' && (
          <div style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem' }}>
            <SectionTitle>Tableau SKU · Gestion dynamique · Vision IA</SectionTitle>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.7rem' }}>
              <thead>
                <tr>{['Produit','Zone','Stock','Seuil','IA conf.','Detecte','Statut','Action'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #E8E6DE', fontSize:'0.55rem', letterSpacing:'1px', textTransform:'uppercase', color:'#888', fontWeight:700 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {[
                  { sku:'Eau 500ml',     zone:'B3',  count:3,  threshold:8,  conf:94, ts:'04:07:22', status:'CRITIQUE' },
                  { sku:'Pain baguette', zone:'A2',  count:2,  threshold:5,  conf:89, ts:'03:52:10', status:'BAS' },
                  { sku:'Yaourt nature', zone:'C1',  count:4,  threshold:10, conf:91, ts:'03:41:05', status:'BAS' },
                  { sku:'Jus orange 1L', zone:'D2',  count:12, threshold:6,  conf:96, ts:'04:05:50', status:'OK' },
                  { sku:'Chips nature',  zone:'E1',  count:18, threshold:5,  conf:92, ts:'04:06:30', status:'OK' },
                  { sku:'Lait entier 1L',zone:'B1',  count:9,  threshold:8,  conf:97, ts:'04:07:01', status:'OK' },
                ].map(s => {
                  const c = s.status==='CRITIQUE'?'#C0392B':s.status==='BAS'?'#8B6000':'#1D6A45'
                  return (
                    <tr key={s.sku} style={{ borderBottom:'0.5px solid #F0EDE5' }}>
                      <td style={{ padding:'9px 8px' }}>{s.sku}</td>
                      <td>{s.zone}</td>
                      <td style={{ color:c, fontWeight:700 }}>{s.count}</td>
                      <td>{s.threshold}</td>
                      <td>{s.conf}%</td>
                      <td style={{ fontFamily:'monospace', fontSize:'0.6rem' }}>{s.ts}</td>
                      <td><span style={{ fontSize:'0.55rem', padding:'2px 8px', background:`rgba(${s.status==='CRITIQUE'?'192,57,43':s.status==='BAS'?'139,96,0':'29,106,69'},.1)`, color:c, fontWeight:700, letterSpacing:'.5px' }}>{s.status}</span></td>
                      <td>{s.status !== 'OK' && <button onClick={() => quickAsk(`Commander ${s.sku} rayon ${s.zone}`)} style={{ background:'none', border:`1px solid ${GOLD}`, color:GOLD, fontSize:'0.55rem', padding:'2px 8px', cursor:'pointer', letterSpacing:'.5px', fontWeight:700 }}>Commander</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gemini' && (
          <div style={{ background:BLACK, border:`1px solid rgba(201,162,39,.2)`, borderRadius:2, padding:'1.5rem', display:'flex', flexDirection:'column', gap:0, minHeight:500 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'1rem' }}>
              <div style={{ width:38, height:38, background:GOLD, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', fontWeight:900, color:BLACK, flexShrink:0 }}>G</div>
              <div>
                <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'1px', color:'#F7F5EF' }}>Gemini · Assistant VIIZE</div>
                <div style={{ fontSize:'0.55rem', color:'rgba(201,162,39,.6)', letterSpacing:'.5px' }}>Vision · Voix · Analyse · DeepStream integre</div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, fontSize:'0.55rem', color:'rgba(201,162,39,.5)' }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#4CAF50' }} /> Actif
              </div>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:'0.75rem', flexWrap:'wrap' }}>
              {['Rapport frequentation','Bon de commande','Analyser cameras','Previsions weekend'].map(q => (
                <button key={q} onClick={() => quickAsk(q)} style={{ fontSize:'0.55rem', padding:'3px 10px', border:'1px solid rgba(201,162,39,.2)', color:'rgba(201,162,39,.6)', background:'none', cursor:'pointer', letterSpacing:'.5px' }}>
                  { q } ↗
                </button>
              ))}
            </div>
            <div style={{ flex:1, minHeight:300, display:'flex', flexDirection:'column', gap:8, marginBottom:'0.75rem', overflowY:'auto', maxHeight:340 }}>
              {gemMsgs.map((m,i) => (
                <div key={i} style={{ background:m.role==='ai'?'rgba(247,245,239,.04)':'rgba(201,162,39,.08)', borderRadius:1, padding:'10px 12px', borderLeft:m.role==='ai'?`2px solid ${GOLD}`:'none', borderRight:m.role==='user'?'2px solid rgba(201,162,39,.4)':'none', alignSelf:m.role==='user'?'flex-end':'flex-start', maxWidth:'90%' }}>
                  <p style={{ fontSize:'0.72rem', color:m.role==='ai'?'rgba(247,245,239,.75)':'rgba(247,245,239,.6)', lineHeight:1.6, margin:0, textAlign:m.role==='user'?'right':'left' }}>{m.text}</p>
                </div>
              ))}
              {gemLoading && (
                <div style={{ background:'rgba(247,245,239,.04)', borderRadius:1, padding:'10px 12px', borderLeft:`2px solid ${GOLD}`, alignSelf:'flex-start' }}>
                  <p style={{ fontSize:'0.72rem', color:GOLD, margin:0, fontStyle:'italic' }}>Gemini analyse...</p>
                </div>
              )}
              <div ref={gemEnd} />
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input value={gemInput} onChange={e => setGemInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendGemini()} placeholder="Posez une question, demandez un rapport..." style={{ flex:1, background:'rgba(247,245,239,.04)', border:'1px solid rgba(201,162,39,.15)', borderRadius:1, padding:'9px 12px', fontSize:'0.72rem', color:'#F7F5EF', fontFamily:'system-ui,sans-serif', outline:'none' }} />
              <button onClick={sendGemini} style={{ background:GOLD, color:BLACK, border:'none', borderRadius:1, padding:'9px 18px', fontSize:'0.65rem', fontWeight:700, letterSpacing:'1px', cursor:'pointer', textTransform:'uppercase' }}>Envoyer</button>
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            {[
              { title:'Rapport hebdomadaire', desc:'Frequentation, ruptures, ventes estimees, heatmap clients, recommandations IA. PDF automatique chaque lundi 06h.', badge:'Gemini', action:'rapport' },
              { title:'Previsions 7 jours',   desc:'Anticipation ruptures basee sur historique et saisonnalite. Commandes automatiques suggerees.', badge:'Gemini', action:'prevision' },
              { title:'Bon de commande auto', desc:'Genere depuis les detections DeepStream. Eau 500ml, Pain baguette, Yaourt — quantites calculees par Gemini.', badge:'3 urgents', action:'commande' },
              { title:'Comportement client',  desc:'Flux de circulation, zones chaudes, temps de presence par rayon, heures de pointe. Source : cameras DeepStream.', badge:'Vision IA', action:'camera' },
            ].map(r => (
              <div key={r.title} onClick={() => quickAsk(r.title)} style={{ background:'#fff', border:'0.5px solid #E8E6DE', borderRadius:2, padding:'1.25rem', cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                  <span style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:BLACK }}>{r.title}</span>
                  <span style={{ fontSize:'0.55rem', padding:'2px 8px', background:'rgba(201,162,39,.12)', color:'#7A5E10', border:'1px solid rgba(201,162,39,.25)', fontWeight:700, letterSpacing:'.5px' }}>{r.badge}</span>
                </div>
                <p style={{ fontSize:'0.68rem', color:'#888', lineHeight:1.6, margin:0 }}>{r.desc}</p>
              </div>
            ))}
          </div>
        )}

        <footer style={{ marginTop:'2rem', paddingTop:'0.75rem', borderTop:'1px solid #F0EDE5', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', gap:'1.5rem' }}>
            {[['GPU','NVIDIA H200 NVLink'],['ENGINE','DeepStream 9.0 · Nebius'],['MODEL','PeopleNet · YOLO'],['REGION','iad1']].map(([l,v]) => (
              <div key={l} style={{ display:'flex', gap:4, alignItems:'center' }}>
                <span style={{ fontSize:'0.52rem', color:GOLD, fontWeight:700, letterSpacing:'.1em' }}>{l}</span>
                <span style={{ fontSize:'0.52rem', color:'#aaa' }}>{v}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize:'0.52rem', color:'#ccc', letterSpacing:'.05em' }}>2026 Buttertech Inc. · VIIZE</span>
        </footer>

      </div>
    </main>
  )
}
