'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, SalePlatform } from '@/types/card'
import { totalCost, formatCurrency } from '@/lib/calculations'

const PLATFORMS: SalePlatform[] = ['eBay', 'PWCC', 'Whatnot', 'Private', 'Instagram', 'Facebook', 'Other']
const today = () => new Date().toISOString().split('T')[0]

interface Props {
  card: Card
  psaCost: number
  onClose: () => void
  onSaved: () => void
}

export default function SellModal({ card, psaCost, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sale_price: '',
    platform: '' as SalePlatform | '',
    sale_fees: '',
    sale_shipping: '',
    sold_date: today(),
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const salePrice = parseFloat(form.sale_price) || 0
  const fees = parseFloat(form.sale_fees) || 0
  const shipping = parseFloat(form.sale_shipping) || 0
  const netSale = salePrice - fees - shipping
  const cost = totalCost(card, psaCost)
  const profitPreview = netSale - cost

  async function handleSell(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sale_price || !form.sold_date) return
    setSaving(true)

    const { error } = await supabase.from('cards').update({
      sale_price: salePrice,
      sale_fees: fees || 0,
      sale_shipping: shipping || 0,
      platform: form.platform || null,
      sold_date: form.sold_date,
      status: 'sold',
    }).eq('id', card.id)

    setSaving(false)
    if (!error) {
      onSaved()
      onClose()
    } else {
      alert('Error: ' + error.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Mark as Sold</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <div className="font-semibold text-gray-900">{card.player}</div>
          {card.year && <span className="mr-2">{card.year}</span>}
          {card.set_name && <span>{card.set_name}</span>}
          <div className="mt-1">Cost basis: <span className="font-semibold">{formatCurrency(cost)}</span></div>
        </div>

        <form onSubmit={handleSell} className="space-y-3">
          <div>
            <label className="label">Sale Price *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input className="input pl-7" type="number" inputMode="decimal" placeholder="0.00"
                min="0" step="0.01" value={form.sale_price}
                onChange={e => set('sale_price', e.target.value)} required autoFocus />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Platform</label>
              <select className="input" value={form.platform} onChange={e => set('platform', e.target.value)}>
                <option value="">Select...</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date Sold *</label>
              <input className="input" type="date" value={form.sold_date}
                onChange={e => set('sold_date', e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fees</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input className="input pl-7" type="number" inputMode="decimal" placeholder="0.00"
                  min="0" step="0.01" value={form.sale_fees}
                  onChange={e => set('sale_fees', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Shipping</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input className="input pl-7" type="number" inputMode="decimal" placeholder="0.00"
                  min="0" step="0.01" value={form.sale_shipping}
                  onChange={e => set('sale_shipping', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Profit preview */}
          {salePrice > 0 && (
            <div className={`rounded-lg p-3 text-center font-semibold ${
              profitPreview >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {profitPreview >= 0 ? '↑' : '↓'} Profit: {formatCurrency(profitPreview)}
              <span className="ml-2 text-sm font-normal opacity-75">
                ({((profitPreview / cost) * 100).toFixed(1)}% ROI)
              </span>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-success w-full py-3 text-base">
            {saving ? 'Saving...' : '✓ Confirm Sale'}
          </button>
        </form>
      </div>
    </div>
  )
}
