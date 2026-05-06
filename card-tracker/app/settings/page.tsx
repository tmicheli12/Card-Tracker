'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [psaCost, setPsaCost] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      if (data) setPsaCost(String(data.psa_cost))
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!psaCost) return
    setSaving(true)
    await supabase.from('settings').update({ psa_cost: parseFloat(psaCost) }).eq('id', 1)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div className="max-w-md mx-auto">
      <h1 className="page-title mb-6">Settings</h1>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800">PSA Grading</h2>
        <p className="text-sm text-gray-500">
          Set your flat PSA grading cost per card. This is added to the cost basis of every card marked as a grading submission.
        </p>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">PSA Cost Per Card</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input className="input pl-7" type="number" inputMode="decimal"
                placeholder="25.00" min="0" step="0.01"
                value={psaCost} onChange={e => setPsaCost(e.target.value)} required />
            </div>
          </div>
          {saved && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-green-800 text-sm font-medium text-center">
              ✓ Saved
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="mt-6 card space-y-2">
        <h2 className="font-semibold text-gray-800">About</h2>
        <p className="text-sm text-gray-500">Card Tracker — built for tracking card flips and PSA grading submissions.</p>
        <p className="text-sm text-gray-400">All data is stored securely in your Supabase database.</p>
      </div>
    </div>
  )
}
