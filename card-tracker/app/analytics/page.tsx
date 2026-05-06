'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'
import { totalCost, profit, roi, formatCurrency, formatPercent } from '@/lib/calculations'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, parseISO, startOfMonth } from 'date-fns'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#ef4444', '#64748b']

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
  const activeCards = cards.filter(c => c.status !== 'sold')

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

  // Strategy comparison
  const flipSold = soldCards.filter(c => c.strategy === 'flip')
  const gradeSold = soldCards.filter(c => c.strategy === 'grade')
  const avg = (arr: Card[]) => arr.length ? arr.reduce((s, c) => s + roi(c, psaCost), 0) / arr.length : 0
  const totalProfit = (arr: Card[]) => arr.reduce((s, c) => s + profit(c, psaCost), 0)

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

  // Days to sell average
  const daysToSell = soldCards
    .filter(c => c.purchase_date && c.sold_date)
    .map(c => {
      const d = (new Date(c.sold_date!).getTime() - new Date(c.purchase_date).getTime()) / 86400000
      return d
    })
  const avgDays = daysToSell.length ? (daysToSell.reduce((a, b) => a + b, 0) / daysToSell.length).toFixed(0) : 'N/A'

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>

  if (soldCards.length === 0) {
    return (
      <div>
        <h1 className="page-title mb-4">Analytics</h1>
        <div className="card text-center py-12 text-gray-500">
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
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit(soldCards))}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Profit</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">{soldCards.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Cards Sold</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600">{avgDays}</div>
          <div className="text-xs text-gray-500 mt-0.5">Avg Days to Sell</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-orange-600">
            {soldCards.length ? formatPercent(soldCards.reduce((s, c) => s + roi(c, psaCost), 0) / soldCards.length) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Avg ROI</div>
        </div>
      </div>

      {/* Flip vs Grade */}
      <div className="card">
        <h2 className="section-header mb-3">Flip vs Grade</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold text-blue-600 uppercase">Flip</div>
            <div className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(totalProfit(flipSold))}</div>
            <div className="text-xs text-blue-600">{flipSold.length} sold · {formatPercent(avg(flipSold))} avg ROI</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold text-purple-600 uppercase">Grade</div>
            <div className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totalProfit(gradeSold))}</div>
            <div className="text-xs text-purple-600">{gradeSold.length} sold · {formatPercent(avg(gradeSold))} avg ROI</div>
          </div>
        </div>
      </div>

      {/* Monthly P&L */}
      {monthlyChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Monthly Profit / Loss</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}
                fill="#2563eb"
                label={false}
              />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="sport" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="avgROI" radius={[0, 4, 4, 0]} fill="#16a34a" />
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
              <Pie data={platformChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${formatCurrency(value)}`} labelLine={false}>
                {platformChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
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
              <div key={grade} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                <div className="font-bold text-green-800">{grade}</div>
                <div className="text-xs text-green-600">{count} card{count > 1 ? 's' : ''}</div>
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
                <span className="text-gray-700 truncate mr-2">{card.player}</span>
                <span className="font-semibold text-green-600 shrink-0">{formatPercent(roi(card, psaCost))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="section-header mb-3">Worst Performers</h2>
          <div className="space-y-2">
            {worst.map(card => (
              <div key={card.id} className="flex justify-between text-sm">
                <span className="text-gray-700 truncate mr-2">{card.player}</span>
                <span className="font-semibold text-red-500 shrink-0">{formatPercent(roi(card, psaCost))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
