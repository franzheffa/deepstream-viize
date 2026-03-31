export const metadata = { title: 'Viize — People Analytics' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#ffffff', color: '#0A0A0A', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
