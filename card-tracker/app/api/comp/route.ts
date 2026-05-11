import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function buildSearchTerm(player: string): string {
  const term = player.trim()
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

  const searchTerm = buildSearchTerm(player)

  try {
    // Build query string manually — URLSearchParams encodes () which breaks eBay's itemFilter syntax
    const base = [
      `OPERATION-NAME=findCompletedItems`,
      `SERVICE-VERSION=1.0.0`,
      `SECURITY-APPNAME=${encodeURIComponent(appId)}`,
      `RESPONSE-DATA-FORMAT=JSON`,
      `keywords=${encodeURIComponent(searchTerm)}`,
      `itemFilter(0).name=SoldItemsOnly`,
      `itemFilter(0).value=true`,
      `sortOrder=EndTimeSoonest`,
      `paginationInput.entriesPerPage=15`,
    ].join('&')

    const url = `https://svcs.ebay.com/services/search/FindingService/v1?${base}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CardTracker/1.0)',
        'Accept': 'application/json',
      },
    })

    const rawText = await res.text()

    if (!res.ok) {
      // Return the eBay error body so we can debug it
      return NextResponse.json(
        { error: `eBay API error: ${res.status}`, detail: rawText.substring(0, 500) },
        { status: 502 }
      )
    }

    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'eBay returned non-JSON', detail: rawText.substring(0, 300) }, { status: 502 })
    }

    const response = data?.findCompletedItemsResponse?.[0]
    const ackValue = response?.ack?.[0]

    if (ackValue === 'Failure') {
      const errMsg = response?.errorMessage?.[0]?.error?.[0]?.message?.[0] ?? 'Unknown eBay error'
      return NextResponse.json({ error: errMsg }, { status: 502 })
    }

    const items = response?.searchResult?.[0]?.item ?? []

    if (items.length === 0) {
      return NextResponse.json({ error: 'No sold comps found on eBay', searchTerm }, { status: 404 })
    }

    // Extract sold prices
    const prices: number[] = items
      .map((item: any) => {
        const priceStr = item?.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__']
        return priceStr ? parseFloat(priceStr) : null
      })
      .filter((p: number | null): p is number => p !== null && p > 0)

    if (prices.length === 0) {
      return NextResponse.json({ error: 'Could not parse prices from results', searchTerm }, { status: 404 })
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
