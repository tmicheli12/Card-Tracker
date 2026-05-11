'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardStatus, Sport } from '@/types/card'
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

const SPORTS: Sport[] = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Other']

type SortKey = 'newest' | 'oldest' | 'price_high' | 'price_low' | 'player_az'

export default function InventoryPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [psaCost, setPsaCost] = useState(25)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | CardStatus>('all')
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all')
  const [strategyFilter, setStrategyFilter] = useState<'all' | 'flip' | 'grade'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [sellCard, setSellCard] = useState<Card | null>(null)
  const [gradeCard, setGradeCard] = useState<Card | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [compingId, setCompingId] = useState<string | null>(null)
  const [compingAll, setCompingAll] = useState(false)

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
      strategy: 'grade',
      submitted_date: new Date().toISOString().split('T')[0],
    }).eq('id', card.id)
    loadData()
  }

  async function compCard(card: Card) {
    setCompingId(card.id)
    try {
      const res = await fetch('/api/comp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, player: card.player, year: card.year, sport: card.sport }),
      })
      if (res.ok) loadData()
      else {
        const err = await res.json()
        alert(`Comp failed: ${err.error}`)
      }
    } catch {
      alert('Comp request failed — check your connection.')
    }
    setCompingId(null)
  }

  async function compAll() {
    const targets = cards.filter(c => c.status === 'owned' || c.status === 'graded')
    if (!targets.length) return
    setCompingAll(true)
    for (const card of targets) {
      setCompingId(card.id)
      await fetch('/api/comp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, player: card.player, year: card.year, sport: card.sport }),
      })
      // small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500))
    }
    setCompingId(null)
    setCompingAll(false)
    loadData()
  }

  function exportCSV() {
    const headers = [
      'Player','Year','Set','Card #','Variant','Sport','Strategy','Status',
      'Purchase Date','Purchase Price','Purchase Fees','Total Cost',
      'PSA Grade','Submitted Date','Returned Date',
      'Sale Price','Sale Fees','Sale Shipping','Net Sale','Profit','ROI %',
      'Batch','Source','Notes'
    ]
    const rows = filtered.map(c => {
      const cost = totalCost(c, psaCost)
      const netSale = c.sale_price ? (c.sale_price - (c.sale_fees ?? 0) - (c.sale_shipping ?? 0)) : ''
      const cardProfit = c.sale_price ? (Number(netSale) - cost).toFixed(2) : ''
      const cardROI = c.sale_price && cost > 0 ? ((Number(cardProfit) / cost) * 100).toFixed(1) : ''
      return [
        c.player, c.year ?? '', c.set_name ?? '', c.card_number ?? '', c.variant ?? '',
        c.sport, c.strategy, c.status,
        c.purchase_date, c.purchase_price.toFixed(2), (c.purchase_fees ?? 0).toFixed(2), cost.toFixed(2),
        c.psa_grade ?? '', c.submitted_date ?? '', c.returned_date ?? '',
        c.sale_price?.toFixed(2) ?? '', (c.sale_fees ?? 0).toFixed(2), (c.sale_shipping ?? 0).toFixed(2),
        netSale !== '' ? Number(netSale).toFixed(2) : '', cardProfit, cardROI,
        (c as any).batch_name ?? '', c.source ?? '', c.notes ?? ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cards-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = cards
    .filter(c => {
      const matchTab = tab === 'all' || c.status === tab
      const matchSearch = !search || c.player.toLowerCase().includes(search.toLowerCase())
      const matchSport = sportFilter === 'all' || c.sport === sportFilter
      const matchStrategy = strategyFilter === 'all' || c.strategy === strategyFilter
      return matchTab && matchSearch && matchSport && matchStrategy
    })
    .sort((a, b) => {
      switch (sortKey) {
        case 'oldest': return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime()
        case 'price_high': return totalCost(b, psaCost) - totalCost(a, psaCost)
        case 'price_low': return totalCost(a, psaCost) - totalCost(b, psaCost)
        case 'player_az': return a.player.localeCompare(b.player)
        default: return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()
      }
    })

  const tabCounts = (key: string) =>
    key === 'all' ? cards.length : cards.filter(c => c.status === key).length

  if (loading) return <div className="text-center py-12 text-zinc-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Inventory</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2">Export CSV</button>
          <button
            onClick={compAll}
            disabled={compingAll}
            className="btn-secondary text-xs px-3 py-2 disabled:opacity-50"
            title="Fetch eBay sold comps for all owned cards"
          >
            {compingAll ? '⏳ Comping...' : '🔍 Comp All'}
          </button>
          <Link href="/add" className="btn-primary w-auto px-4 py-2 text-sm">+ Add Card</Link>
        </div>
      </div>

      {/* Search */}
      <input className="input mb-3" type="search" placeholder="Search by player name..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {/* Filters row */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <select className="input py-1.5 text-sm flex-1 min-w-[120px]" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price_high">Price: High → Low</option>
          <option value="price_low">Price: Low → High</option>
          <option value="player_az">Player: A → Z</option>
        </select>
        <select className="input py-1.5 text-sm flex-1 min-w-[120px]" value={sportFilter} onChange={e => setSportFilter(e.target.value as Sport | 'all')}>
          <option value="all">All Sports</option>
          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input py-1.5 text-sm flex-1 min-w-[100px]" value={strategyFilter} onChange={e => setStrategyFilter(e.target.value as 'all' | 'flip' | 'grade')}>
          <option value="all">All Strategies</option>
          <option value="flip">Flip only</option>
          <option value="grade">Grade only</option>
        </select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700'
            }`}>
            {label} ({tabCounts(key)})
          </button>
        ))}
      </div>

      {/* Cards list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-zinc-500">
          {search ? 'No cards match your search.' : 'No cards yet. '}
          {!search && <Link href="/add" className="text-blue-400 hover:underline">Add your first card →</Link>}
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
                      <span className="font-semibold text-zinc-100 truncate">{card.player}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(card.status)}`}>
                        {statusLabel(card.status)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        card.strategy === 'grade' ? 'bg-violet-900/50 text-violet-300' : 'bg-blue-900/50 text-blue-300'
                      }`}>
                        {card.strategy === 'grade' ? '🏆 Grade' : '💰 Flip'}
                      </span>
                      {card.psa_grade && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-900/50 text-emerald-300">
                          PSA {card.psa_grade}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500 mt-0.5 truncate">
                      {[card.year, card.set_name, card.variant].filter(Boolean).join(' · ')}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap">
                      <span className="text-zinc-400">Cost: <strong className="text-zinc-200">{formatCurrency(cost)}</strong></span>
                      {isSold && card.sale_price && (
                        <span className="text-zinc-400">Sold: <strong className="text-zinc-200">{formatCurrency(card.sale_price)}</strong></span>
                      )}
                      {!isSold && card.comp_price && (
                        <span className="text-zinc-400">
                          Comp: <strong className={card.comp_price > cost ? 'text-emerald-400' : 'text-red-400'}>
                            {formatCurrency(card.comp_price)}
                          </strong>
                          <span className="text-zinc-600 ml-1 text-xs">
                            ({formatCurrency(card.comp_low ?? card.comp_price)}–{formatCurrency(card.comp_high ?? card.comp_price)}, {card.comp_count} sales)
                          </span>
                        </span>
                      )}
                      {isSold && cardProfit !== null && (
                        <>
                          <span className={cardProfit >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                            {cardProfit >= 0 ? '↑' : '↓'} {formatCurrency(cardProfit)}
                          </span>
                          {cardROI !== null && (
                            <span className={`text-xs ${cardROI >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {formatPercent(cardROI)} ROI
                            </span>
                          )}
                        </>
                      )}
                      {card.source && <span className="text-zinc-600 text-xs">{card.source}</span>}
                    </div>
                    {card.comp_date && (
                      <p className="text-xs text-zinc-600 mt-0.5">Comped {card.comp_date}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {card.status === 'owned' && (
                      <>
                        <button onClick={() => setSellCard(card)} className="btn-success text-xs px-3 py-1.5">
                          Sell
                        </button>
                        <button onClick={() => handleSendToPSA(card)} className="btn-secondary text-xs px-3 py-1.5 border-violet-700 text-violet-300 hover:bg-violet-900/40">
                          → PSA
                        </button>
                      </>
                    )}
                    {card.status === 'at_grader' && (
                      <button onClick={() => setGradeCard(card)} className="btn-secondary text-xs px-3 py-1.5 border-emerald-700 text-emerald-300 hover:bg-emerald-900/40">
                        Got Grade
                      </button>
                    )}
                    {card.status === 'graded' && (
                      <button onClick={() => setSellCard(card)} className="btn-success text-xs px-3 py-1.5">
                        Sell
                      </button>
                    )}
                    {(card.status === 'owned' || card.status === 'graded') && (
                      <button
                        onClick={() => compCard(card)}
                        disabled={compingId === card.id}
                        className="text-xs text-zinc-500 hover:text-blue-400 px-2 py-1 disabled:opacity-40"
                        title="Fetch eBay sold comps"
                      >
                        {compingId === card.id ? '⏳' : '🔍 Comp'}
                      </button>
                    )}
                    <Link href={`/edit/${card.id}`} className="text-xs text-zinc-500 hover:text-blue-400 px-2 py-1 text-center">
                      Edit
                    </Link>
                    {deleteId === card.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(card.id)} className="btn-danger text-xs px-2 py-1">Yes</button>
                        <button onClick={() => setDeleteId(null)} className="btn-secondary text-xs px-2 py-1">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(card.id)} className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1">
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Dates row */}
                <div className="mt-2 flex gap-3 text-xs text-zinc-600 flex-wrap">
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
