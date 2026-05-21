'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success, AppShell will detect the new session and redirect to /
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <form onSubmit={handleLogin} className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-black text-lg shadow-lg"
            style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
          >
            TM
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Card Tracker</h1>
          <p className="text-xs text-zinc-500 mt-1">Sign in to continue</p>
        </div>

        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-900 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
