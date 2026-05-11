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

// Extract dollar amounts from HTML — works across different site layouts
function parsePrices(html: string): number[] {
  const prices: number[] = []

  // Match patterns like $67.00, $1,234.56, $45
  const regex = /\$\s*([\d,]+(?:\.\d{1,2})?)/g
  let match

  while ((match = regex.exec(html)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''))
    // Filter out obviously wrong values (shipping costs, fees, etc.)
    if (val >= 1 && val <= 100000) {
      prices.push(val)
    }
  }

  return prices
}

// Remove duplicates and outliers (keep middle 80%)
function cleanPrices(prices: number[]): number[] {
  if (prices.length <= 2) return prices
  const sorted = [...prices].sort((a, b) => a - b)
  const cutLow = Math.floor(sorted.length * 0.1)
  const cutHigh = Math.ceil(sorted.length * 0.9)
  return sorted.slice(cutLow, cutHigh)
}

async function fetch130point(searchTerm: string): Promise<number[]> {
  const url = `https://www.130point.com/sales/?itemTitle=${encodeURIComponent(searchTerm)}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Referer': 'https://www.130point.com/',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`130point returned ${res.status}`)

  const html = await res.text()

  // 130point shows prices inside table cells / divs with dollar amounts
  // Focus on the sales results section — look for prices near "sold" context
  // Remove script/style blocks first to avoid false matches
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  return parsePrices(cleaned)
}

async function fetchEbayHtml(searchTerm: string): Promise<number[]> {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}&LH_Sold=1&LH_Complete=1&_sop=13`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) throw new Error(`eBay returned ${res.status}`)

  const html = await res.text()

  // eBay sold prices appear in spans with class s-item__price after "Sold" text
  // Extract prices near sold indicators
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // eBay wraps sold prices in specific patterns — look for spans near sold items
  const soldSection = cleaned.match(/s-item__price[\s\S]{0,200}/g) ?? []
  const pricesFromSold = soldSection.flatMap(chunk => parsePrices(chunk))

  // Fallback to all prices if specific extraction fails
  return pricesFromSold.length >= 3 ? pricesFromSold : parsePrices(cleaned)
}

export async function POST(req: NextRequest) {
  const { cardId, player } = await req.json()
  if (!cardId || !player) {
    return NextResponse.json({ error: 'Missing cardId or player' }, { status: 400 })
  }

  const searchTerm = buildSearchTerm(player)

  try {
    let rawPrices: number[] = []
    let source = ''

    // Try 130point first, fall back to eBay HTML
    try {
      rawPrices = await fetch130point(searchTerm)
      source = '130point'
    } catch (err: any) {
      console.log('130point failed:', err.message, '— trying eBay HTML')
      try {
        rawPrices = await fetchEbayHtml(searchTerm)
        source = 'eBay'
      } catch (ebayErr: any) {
        return NextResponse.json(
          { error: 'Both 130point and eBay are unreachable', detail: ebayErr.message },
          { status: 502 }
        )
      }
    }

    const prices = cleanPrices(rawPrices)

    if (prices.length < 2) {
      return NextResponse.json(
        { error: `No sold comps found for "${searchTerm}"`, searchTerm },
        { status: 404 }
      )
    }

    const avg = prices.reduce((s, p) => s + p, 0) / prices.length
    const low = Math.min(...prices)
    const high = Math.max(...prices)
    const today = new Date().toISOString().split('T')[0]

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
      source,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
