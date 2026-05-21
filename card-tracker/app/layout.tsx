import type { Metadata, Viewport } from 'next'
import './globals.css'
import Script from 'next/script'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Card Tracker',
  description: 'Track your card inventory, grading, and profits',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </head>
      <body className="bg-zinc-950 text-zinc-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
