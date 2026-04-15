export const metadata = {
  title: 'VIIZE — Enterprise Retail Intelligence',
  description: 'Buttertech DeepStream VIIZE for supermarket, hypermarket, parking, logistics, stock and mobile LiDAR orchestration.',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#ffffff', color: '#0A0A0A', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
