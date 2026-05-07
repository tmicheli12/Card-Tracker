import { Card } from '@/types/card'

export function totalCost(card: Card, psaCost: number): number {
  const base = card.purchase_price + (card.purchase_fees ?? 0)
  return card.strategy === 'grade' ? base + psaCost : base
}

export function netSale(card: Card): number {
  if (!card.sale_price) return 0
  return card.sale_price - (card.sale_fees ?? 0) - (card.sale_shipping ?? 0)
}

export function profit(card: Card, psaCost: number): number {
  if (!card.sale_price) return 0
  return netSale(card) - totalCost(card, psaCost)
}

export function roi(card: Card, psaCost: number): number | null {
  const cost = totalCost(card, psaCost)
  if (cost === 0) return null
  return (profit(card, psaCost) / cost) * 100
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    owned:      'Owned',
    at_grader:  'At PSA',
    graded:     'Graded',
    sold:       'Sold',
    collection: 'Collection',
  }
  return labels[status] ?? status
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    owned:      'bg-blue-900/50 text-blue-300',
    at_grader:  'bg-violet-900/50 text-violet-300',
    graded:     'bg-emerald-900/50 text-emerald-300',
    sold:       'bg-zinc-800 text-zinc-400',
    collection: 'bg-amber-900/50 text-amber-300',
  }
  return colors[status] ?? 'bg-zinc-800 text-zinc-400'
}
