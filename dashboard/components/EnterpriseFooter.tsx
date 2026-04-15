const GOLD = '#C9A227'
const BLACK = '#0A0A0A'

export default function EnterpriseFooter() {
  return (
    <footer
      style={{
        marginTop: '2rem',
        background: BLACK,
        color: 'rgba(255,255,255,.82)',
        borderTop: `3px solid ${GOLD}`,
        borderRadius: 2,
        padding: '1.15rem 1.35rem',
        display: 'grid',
        gap: '0.85rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.62rem', letterSpacing: '.22em', textTransform: 'uppercase', color: GOLD, fontWeight: 800 }}>
            Buttertech · DeepStream VIIZE
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', marginTop: 4 }}>
            Retail intelligence, video operations and store orchestration
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['🏬 Supermarche', '🎥 Vision IA', '📦 Stocks', '🅿️ Parking', '📱 iPhone LiDAR', '🧠 Gemini'].map((item) => (
            <span
              key={item}
              style={{
                border: `1px solid rgba(201,162,39,.24)`,
                color: GOLD,
                fontSize: '0.58rem',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                fontWeight: 800,
                padding: '0.32rem 0.6rem',
                borderRadius: 999,
                background: 'rgba(201,162,39,.08)',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.85rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          borderTop: '1px solid rgba(255,255,255,.08)',
          paddingTop: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { src: '/partners/nvidia-inception-badge-black.svg', alt: 'NVIDIA Inception Program', width: 122 },
            { src: '/partners/gemini-enterprise.png', alt: 'Gemini Enterprise', width: 180 },
            { src: '/partners/google-maps-platform.png', alt: 'Google Maps Platform', width: 150 },
          ].map((item) => (
            <div key={item.alt} style={{ background: '#fff', borderRadius: 2, padding: '0.4rem 0.6rem', border: '1px solid rgba(201,162,39,.12)' }}>
              <img src={item.src} alt={item.alt} style={{ width: item.width, height: 'auto', display: 'block' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            ['GPU', 'NVIDIA DeepStream + TensorRT'],
            ['VOICE', 'Gemini copilote operations'],
            ['SECURITY', 'Retail privacy controls'],
            ['DEPLOY', 'Vercel + edge onboarding'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.56rem', color: GOLD, fontWeight: 800, letterSpacing: '.12em' }}>{label}</span>
              <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,.58)' }}>{value}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,.45)', letterSpacing: '.08em' }}>
          2026 Buttertech Inc. · VIIZE enterprise retail stack
        </span>
      </div>
    </footer>
  )
}
