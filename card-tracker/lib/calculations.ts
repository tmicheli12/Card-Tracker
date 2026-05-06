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

export function roi(card: Card, psaCost: number): number {
  const cost = totalCost(card, psaCost)
  if (cost === 0) return 0
  return (profit(card, psaCost) / cost) * 100
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    owned: 'Owned',
    at_grader: 'At PSA',
    graded: 'Graded',
    sold: 'Sold',
    collection: 'Collection',
  }
  return labels[status] ?? status
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    owned: 'bg-blue-100 text-blue-800',
    at_grader: 'bg-purple-100 text-purple-800',
    graded: 'bg-green-100 text-green-800',
    sold: 'bg-gray-100 text-gray-600',
    collection: 'bg-amber-100 text-amber-800',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-600'
}
