'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/types/card'
import { totalCost, profit, roi, formatCurrency, formatPercent, netSale } from '@/lib/calculations'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, parseISO, startOfMonth, differenceInDays } from 'date-fns'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b']
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 },
  labelStyle: { color: '#a1a1aa' },
  itemStyle: { color: '#e4e4e7' },
}

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

  // ── Strategy helpers ──────────────────────────────────────────────────────
  const flipSold = soldCards.filter(c => c.strategy === 'flip')
  const gradeSold = soldCards.filter(c => c.strategy === 'grade')
  const totalProfitFn = (arr: Card[]) => arr.reduce((s, c) => s + profit(c, psaCost), 0)
  const avgROIFn = (arr: Card[]) => arr.length ? arr.reduce((s, c) => s + roi(c, psaCost), 0) / arr.length : 0
  const winRateFn = (arr: Card[]) => arr.length ? (arr.filter(c => profit(c, psaCost) > 0).length / arr.length) * 100 : 0
  const avgDaysFn = (arr: Card[]) => {
    const valid = arr.filter(c => c.purchase_date && c.sold_date)
    if (!valid.length) return null
    return Math.round(valid.reduce((s, c) => s + differenceInDays(new Date(c.sold_date!), new Date(c.purchase_date)), 0) / valid.length)
  }

  // ── Monthly P&L ───────────────────────────────────────────────────────────
  const monthlyData = soldCards.reduce<Record<string, number>>((acc, card) => {
    if (!card.sold_date) return acc
    const month = format(startOfMonth(parseISO(card.sold_date)), 'MMM yy')
    acc[month] = (acc[month] ?? 0) + profit(card, psaCost)
    return acc
  }, {})
  const monthlyChart = Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, profit: parseFloat(value.toFixed(2)) }))

  // ── Monthly Cash Flow (money out vs money in) ─────────────────────────────
  const cashFlowMap: Record<string, { out: number; in: number }> = {}
  cards.forEach(c => {
    const month = format(startOfMonth(new Date(c.purchase_date)), 'MMM yy')
    if (!cashFlowMap[month]) cashFlowMap[month] = { out: 0, in: 0 }
    cashFlowMap[month].out += c.purchase_price + (c.purchase_fees ?? 0)
  })
  soldCards.forEach(c => {
    if (!c.sold_date) return
    const month = format(startOfMonth(parseISO(c.sold_date)), 'MMM yy')
    if (!cashFlowMap[month]) cashFlowMap[month] = { out: 0, in: 0 }
    cashFlowMap[month].in += netSale(c)
  })
  const cashFlowChart = Object.entries(cashFlowMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, d]) => ({
      month,
      spent: parseFloat(d.out.toFixed(2)),
      received: parseFloat(d.in.toFixed(2)),
    }))

  // ── ROI by sport ──────────────────────────────────────────────────────────
  const bySport = soldCards.reduce<Record<string, { total: number; count: number }>>((acc, card) => {
    if (!acc[card.sport]) acc[card.sport] = { total: 0, count: 0 }
    acc[card.sport].total += roi(card, psaCost)
    acc[card.sport].count += 1
    return acc
  }, {})
  const sportChart = Object.entries(bySport).map(([sport, d]) => ({
    sport, avgROI: parseFloat((d.total / d.count).toFixed(1)),
  }))

  // ── Best source by ROI ────────────────────────────────────────────────────
  const bySource = soldCards.reduce<Record<string, { totalROI: number; totalProfit: number; count: number }>>((acc, card) => {
    const src = card.source ?? 'Unknown'
    if (!acc[src]) acc[src] = { totalROI: 0, totalProfit: 0, count: 0 }
    acc[src].totalROI += roi(card, psaCost)
    acc[src].totalProfit += profit(card, psaCost)
    acc[src].count += 1
    return acc
  }, {})
  const sourceRows = Object.entries(bySource)
    .map(([source, d]) => ({ source, avgROI: d.totalROI / d.count, totalProfit: d.totalProfit, count: d.count }))
    .sort((a, b) => b.avgROI - a.avgROI)

  // ── Loss analysis ─────────────────────────────────────────────────────────
  const losers = soldCards.filter(c => profit(c, psaCost) < 0)
  const avgLoss = losers.length ? losers.reduce((s, c) => s + profit(c, psaCost), 0) / losers.length : 0
  const lossBySport = losers.reduce<Record<string, number>>((acc, c) => {
    acc[c.sport] = (acc[c.sport] ?? 0) + 1
    return acc
  }, {})
  const lossRows = Object.entries(lossBySport).sort((a, b) => b[1] - a[1])

  // ── Platform breakdown ────────────────────────────────────────────────────
  const byPlatform = soldCards.reduce<Record<string, number>>((acc, card) => {
    const p = card.platform ?? 'Unknown'
    acc[p] = (acc[p] ?? 0) + profit(card, psaCost)
    return acc
  }, {})
  const platformChart = Object.entries(byPlatform).map(([name, value]) => ({
    name, value: parseFloat(value.toFixed(2)),
  }))

  // ── Grade distribution ────────────────────────────────────────────────────
  const gradeDist = soldCards.filter(c => c.psa_grade).reduce<Record<string, number>>((acc, c) => {
    acc[c.psa_grade!] = (acc[c.psa_grade!] ?? 0) + 1
    return acc
  }, {})
  const gradeChart = Object.entries(gradeDist)
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([grade, count]) => ({ grade: `PSA ${grade}`, count }))

  // ── Best & worst ──────────────────────────────────────────────────────────
  const rankedSold = [...soldCards].sort((a, b) => roi(b, psaCost) - roi(a, psaCost))
  const best = rankedSold.slice(0, 3)
  const worst = rankedSold.slice(-3).reverse()

  // ── Overall stats ─────────────────────────────────────────────────────────
  const overallWinRate = soldCards.length
    ? (soldCards.filter(c => profit(c, psaCost) > 0).length / soldCards.length) * 100 : 0

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
          {[
            { label: '💰 Flip', arr: flipSold, bg: 'bg-blue-900/30', border: 'border-blue-900', title: 'text-blue-400', val: 'text-blue-300' },
            { label: '🏆 Grade', arr: gradeSold, bg: 'bg-violet-900/30', border: 'border-violet-900', title: 'text-violet-400', val: 'text-violet-300' },
          ].map(({ label, arr, bg, border, title, val }) => (
            <div key={label} className={`${bg} border ${border} rounded-lg p-3`}>
              <div className={`text-xs font-bold ${title} uppercase tracking-wider mb-2`}>{label}</div>
              <div className={`text-xl font-bold ${val}`}>{formatCurrency(totalProfitFn(arr))}</div>
              <div className="mt-2 space-y-1 text-xs text-zinc-400">
                <div>{arr.length} sold</div>
                <div>Avg ROI: <span className={avgROIFn(arr) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(avgROIFn(arr))}</span></div>
                <div>Win Rate: <span className={winRateFn(arr) >= 50 ? 'text-emerald-400' : 'text-amber-400'}>{winRateFn(arr).toFixed(0)}%</span></div>
                {avgDaysFn(arr) !== null && <div>Avg Days: {avgDaysFn(arr)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Cash Flow */}
      {cashFlowChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-1">Monthly Cash Flow</h2>
          <p className="text-xs text-zinc-600 mb-3">Money spent buying vs received from sales</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cashFlowChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `$${v}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 11 }} />
              <Bar dataKey="spent" name="Spent" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="received" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly P&L */}
      {monthlyChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Monthly Profit / Loss</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `$${v}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}
                fill="#3b82f6"
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Best Source by ROI */}
      {sourceRows.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Best Source by ROI</h2>
          <div className="space-y-2">
            {sourceRows.map(({ source, avgROI, totalProfit: tp, count }) => (
              <div key={source} className="flex items-center gap-3">
                <div className="w-20 text-xs text-zinc-400 shrink-0">{source}</div>
                <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${avgROI >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.abs(avgROI) / 1.5, 100)}%` }}
                  />
                </div>
                <div className="text-right shrink-0 min-w-[80px]">
                  <span className={`text-sm font-bold ${avgROI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(avgROI)}
                  </span>
                  <span className="text-xs text-zinc-600 ml-1.5">({count})</span>
                </div>
                <div className="text-xs text-zinc-500 shrink-0 w-16 text-right">{formatCurrency(tp)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loss Analysis */}
      {losers.length > 0 && (
        <div className="card border border-red-900/40">
          <h2 className="section-header mb-3 text-red-400">Loss Analysis</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-red-900/20 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-red-400">{losers.length}</div>
              <div className="text-xs text-zinc-500 mt-0.5">Cards at Loss</div>
            </div>
            <div className="bg-red-900/20 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-red-400">{formatCurrency(avgLoss)}</div>
              <div className="text-xs text-zinc-500 mt-0.5">Avg Loss</div>
            </div>
            <div className="bg-red-900/20 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-red-400">
                {soldCards.length ? ((losers.length / soldCards.length) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Loss Rate</div>
            </div>
          </div>
          {lossRows.length > 1 && (
            <div>
              <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Losses by Sport</p>
              <div className="flex gap-2 flex-wrap">
                {lossRows.map(([sport, count]) => (
                  <span key={sport} className="bg-red-900/30 text-red-300 text-xs px-2 py-1 rounded-lg">
                    {sport}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 mb-2 uppercase tracking-wider">Biggest Losses</p>
            <div className="space-y-1.5">
              {[...losers].sort((a, b) => profit(a, psaCost) - profit(b, psaCost)).slice(0, 3).map(card => (
                <div key={card.id} className="flex justify-between text-sm">
                  <span className="text-zinc-400 truncate mr-2">{card.player}</span>
                  <span className="font-semibold text-red-400 shrink-0">{formatCurrency(profit(card, psaCost))}</span>
                </div>
              ))}
            </div>
          </div>
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
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="avgROI" radius={[0, 4, 4, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform breakdown */}
      {platformChart.length > 0 && (
        <div className="card">
          <h2 className="section-header mb-3">Net Profit by Platform</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={platformChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`} labelLine={false}>
                {platformChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
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
                <div className="text-right shrink-0">
                  <span className="font-semibold text-emerald-400">{formatPercent(roi(card, psaCost))}</span>
                  <span className="text-xs text-zinc-600 ml-1.5">{formatCurrency(profit(card, psaCost))}</span>
                </div>
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
                <div className="text-right shrink-0">
                  <span className="font-semibold text-red-400">{formatPercent(roi(card, psaCost))}</span>
                  <span className="text-xs text-zinc-600 ml-1.5">{formatCurrency(profit(card, psaCost))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
