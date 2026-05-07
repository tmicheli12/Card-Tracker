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
      <body className="bg-slate-50">
        <div className="min-h-screen flex flex-col">
          {/* Desktop header */}
          <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm">
                🃏
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">Card Tracker</span>
            </div>
            <Navigation layout="horizontal" />
          </header>

          {/* Page content */}
          <main className="flex-1 pb-20 md:pb-8">
            <div className="max-w-5xl mx-auto px-4 py-5 md:px-6 md:py-6">
              {children}
            </div>
          </main>

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 z-50 safe-area-inset-bottom">
            <Navigation layout="mobile" />
          </nav>
        </div>
      </body>
    </html>
  )
}
