'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardStatus } from '@/types/card'
import { totalCost, profit, roi, formatCurrency, formatPercent, statusLabel, statusColor } from '@/lib/calculations'
import SellModal from '@/components/SellModal'
import GradeModal from '@/components/GradeModal'
import Link from 'next/link'

const STATUS_TABS: { key: 'all' | CardStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'owned', label: 'Owned' },
  { key: 'at_grader', label: 'At PSA' },
  { key: 'graded', label: 'Graded' },
  { key: 'sold', label: 'Sold' },
]

export default function InventoryPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [psaCost, setPsaCost] = useState(25)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | CardStatus>('all')
  const [sellCard, setSellCard] = useState<Card | null>(null)
  const [gradeCard, setGradeCard] = useState<Card | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [{ data: cardsData }, { data: settingsData }] = await Promise.all([
      supabase.from('cards').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').single(),
    ])
    setCards(cardsData ?? [])
    if (settingsData) setPsaCost(settingsData.psa_cost)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id: string) {
    await supabase.from('cards').delete().eq('id', id)
    setDeleteId(null)
    loadData()
  }

  async function handleSendToPSA(card: Card) {
    await supabase.from('cards').update({
      status: 'at_grader',
      submitted_date: new Date().toISOString().split('T')[0],
    }).eq('id', card.id)
    loadData()
  }

  const filtered = cards.filter(c => {
    const matchTab = tab === 'all' || c.status === tab
    const matchSearch = !search || c.player.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const tabCounts = (key: string) =>
    key === 'all' ? cards.length : cards.filter(c => c.status === key).length

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Inventory</h1>
        <Link href="/add" className="btn-primary w-auto px-4 py-2 text-sm">+ Add Card</Link>
      </div>

      {/* Search */}
      <input className="input mb-3" type="search" placeholder="Search by player name..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {label} ({tabCounts(key)})
          </button>
        ))}
      </div>

      {/* Cards list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          {search ? 'No cards match your search.' : 'No cards yet. '}
          {!search && <Link href="/add" className="text-blue-600 hover:underline">Add your first card →</Link>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(card => {
            const cost = totalCost(card, psaCost)
            const isSold = card.status === 'sold'
            const cardProfit = isSold ? profit(card, psaCost) : null
            const cardROI = isSold ? roi(card, psaCost) : null

            return (
              <div key={card.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{card.player}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(card.status)}`}>
                        {statusLabel(card.status)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        card.strategy === 'grade' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {card.strategy === 'grade' ? '🏆 Grade' : '💰 Flip'}
                      </span>
                      {card.psa_grade && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-800">
                          PSA {card.psa_grade}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 truncate">
                      {[card.year, card.set_name, card.variant].filter(Boolean).join(' · ')}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap">
                      <span className="text-gray-700">Cost: <strong>{formatCurrency(cost)}</strong></span>
                      {isSold && cardProfit !== null && (
                        <>
                          <span className={cardProfit >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                            {cardProfit >= 0 ? '↑' : '↓'} {formatCurrency(cardProfit)}
                          </span>
                          {cardROI !== null && (
                            <span className={`text-xs ${cardROI >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {formatPercent(cardROI)} ROI
                            </span>
                          )}
                        </>
                      )}
                      {card.source && <span className="text-gray-400 text-xs">{card.source}</span>}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {card.status === 'owned' && card.strategy === 'flip' && (
                      <button onClick={() => setSellCard(card)} className="btn-success text-xs px-3 py-1.5">
                        Sell
                      </button>
                    )}
                    {card.status === 'owned' && card.strategy === 'grade' && (
                      <button onClick={() => handleSendToPSA(card)} className="btn-secondary text-xs px-3 py-1.5 border-purple-300 text-purple-700 hover:bg-purple-50">
                        → PSA
                      </button>
                    )}
                    {card.status === 'at_grader' && (
                      <button onClick={() => setGradeCard(card)} className="btn-secondary text-xs px-3 py-1.5 border-green-300 text-green-700 hover:bg-green-50">
                        Got Grade
                      </button>
                    )}
                    {card.status === 'graded' && (
                      <button onClick={() => setSellCard(card)} className="btn-success text-xs px-3 py-1.5">
                        Sell
                      </button>
                    )}
                    {deleteId === card.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(card.id)} className="btn-danger text-xs px-2 py-1">Yes</button>
                        <button onClick={() => setDeleteId(null)} className="btn-secondary text-xs px-2 py-1">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(card.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Dates row */}
                <div className="mt-2 flex gap-3 text-xs text-gray-400 flex-wrap">
                  <span>Bought {card.purchase_date}</span>
                  {card.submitted_date && <span>Submitted {card.submitted_date}</span>}
                  {card.returned_date && <span>Returned {card.returned_date}</span>}
                  {card.sold_date && <span>Sold {card.sold_date}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sellCard && (
        <SellModal card={sellCard} psaCost={psaCost}
          onClose={() => setSellCard(null)} onSaved={loadData} />
      )}
      {gradeCard && (
        <GradeModal card={gradeCard}
          onClose={() => setGradeCard(null)} onSaved={loadData} />
      )}
    </div>
  )
}
