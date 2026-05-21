'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navigation from './Navigation'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthed(!!session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // Redirect based on auth state + current path
  useEffect(() => {
    if (loading) return
    if (!isAuthed && pathname !== '/login') router.replace('/login')
    if (isAuthed && pathname === '/login') router.replace('/')
  }, [loading, isAuthed, pathname, router])

  // Initial auth check spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-10 h-10 rounded-2xl bg-blue-900/50 flex items-center justify-center text-xl animate-pulse">🃏</div>
      </div>
    )
  }

  // While redirecting, render nothing to avoid flash
  if (!isAuthed && pathname !== '/login') return null
  if (isAuthed && pathname === '/login') return null

  // Bare layout for login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Full app layout for authenticated routes
  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop header */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm"
            style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
          >
            TM
          </div>
          <span className="text-lg font-bold text-zinc-100 tracking-tight">Card Tracker</span>
        </div>
        <Navigation layout="horizontal" />
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-5 md:px-6 md:py-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 z-50 safe-area-inset-bottom">
        <Navigation layout="mobile" />
      </nav>
    </div>
  )
}
