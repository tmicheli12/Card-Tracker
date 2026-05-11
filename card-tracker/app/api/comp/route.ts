import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Build the best eBay search term from card data
function buildSearchTerm(player: string, year: number | null, sport: string): string {
  // player field already contains full card name (e.g. "2000 Topps Stars Kobe Bryant Walk of Fame")
  // Use it directly, trimmed to a reasonable length for eBay search
  const term = player.trim()
  // eBay search works best under ~80 chars
  return term.length > 80 ? term.substring(0, 80) : term
}

export async function POST(req: NextRequest) {
  const appId = process.env.EBAY_APP_ID
  if (!appId) {
    return NextResponse.json({ error: 'EBAY_APP_ID not configured' }, { status: 500 })
  }

  const { cardId, player, year, sport } = await req.json()
  if (!cardId || !player) {
    return NextResponse.json({ error: 'Missing cardId or player' }, { status: 400 })
  }

  const searchTerm = buildSearchTerm(player, year, sport)

  try {
    // eBay Finding API — findCompletedItems with SoldItemsOnly filter
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'keywords': searchTerm,
      'categoryId': '212',            // Sports Trading Cards
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'sortOrder': 'EndTimeSoonest',
      'paginationInput.entriesPerPage': '15',
    })

    const res = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`,
      { headers: { 'User-Agent': 'CardTracker/1.0' } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: `eBay API error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const response = data?.findCompletedItemsResponse?.[0]
    const items = response?.searchResult?.[0]?.item ?? []

    if (items.length === 0) {
      return NextResponse.json({ error: 'No sold comps found', searchTerm }, { status: 404 })
    }

    // Extract sold prices
    const prices: number[] = items
      .map((item: any) => {
        const priceStr = item?.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__']
        return priceStr ? parseFloat(priceStr) : null
      })
      .filter((p: number | null): p is number => p !== null && p > 0)

    if (prices.length === 0) {
      return NextResponse.json({ error: 'Could not parse prices', searchTerm }, { status: 404 })
    }

    const avg = prices.reduce((s, p) => s + p, 0) / prices.length
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    const today = new Date().toISOString().split('T')[0]

    // Save to Supabase
    const { error: dbError } = await supabase
      .from('cards')
      .update({
        comp_price: parseFloat(avg.toFixed(2)),
        comp_low: parseFloat(low.toFixed(2)),
        comp_high: parseFloat(high.toFixed(2)),
        comp_count: prices.length,
        comp_date: today,
      })
      .eq('id', cardId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      comp_price: parseFloat(avg.toFixed(2)),
      comp_low: parseFloat(low.toFixed(2)),
      comp_high: parseFloat(high.toFixed(2)),
      comp_count: prices.length,
      comp_date: today,
      searchTerm,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
