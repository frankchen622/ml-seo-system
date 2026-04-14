import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ML SEO System',
  description: 'Machine Learning powered SEO content system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
