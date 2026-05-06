'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'
import { totalCost, formatCurrency } from '@/lib/calculations'
import GradeModal from '@/components/GradeModal'
import { differenceInDays } from 'date-fns'

export default function GradingPage() {
  const [atPSA, setAtPSA] = useState<Card[]>([])
  const [graded, setGraded] = useState<Card[]>([])
  const [psaCost, setPsaCost] = useState(25)
  const [loading, setLoading] = useState(true)
  const [gradeCard, setGradeCard] = useState<Card | null>(null)

  const loadData = useCallback(async () => {
    const [{ data: allCards }, { data: settings }] = await Promise.all([
      supabase.from('cards').select('*')
        .in('status', ['at_grader', 'graded'])
        .order('submitted_date', { ascending: true }),
      supabase.from('settings').select('*').single(),
    ])
    setAtPSA(allCards?.filter(c => c.status === 'at_grader') ?? [])
    setGraded(allCards?.filter(c => c.status === 'graded') ?? [])
    if (settings) setPsaCost(settings.psa_cost)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function daysOut(card: Card): number {
    if (!card.submitted_date) return 0
    return differenceInDays(new Date(), new Date(card.submitted_date))
  }

  const totalAtPSAValue = atPSA.reduce((sum, c) => sum + totalCost(c, psaCost), 0)

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <h1 className="page-title mb-4">PSA Grading Pipeline</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">{atPSA.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">At PSA</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">{graded.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Graded</div>
        </div>
        <div className="card text-center">
          <div className="text-lg font-bold text-orange-600">{formatCurrency(totalAtPSAValue)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Capital Out</div>
        </div>
      </div>

      {/* At PSA */}
      <div className="mb-6">
        <h2 className="section-header mb-3">At PSA ({atPSA.length})</h2>
        {atPSA.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">No cards currently at PSA</div>
        ) : (
          <div className="space-y-2">
            {atPSA.map(card => (
              <div key={card.id} className="card border-l-4 border-purple-400">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900">{card.player}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {[card.year, card.set_name, card.variant].filter(Boolean).join(' · ')}
                    </div>
                    <div className="flex gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                      <span>Cost in: <strong className="text-gray-700">{formatCurrency(totalCost(card, psaCost))}</strong></span>
                      {card.submitted_date && (
                        <span className={`font-medium ${daysOut(card) > 45 ? 'text-red-500' : daysOut(card) > 30 ? 'text-amber-500' : 'text-gray-500'}`}>
                          {daysOut(card)} days out
                        </span>
                      )}
                      {card.submitted_date && <span>Submitted: {card.submitted_date}</span>}
                    </div>
                  </div>
                  <button onClick={() => setGradeCard(card)}
                    className="btn-secondary text-xs px-3 py-2 border-green-300 text-green-700 hover:bg-green-50 shrink-0">
                    Got Grade ✓
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Graded, not yet sold */}
      {graded.length > 0 && (
        <div>
          <h2 className="section-header mb-3">Graded — Ready to Sell ({graded.length})</h2>
          <div className="space-y-2">
            {graded.map(card => (
              <div key={card.id} className="card border-l-4 border-green-400">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{card.player}</span>
                      {card.psa_grade && (
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                          parseFloat(card.psa_grade) >= 9 ? 'bg-green-100 text-green-800' :
                          parseFloat(card.psa_grade) >= 7 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          PSA {card.psa_grade}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {[card.year, card.set_name, card.variant].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Cost in: <strong className="text-gray-700">{formatCurrency(totalCost(card, psaCost))}</strong>
                      {card.returned_date && <span className="ml-3">Returned: {card.returned_date}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gradeCard && (
        <GradeModal card={gradeCard} onClose={() => setGradeCard(null)} onSaved={loadData} />
      )}
    </div>
  )
}
