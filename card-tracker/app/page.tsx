'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'
import { totalCost, profit, roi, formatCurrency, formatPercent, statusLabel, statusColor } from '@/lib/calculations'
import StatCard from '@/components/StatCard'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export default function DashboardPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [psaCost, setPsaCost] = useState(25)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cardsData }, { data: settings }] = await Promise.all([
        supabase.from('cards').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').single(),
      ])
      setCards(cardsData ?? [])
      if (settings) setPsaCost(settings.psa_cost)
      setLoading(false)
    }
    load()
  }, [])

  const soldCards = cards.filter(c => c.status === 'sold')
  const activeCards = cards.filter(c => c.status !== 'sold')
  const atPSA = cards.filter(c => c.status === 'at_grader')
  const graded = cards.filter(c => c.status === 'graded')
  const owned = cards.filter(c => c.status === 'owned')

  const totalProfit = soldCards.reduce((s, c) => s + profit(c, psaCost), 0)
  const totalInvested = activeCards.reduce((s, c) => s + totalCost(c, psaCost), 0)
  const capitalAtPSA = atPSA.reduce((s, c) => s + totalCost(c, psaCost), 0)
  const overallROI = soldCards.length
    ? soldCards.reduce((s, c) => s + roi(c, psaCost), 0) / soldCards.length
    : 0

  const recentCards = cards.slice(0, 5)
  const needsAction = [
    ...graded.map(c => ({ card: c, action: 'Ready to sell' })),
    ...atPSA.slice(0, 3).map(c => ({ card: c, action: 'At PSA' })),
  ].slice(0, 5)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-3xl animate-pulse">🃏</div>
        <div className="text-gray-500">Loading your dashboard...</div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="text-5xl">🃏</div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Card Tracker</h1>
        <p className="text-gray-500 max-w-xs">Add your first card to start tracking your flips and grading submissions.</p>
        <Link href="/add" className="btn-primary w-auto px-8 py-3">+ Add Your First Card</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500">{cards.length} total cards tracked</p>
        </div>
        <Link href="/add" className="btn-primary w-auto px-4 py-2 text-sm">+ Add Card</Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Profit"
          value={formatCurrency(totalProfit)}
          sub={`${soldCards.length} cards sold`}
          color={totalProfit >= 0 ? 'green' : 'red'}
          icon="💰"
        />
        <StatCard
          label="Avg ROI"
          value={soldCards.length ? formatPercent(overallROI) : '—'}
          sub="on sold cards"
          color="blue"
          icon="📈"
        />
        <StatCard
          label="Active Inventory"
          value={String(activeCards.length)}
          sub={formatCurrency(totalInvested) + ' invested'}
          color="orange"
          icon="📦"
        />
        <StatCard
          label="Capital at PSA"
          value={formatCurrency(capitalAtPSA)}
          sub={`${atPSA.length} card${atPSA.length !== 1 ? 's' : ''} out`}
          color="purple"
          icon="🏆"
        />
      </div>

      {/* Status breakdown */}
      <div className="card">
        <h2 className="section-header mb-3">Inventory Breakdown</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Owned', count: owned.length, color: 'text-blue-600' },
            { label: 'At PSA', count: atPSA.length, color: 'text-purple-600' },
            { label: 'Graded', count: graded.length, color: 'text-green-600' },
            { label: 'Sold', count: soldCards.length, color: 'text-gray-500' },
          ].map(({ label, count, color }) => (
            <div key={label}>
              <div className={`text-xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Needs action */}
      {needsAction.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Needs Action</h2>
          <div className="space-y-2">
            {needsAction.map(({ card: c, action }) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-sm text-gray-900 truncate block">{c.player}</span>
                  {c.year && <span className="text-xs text-gray-400">{c.year}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.psa_grade && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-800 rounded">
                      PSA {c.psa_grade}
                    </span>
                  )}
                  <span className="text-xs text-amber-600 font-medium">{action}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/inventory" className="block mt-3 text-sm text-blue-600 hover:underline text-center">
            View all inventory →
          </Link>
        </div>
      )}

      {/* Recent cards */}
      <div className="card">
        <h2 className="section-header mb-3">Recently Added</h2>
        <div className="space-y-2">
          {recentCards.map(card => {
            const isSold = card.status === 'sold'
            const cardProfit = isSold ? profit(card, psaCost) : null
            return (
              <div key={card.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{card.player}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(card.status)}`}>
                      {statusLabel(card.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {format(parseISO(card.purchase_date), 'MMM d, yyyy')} · {formatCurrency(totalCost(card, psaCost))}
                  </div>
                </div>
                {cardProfit !== null && (
                  <span className={`text-sm font-semibold shrink-0 ${cardProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatPercent(roi(card, psaCost))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {cards.length > 5 && (
          <Link href="/inventory" className="block mt-3 text-sm text-blue-600 hover:underline text-center">
            View all {cards.length} cards →
          </Link>
        )}
      </div>
    </div>
  )
}
