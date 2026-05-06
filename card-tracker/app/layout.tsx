import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

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
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Desktop top bar */}
          <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🃏</span>
              <span className="text-xl font-bold text-blue-600">Card Tracker</span>
            </div>
            <Navigation layout="horizontal" />
          </header>

          {/* Page content */}
          <main className="flex-1 pb-20 md:pb-0">
            <div className="max-w-5xl mx-auto px-4 py-4 md:px-6 md:py-6">
              {children}
            </div>
          </main>

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            <Navigation layout="mobile" />
          </nav>
        </div>
      </body>
    </html>
  )
}
