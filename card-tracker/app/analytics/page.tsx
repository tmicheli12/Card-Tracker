'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'
import { totalCost, profit, roi, formatCurrency, formatPercent } from '@/lib/calculations'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, parseISO, startOfMonth, differenceInDays } from 'date-fns'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b']

export default function AnalyticsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [psaCost, setPsaCost] = useState(25)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cardsData }, { data: settings }] = await Promise.all([
        supabase.from('cards').select('*'),
        supabase.from('settings').select('*').single(),
      ])
      setCards(cardsData ?? [])
      if (settings) setPsaCost(settings.psa_cost)
      setLoading(false)
    }
    load()
  }, [])

  const soldCards = cards.filter(c => c.status === 'sold' && c.sale_price)

  // Monthly P&L
  const monthlyData = soldCards.reduce<Record<string, number>>((acc, card) => {
    if (!card.sold_date) return acc
    const month = format(startOfMonth(parseISO(card.sold_date)), 'MMM yy')
    acc[month] = (acc[month] ?? 0) + profit(card, psaCost)
    return acc
  }, {})
  const monthlyChart = Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, profit: parseFloat(value.toFixed(2)) }))

  // ROI by sport
  const bySport = soldCards.reduce<Record<string, { total: number; count: number }>>((acc, card) => {
    if (!acc[card.sport]) acc[card.sport] = { total: 0, count: 0 }
    acc[card.sport].total += roi(card, psaCost)
    acc[card.sport].count += 1
    return acc
  }, {})
  const sportChart = Object.entries(bySport).map(([sport, d]) => ({
    sport,
    avgROI: parseFloat((d.total / d.count).toFixed(1)),
  }))

  // Strategy comparison with win rate and avg days
  const flipSold = soldCards.filter(c => c.strategy === 'flip')
  const gradeSold = soldCards.filter(c => c.strategy === 'grade')
  const totalProfitFn = (arr: Card[]) => arr.reduce((s, c) => s + profit(c, psaCost), 0)
  const avgROIFn = (arr: Card[]) => arr.length ? arr.reduce((s, c) => s + roi(c, psaCost), 0) / arr.length : 0
  const winRateFn = (arr: Card[]) => arr.length ? (arr.filter(c => profit(c, psaCost) > 0).length / arr.length) * 100 : 0
  const avgDaysFn = (arr: Card[]) => {
    const valid = arr.filter(c => c.purchase_date && c.sold_date)
    if (!valid.length) return null
    const avg = valid.reduce((s, c) => s + differenceInDays(new Date(c.sold_date!), new Date(c.purchase_date)), 0) / valid.length
    return Math.round(avg)
  }

  // Grade distribution
  const gradeDist = soldCards
    .filter(c => c.psa_grade)
    .reduce<Record<string, number>>((acc, c) => {
      acc[c.psa_grade!] = (acc[c.psa_grade!] ?? 0) + 1
      return acc
    }, {})
  const gradeChart = Object.entries(gradeDist)
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([grade, count]) => ({ grade: `PSA ${grade}`, count }))

  // Platform breakdown
  const byPlatform = soldCards.reduce<Record<string, number>>((acc, card) => {
    const p = card.platform ?? 'Unknown'
    acc[p] = (acc[p] ?? 0) + profit(card, psaCost)
    return acc
  }, {})
  const platformChart = Object.entries(byPlatform).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2)),
  }))

  // Best & worst cards
  const rankedSold = [...soldCards].sort((a, b) => roi(b, psaCost) - roi(a, psaCost))
  const best = rankedSold.slice(0, 3)
  const worst = rankedSold.slice(-3).reverse()

  // Overall stats
  const overallWinRate = soldCards.length
    ? (soldCards.filter(c => profit(c, psaCost) > 0).length / soldCards.length) * 100
    : 0
  const avgDaysAll = avgDaysFn(soldCards)

  if (loading) return <div className="text-center py-12 text-zinc-500">Loading...</div>

  if (soldCards.length === 0) {
    return (
      <div>
        <h1 className="page-title mb-4">Analytics</h1>
        <div className="card text-center py-12 text-zinc-500">
          No sold cards yet. Analytics will appear once you record your first sale.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Analytics</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className={`text-2xl font-bold ${totalProfitFn(soldCards) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(totalProfitFn(soldCards))}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Total Profit</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-400">{soldCards.length}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Cards Sold</div>
        </div>
        <div className="card text-center">
          <div className={`text-2xl font-bold ${overallWinRate >= 50 ? 'text-emerald-400' : overallWinRate >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
            {overallWinRate.toFixed(0)}%
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Win Rate</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-violet-400">
            {soldCards.length ? formatPercent(soldCards.reduce((s, c) => s + roi(c, psaCost), 0) / soldCards.length) : '—'}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">Avg ROI</div>
        </div>
      </div>

      {/* Flip vs Grade */}
      <div className="card">
        <h2 className="section-header mb-3">Flip vs Grade</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-900/30 border border-blue-900 rounded-lg p-3">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">💰 Flip</div>
            <div className="text-xl font-bold text-blue-300">{formatCurrency(totalProfitFn(flipSold))}</div>
            <div className="mt-2 space-y-1 text-xs text-zinc-400">
              <div>{flipSold.length} sold</div>
              <div>Avg ROI: <span className={avgROIFn(flipSold) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(avgROIFn(flipSold))}</span></div>
              <div>Win Rate: <span className={winRateFn(flipSold) >= 50 ? 'text-emerald-400' : 'text-amber-400'}>{winRateFn(flipSold).toFixed(0)}%</span></div>
              {avgDaysFn(flipSold) !== null && <div>Avg Days: {avgDaysFn(flipSold)}</div>}
            </div>
          </div>
          <div className="bg-violet-900/30 border border-violet-900 rounded-lg p-3">
            <div className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">🏆 Grade</div>
            <div className="text-xl font-bold text-violet-300">{formatCurrency(totalProfitFn(gradeSold))}</div>
            <div className="mt-2 space-y-1 text-xs text-zinc-400">
              <div>{gradeSold.length} sold</div>
              <div>Avg ROI: <span className={avgROIFn(gradeSold) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(avgROIFn(gradeSold))}</span></div>
              <div>Win Rate: <span className={winRateFn(gradeSold) >= 50 ? 'text-emerald-400' : 'text-amber-400'}>{winRateFn(gradeSold).toFixed(0)}%</span></div>
              {avgDaysFn(gradeSold) !== null && <div>Avg Days: {avgDaysFn(gradeSold)}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly P&L */}
      {monthlyChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Monthly Profit / Loss</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#e4e4e7' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ROI by sport */}
      {sportChart.length > 1 && (
        <div className="card">
          <h2 className="section-header mb-3">Avg ROI by Sport</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sportChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="sport" type="category" tick={{ fontSize: 11, fill: '#71717a' }} width={70} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#e4e4e7' }}
                formatter={(v: number) => `${v}%`}
              />
              <Bar dataKey="avgROI" radius={[0, 4, 4, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform breakdown */}
      {platformChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Profit by Platform</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={platformChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`} labelLine={false}>
                {platformChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                itemStyle={{ color: '#e4e4e7' }}
                formatter={(v: number) => formatCurrency(v)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grade distribution */}
      {gradeChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">PSA Grade Distribution (Sold)</h2>
          <div className="flex gap-2 flex-wrap">
            {gradeChart.map(({ grade, count }) => (
              <div key={grade} className="bg-emerald-900/30 border border-emerald-800 rounded-lg px-3 py-2 text-center">
                <div className="font-bold text-emerald-300">{grade}</div>
                <div className="text-xs text-emerald-500">{count} card{count > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best & worst */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="section-header mb-3">Best Performers</h2>
          <div className="space-y-2">
            {best.map(card => (
              <div key={card.id} className="flex justify-between text-sm">
                <span className="text-zinc-400 truncate mr-2">{card.player}</span>
                <span className="font-semibold text-emerald-400 shrink-0">{formatPercent(roi(card, psaCost))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="section-header mb-3">Worst Performers</h2>
          <div className="space-y-2">
            {worst.map(card => (
              <div key={card.id} className="flex justify-between text-sm">
                <span className="text-zinc-400 truncate mr-2">{card.player}</span>
                <span className="font-semibold text-red-400 shrink-0">{formatPercent(roi(card, psaCost))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
