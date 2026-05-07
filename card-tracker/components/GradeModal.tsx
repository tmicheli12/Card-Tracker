'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'

const PSA_GRADES = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1', 'Auth']
const today = () => new Date().toISOString().split('T')[0]

interface Props {
  card: Card
  onClose: () => void
  onSaved: () => void
}

export default function GradeModal({ card, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [grade, setGrade] = useState('')
  const [returnedDate, setReturnedDate] = useState(today())

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!grade) return
    setSaving(true)

    const { error } = await supabase.from('cards').update({
      psa_grade: grade,
      returned_date: returnedDate,
      status: 'graded',
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
      <div className="bg-zinc-900 w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-5 space-y-4 border border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100">Enter PSA Grade</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none">&times;</button>
        </div>

        <div className="text-sm text-zinc-400 bg-zinc-800 rounded-lg p-3">
          <div className="font-semibold text-zinc-100">{card.player}</div>
          {card.year && <span>{card.year} </span>}
          {card.set_name && <span>{card.set_name}</span>}
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">PSA Grade *</label>
            <select className="input text-lg font-bold" value={grade} onChange={e => setGrade(e.target.value)} required>
              <option value="">Select grade...</option>
              {PSA_GRADES.map(g => (
                <option key={g} value={g}>
                  {g === 'Auth' ? 'Auth (Authentic)' : `PSA ${g}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Date Received</label>
            <input className="input" type="date" value={returnedDate}
              onChange={e => setReturnedDate(e.target.value)} />
          </div>

          {grade && grade !== 'Auth' && (
            <div className={`rounded-lg p-3 text-center font-bold text-2xl ${
              parseFloat(grade) >= 9 ? 'bg-emerald-900/40 text-emerald-400' :
              parseFloat(grade) >= 7 ? 'bg-yellow-900/40 text-yellow-400' :
              'bg-red-900/40 text-red-400'
            }`}>
              PSA {grade}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : '✓ Save Grade'}
          </button>
        </form>
      </div>
    </div>
  )
}
