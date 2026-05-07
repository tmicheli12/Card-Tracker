'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sport, Source } from '@/types/card'

const SPORTS: Sport[] = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Other']
const SOURCES: Source[] = ['Card Show', 'eBay', 'LCS', 'Private', 'Online', 'Other']

export default function EditCardPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [showOptional, setShowOptional] = useState(false)

  const [form, setForm] = useState({
    player: '',
    year: '',
    set_name: '',
    card_number: '',
    variant: '',
    sport: 'Baseball' as Sport,
    purchase_price: '',
    purchase_fees: '',
    purchase_date: '',
    source: '' as Source | '',
    notes: '',
    batch_name: '',
  })

  useEffect(() => {
    supabase.from('cards').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { setNotFound(true); setLoading(false); return }
      setForm({
        player: data.player ?? '',
        year: data.year ? String(data.year) : '',
        set_name: data.set_name ?? '',
        card_number: data.card_number ?? '',
        variant: data.variant ?? '',
        sport: data.sport,
        purchase_price: String(data.purchase_price),
        purchase_fees: data.purchase_fees ? String(data.purchase_fees) : '',
        purchase_date: data.purchase_date,
        source: data.source ?? '',
        notes: data.notes ?? '',
        batch_name: (data as any).batch_name ?? '',
      })
      if (data.variant || data.purchase_fees || data.notes || (data as any).batch_name) setShowOptional(true)
      setLoading(false)
    })
  }, [id])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.player || !form.purchase_price || !form.purchase_date) return
    setSaving(true)

    const { error } = await supabase.from('cards').update({
      player: form.player.trim(),
      year: form.year ? parseInt(form.year) : null,
      set_name: form.set_name.trim() || null,
      card_number: form.card_number.trim() || null,
      variant: form.variant.trim() || null,
      sport: form.sport,
      purchase_price: parseFloat(form.purchase_price),
      purchase_fees: form.purchase_fees ? parseFloat(form.purchase_fees) : 0,
      purchase_date: form.purchase_date,
      source: form.source || null,
      notes: form.notes.trim() || null,
      batch_name: form.batch_name.trim() || null,
    }).eq('id', id)

    setSaving(false)
    if (!error) {
      router.push('/inventory')
    } else {
      alert('Error saving card: ' + error.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-zinc-500">Loading...</div>
  if (notFound) return <div className="text-center py-12 text-zinc-500">Card not found.</div>

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Edit Card</h1>
        <button onClick={() => router.push('/inventory')} className="btn-secondary text-xs px-3 py-2">
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">

        {/* Player */}
        <div>
          <label className="label">Player / Card Name *</label>
          <input className="input" type="text" placeholder="e.g. Mike Trout" value={form.player}
            onChange={e => set('player', e.target.value)} required autoComplete="off" />
        </div>

        {/* Year + Sport row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Year</label>
            <input className="input" type="number" placeholder="2024" min="1900" max="2099"
              value={form.year} onChange={e => set('year', e.target.value)} />
          </div>
          <div>
            <label className="label">Sport *</label>
            <select className="input" value={form.sport} onChange={e => set('sport', e.target.value as Sport)}>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Set + Card # row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Set Name</label>
            <input className="input" type="text" placeholder="Topps Chrome" value={form.set_name}
              onChange={e => set('set_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Card #</label>
            <input className="input" type="text" placeholder="#150" value={form.card_number}
              onChange={e => set('card_number', e.target.value)} />
          </div>
        </div>

        {/* Optional fields */}
        {showOptional && (
          <>
            <div>
              <label className="label">Variant / Parallel</label>
              <input className="input" type="text" placeholder="Refractor, Auto, /99..." value={form.variant}
                onChange={e => set('variant', e.target.value)} />
            </div>
            <div>
              <label className="label">Batch Name</label>
              <input className="input" type="text" placeholder="May 2025 Submission" value={form.batch_name}
                onChange={e => set('batch_name', e.target.value)} />
            </div>
          </>
        )}

        {/* Purchase Price */}
        <div>
          <label className="label">Purchase Price *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
            <input className="input pl-7" type="number" inputMode="decimal" placeholder="0.00"
              min="0" step="0.01" value={form.purchase_price}
              onChange={e => set('purchase_price', e.target.value)} required />
          </div>
        </div>

        {/* Purchase fees (optional toggle) */}
        {showOptional && (
          <div>
            <label className="label">Purchase Fees / Shipping</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
              <input className="input pl-7" type="number" inputMode="decimal" placeholder="0.00"
                min="0" step="0.01" value={form.purchase_fees}
                onChange={e => set('purchase_fees', e.target.value)} />
            </div>
          </div>
        )}

        {/* Date + Source */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date Bought *</label>
            <input className="input" type="date" value={form.purchase_date}
              onChange={e => set('purchase_date', e.target.value)} required />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={form.source} onChange={e => set('source', e.target.value as Source | '')}>
              <option value="">Select...</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Notes (optional toggle) */}
        {showOptional && (
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} placeholder="Optional notes..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        )}

        {/* Show/hide optional fields */}
        <button type="button" onClick={() => setShowOptional(!showOptional)}
          className="text-sm text-blue-400 font-medium hover:underline">
          {showOptional ? '▲ Hide optional fields' : '▼ Show optional fields (variant, fees, batch, notes)'}
        </button>

        <button type="submit" disabled={saving} className="btn-primary mt-2">
          {saving ? 'Saving...' : '✓ Save Changes'}
        </button>
      </form>
    </div>
  )
}
