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

  const soldCards   = cards.filter(c => c.status === 'sold')
  const activeCards = cards.filter(c => c.status !== 'sold')
  const atPSA       = cards.filter(c => c.status === 'at_grader')
  const graded      = cards.filter(c => c.status === 'graded')
  const owned       = cards.filter(c => c.status === 'owned')

  const collectionValue = activeCards.reduce((s, c) => s + totalCost(c, psaCost), 0)
  const capitalAtPSA    = atPSA.reduce((s, c) => s + totalCost(c, psaCost), 0)
  const totalProfit     = soldCards.reduce((s, c) => s + profit(c, psaCost), 0)
  const overallROI      = soldCards.length
    ? soldCards.reduce((s, c) => s + roi(c, psaCost), 0) / soldCards.length
    : 0
  const winRate = soldCards.length
    ? (soldCards.filter(c => profit(c, psaCost) > 0).length / soldCards.length) * 100
    : 0

  const needsAction = [
    ...graded.map(c => ({ card: c, action: 'Ready to sell', color: 'text-emerald-400', dot: 'bg-emerald-500' })),
    ...atPSA.slice(0, 3).map(c => ({ card: c, action: 'At PSA', color: 'text-violet-400', dot: 'bg-violet-500' })),
  ].slice(0, 5)

  const recentCards = cards.slice(0, 5)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-900/50 flex items-center justify-center text-2xl animate-pulse">🃏</div>
        <p className="text-zinc-500 font-medium">Loading your dashboard...</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
        <div className="w-20 h-20 rounded-3xl bg-blue-900/40 flex items-center justify-center text-4xl shadow-inner">🃏</div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100">Welcome to Card Tracker</h1>
          <p className="text-zinc-500 mt-2 max-w-xs mx-auto">Add your first card to start tracking your flips and grading submissions.</p>
        </div>
        <Link href="/add" className="btn-primary w-auto px-10 py-3.5 text-base rounded-xl shadow-md">
          + Add Your First Card
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Hero — Collection Value */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Collection Value</p>
            <p className="text-5xl font-extrabold mt-1 tracking-tight text-zinc-100">
              {formatCurrency(collectionValue)}
            </p>
            <p className="text-zinc-500 text-xs mt-1.5">{activeCards.length} active card{activeCards.length !== 1 ? 's' : ''}</p>

            {/* Secondary metrics */}
            <div className="flex gap-4 mt-4 flex-wrap">
              <div>
                <p className="text-zinc-600 text-xs uppercase tracking-wider">Realized Profit</p>
                <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
              {soldCards.length > 0 && (
                <>
                  <div>
                    <p className="text-zinc-600 text-xs uppercase tracking-wider">Win Rate</p>
                    <p className={`text-lg font-bold ${winRate >= 50 ? 'text-emerald-400' : winRate >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                      {winRate.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-600 text-xs uppercase tracking-wider">Avg ROI</p>
                    <p className={`text-lg font-bold ${overallROI >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {formatPercent(overallROI)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <Link href="/add"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shrink-0 ml-3">
            + Add Card
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Active Cards" value={String(activeCards.length)}
          sub={formatCurrency(collectionValue) + ' invested'} color="blue" icon="📦" />
        <StatCard label="Capital at PSA" value={formatCurrency(capitalAtPSA)}
          sub={`${atPSA.length} card${atPSA.length !== 1 ? 's' : ''} out`} color="purple" icon="🏆" />
        <StatCard label="Graded — Ready" value={String(graded.length)}
          sub="waiting to be sold" color="green" icon="✅" />
        <StatCard label="Cards Sold" value={String(soldCards.length)}
          sub="all time" color="orange" icon="💰" />
      </div>

      {/* Pipeline status bar */}
      <div className="card">
        <p className="section-header">Inventory Pipeline</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Owned',   count: owned.length,     bg: 'bg-blue-900/40',    text: 'text-blue-300' },
            { label: 'At PSA',  count: atPSA.length,     bg: 'bg-violet-900/40',  text: 'text-violet-300' },
            { label: 'Graded',  count: graded.length,    bg: 'bg-emerald-900/40', text: 'text-emerald-300' },
            { label: 'Sold',    count: soldCards.length, bg: 'bg-zinc-800',       text: 'text-zinc-400' },
          ].map(({ label, count, bg, text }) => (
            <div key={label} className={`rounded-xl p-3 text-center ${bg}`}>
              <p className={`text-2xl font-extrabold leading-none ${text}`}>{count}</p>
              <p className={`text-xs font-semibold mt-1 ${text} opacity-80`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Needs action */}
      {needsAction.length > 0 && (
        <div className="card">
          <p className="section-header">Action Required</p>
          <div className="divide-y divide-zinc-800">
            {needsAction.map(({ card: c, action, color, dot }) => (
              <div key={c.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-100 text-sm truncate">{c.player}</p>
                    {(c.year || c.set_name) && (
                      <p className="text-xs text-zinc-500 truncate">{[c.year, c.set_name].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {c.psa_grade && (
                    <span className="badge bg-emerald-900/50 text-emerald-300 font-bold">PSA {c.psa_grade}</span>
                  )}
                  <span className={`text-xs font-bold ${color}`}>{action}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/inventory" className="block mt-3 text-center text-sm font-semibold text-blue-400 hover:text-blue-300">
            View all inventory →
          </Link>
        </div>
      )}

      {/* Recent cards */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="section-header mb-0">Recently Added</p>
          <Link href="/inventory" className="text-xs font-semibold text-blue-400 hover:text-blue-300">See all</Link>
        </div>
        <div className="divide-y divide-zinc-800">
          {recentCards.map(card => {
            const isSold = card.status === 'sold'
            const cardProfit = isSold ? profit(card, psaCost) : null
            const cardROI    = isSold ? roi(card, psaCost) : null
            return (
              <div key={card.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-100 text-sm">{card.player}</span>
                    <span className={`badge ${statusColor(card.status)}`}>{statusLabel(card.status)}</span>
                    {card.psa_grade && (
                      <span className="badge bg-emerald-900/50 text-emerald-300">PSA {card.psa_grade}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {format(parseISO(card.purchase_date), 'MMM d, yyyy')} · {formatCurrency(totalCost(card, psaCost))} in
                  </p>
                </div>
                {cardProfit !== null && cardROI !== null && (
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${cardProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(cardProfit)}
                    </p>
                    <p className={`text-xs font-semibold ${cardROI >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatPercent(cardROI)}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/grading" className="card-hover flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-900/50 flex items-center justify-center text-xl shrink-0">🏆</div>
          <div>
            <p className="font-bold text-zinc-100 text-sm">Grading Pipeline</p>
            <p className="text-xs text-zinc-500">{atPSA.length} at PSA</p>
          </div>
        </Link>
        <Link href="/analytics" className="card-hover flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900/50 flex items-center justify-center text-xl shrink-0">📈</div>
          <div>
            <p className="font-bold text-zinc-100 text-sm">Analytics</p>
            <p className="text-xs text-zinc-500">ROI, trends & more</p>
          </div>
        </Link>
      </div>

    </div>
  )
}
