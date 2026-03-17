export const metadata = { title: 'Viize — People Analytics' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
