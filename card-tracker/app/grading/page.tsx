'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'
import { totalCost, netSale, formatCurrency } from '@/lib/calculations'
import GradeModal from '@/components/GradeModal'
import SellModal from '@/components/SellModal'
import { differenceInDays } from 'date-fns'

export default function GradingPage() {
  const [atPSA, setAtPSA] = useState<Card[]>([])
  const [graded, setGraded] = useState<Card[]>([])
  const [soldGraded, setSoldGraded] = useState<Card[]>([])
  const [psaCost, setPsaCost] = useState(25)
  const [loading, setLoading] = useState(true)
  const [gradeCard, setGradeCard] = useState<Card | null>(null)
  const [sellCard, setSellCard] = useState<Card | null>(null)

  const loadData = useCallback(async () => {
    const [{ data: allCards }, { data: settings }] = await Promise.all([
      supabase.from('cards').select('*'),
      supabase.from('settings').select('*').single(),
    ])
    const all = allCards ?? []
    setAtPSA(all.filter(c => c.status === 'at_grader').sort((a: Card, b: Card) =>
      (a.submitted_date ?? '').localeCompare(b.submitted_date ?? '')))
    setGraded(all.filter(c => c.status === 'graded'))
    setSoldGraded(all.filter(c => c.status === 'sold' && c.psa_grade && c.sale_price))
    if (settings) setPsaCost(settings.psa_cost)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function daysOut(card: Card): number {
    if (!card.submitted_date) return 0
    return differenceInDays(new Date(), new Date(card.submitted_date))
  }

  const totalAtPSAValue = atPSA.reduce((sum, c) => sum + totalCost(c, psaCost), 0)

  // Grading success rate — all cards that have ever been graded (graded + sold-graded)
  const allGraded = [...graded, ...soldGraded]
  const highGrades = allGraded.filter(c => c.psa_grade && parseFloat(c.psa_grade) >= 9)
  const nineOrTen  = allGraded.filter(c => c.psa_grade && parseFloat(c.psa_grade) >= 9)
  const tens       = allGraded.filter(c => c.psa_grade === '10')
  const successRate = allGraded.length ? (highGrades.length / allGraded.length) * 100 : 0

  // Grade bump — for sold graded cards: what did grading add?
  // gross bump = net sale - purchase price (ignoring PSA fee, to see raw card appreciation)
  // net bump   = net sale - total cost (including PSA fee)
  const gradeBumps = soldGraded.map(c => ({
    card: c,
    grossBump: netSale(c) - (c.purchase_price + (c.purchase_fees ?? 0)),
    netBump:   netSale(c) - totalCost(c, psaCost),
  }))
  const avgGrossBump = gradeBumps.length ? gradeBumps.reduce((s, g) => s + g.grossBump, 0) / gradeBumps.length : null
  const avgNetBump   = gradeBumps.length ? gradeBumps.reduce((s, g) => s + g.netBump, 0) / gradeBumps.length : null

  // Group at-PSA cards by batch_name
  const batches: Record<string, Card[]> = {}
  const ungrouped: Card[] = []
  atPSA.forEach(c => {
    const batch = (c as any).batch_name
    if (batch) {
      batches[batch] = batches[batch] ?? []
      batches[batch].push(c)
    } else {
      ungrouped.push(c)
    }
  })

  if (loading) return <div className="text-center py-12 text-zinc-500">Loading...</div>

  return (
    <div>
      <h1 className="page-title mb-4">PSA Grading Pipeline</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-violet-400">{atPSA.length}</div>
          <div className="text-xs text-zinc-500 mt-0.5">At PSA</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-emerald-400">{graded.length}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Graded</div>
        </div>
        <div className="card text-center">
          <div className="text-lg font-bold text-orange-400">{formatCurrency(totalAtPSAValue)}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Capital Out</div>
        </div>
      </div>

      {/* Grading Stats */}
      {allGraded.length > 0 && (
        <div className="card mb-4">
          <p className="section-header mb-3">Grading Performance</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Success rate */}
            <div className="bg-zinc-800/60 rounded-xl p-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">PSA 9+ Rate</p>
              <p className={`text-2xl font-extrabold ${successRate >= 60 ? 'text-emerald-400' : successRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {successRate.toFixed(0)}%
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {nineOrTen.length} of {allGraded.length} graded · {tens.length} PSA 10{tens.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Grade bump */}
            {avgNetBump !== null && (
              <div className="bg-zinc-800/60 rounded-xl p-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Avg Grade Bump</p>
                <p className={`text-2xl font-extrabold ${avgNetBump >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(avgNetBump)}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  net after PSA cost · {formatCurrency(avgGrossBump ?? 0)} gross
                </p>
              </div>
            )}
          </div>

          {/* Grade bump table for sold graded cards */}
          {gradeBumps.length > 0 && (
            <div>
              <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Sold Graded Cards</p>
              <div className="space-y-1.5">
                {gradeBumps.slice(0, 5).map(({ card: c, netBump }) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-zinc-300 truncate">{c.player}</span>
                      {c.psa_grade && (
                        <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                          parseFloat(c.psa_grade) >= 9 ? 'bg-emerald-900/50 text-emerald-300' :
                          parseFloat(c.psa_grade) >= 7 ? 'bg-yellow-900/50 text-yellow-300' :
                          'bg-red-900/50 text-red-300'
                        }`}>PSA {c.psa_grade}</span>
                      )}
                    </div>
                    <span className={`font-semibold shrink-0 ml-2 ${netBump >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {netBump >= 0 ? '+' : ''}{formatCurrency(netBump)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* At PSA */}
      <div className="mb-6">
        <h2 className="section-header mb-3">At PSA ({atPSA.length})</h2>
        {atPSA.length === 0 ? (
          <div className="card text-center py-8 text-zinc-600">No cards currently at PSA</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(batches).map(([batchName, batchCards]) => (
              <div key={batchName}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Batch: {batchName}</span>
                  <span className="text-xs text-zinc-600">· {batchCards.length} cards · {formatCurrency(batchCards.reduce((s, c) => s + totalCost(c, psaCost), 0))}</span>
                </div>
                <div className="space-y-2">
                  {batchCards.map(card => <GradingCard key={card.id} card={card} psaCost={psaCost} daysOut={daysOut(card)} onGrade={() => setGradeCard(card)} />)}
                </div>
              </div>
            ))}
            {ungrouped.length > 0 && (
              <div className="space-y-2">
                {Object.keys(batches).length > 0 && (
                  <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-2">Ungrouped</p>
                )}
                {ungrouped.map(card => <GradingCard key={card.id} card={card} psaCost={psaCost} daysOut={daysOut(card)} onGrade={() => setGradeCard(card)} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Graded — ready to sell */}
      {graded.length > 0 && (
        <div>
          <h2 className="section-header mb-3">Graded — Ready to Sell ({graded.length})</h2>
          <div className="space-y-2">
            {graded.map(card => (
              <div key={card.id} className="card border-l-4 border-emerald-600">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100">{card.player}</span>
                      {card.psa_grade && (
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                          parseFloat(card.psa_grade) >= 9 ? 'bg-emerald-900/50 text-emerald-300' :
                          parseFloat(card.psa_grade) >= 7 ? 'bg-yellow-900/50 text-yellow-300' :
                          'bg-red-900/50 text-red-300'
                        }`}>PSA {card.psa_grade}</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500 truncate">
                      {[card.year, card.set_name, card.variant].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Cost in: <strong className="text-zinc-300">{formatCurrency(totalCost(card, psaCost))}</strong>
                      {card.returned_date && <span className="ml-3">Returned: {card.returned_date}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSellCard(card)} className="btn-success text-xs px-3 py-1.5 shrink-0">
                    Sell
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gradeCard && <GradeModal card={gradeCard} onClose={() => setGradeCard(null)} onSaved={loadData} />}
      {sellCard && <SellModal card={sellCard} psaCost={psaCost} onClose={() => setSellCard(null)} onSaved={loadData} />}
    </div>
  )
}

function GradingCard({ card, psaCost, daysOut, onGrade }: { card: Card; psaCost: number; daysOut: number; onGrade: () => void }) {
  return (
    <div className="card border-l-4 border-violet-600">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-zinc-100">{card.player}</div>
          <div className="text-sm text-zinc-500 truncate">
            {[card.year, card.set_name, card.variant].filter(Boolean).join(' · ')}
          </div>
          <div className="flex gap-3 mt-1.5 text-xs text-zinc-500 flex-wrap">
            <span>Cost in: <strong className="text-zinc-300">{formatCurrency(totalCost(card, psaCost))}</strong></span>
            {card.submitted_date && (
              <span className={`font-medium ${daysOut > 45 ? 'text-red-400' : daysOut > 30 ? 'text-amber-400' : 'text-zinc-500'}`}>
                {daysOut} days out
              </span>
            )}
            {card.submitted_date && <span>Submitted: {card.submitted_date}</span>}
          </div>
        </div>
        <button onClick={onGrade}
          className="btn-secondary text-xs px-3 py-2 border-emerald-700 text-emerald-300 hover:bg-emerald-900/40 shrink-0">
          Got Grade ✓
        </button>
      </div>
    </div>
  )
}
