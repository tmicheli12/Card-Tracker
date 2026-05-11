import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── eBay OAuth (Client Credentials) ────────────────────────────────────────
async function getEbayToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set in Vercel env vars')
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=' +
          encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`eBay OAuth failed (${res.status}): ${text.substring(0, 300)}`)
  }

  const data = await res.json()
  return data.access_token
}

// ── CT window calculation ──────────────────────────────────────────────────
// Returns the next upcoming 12 AM – 6 AM CT window in UTC.
function getCTWindowInUTC(): { startUTC: Date; endUTC: Date; dateLabel: string } {
  const now = new Date()
  const ctDateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' }).format(now)
  const ctHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(now)
  )

  // If past 6 AM CT, look at tomorrow's window. Else today's (we're still inside it).
  let targetDateStr = ctDateStr
  if (ctHour >= 6) {
    const d = new Date(ctDateStr + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    targetDateStr = d.toISOString().split('T')[0]
  }

  // Determine the UTC offset for CT at target date (handles DST)
  const probe = new Date(targetDateStr + 'T12:00:00Z')
  const probeCtHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(probe)
  )
  const offsetHours = 12 - probeCtHour // 5 (CDT) or 6 (CST)

  const pad = (n: number) => n.toString().padStart(2, '0')
  const startUTC = new Date(`${targetDateStr}T${pad(offsetHours)}:00:00.000Z`)
  const endUTC = new Date(`${targetDateStr}T${pad(offsetHours + 6)}:00:00.000Z`)

  return { startUTC, endUTC, dateLabel: targetDateStr }
}

// ── eBay Browse API search ─────────────────────────────────────────────────
async function searchEbay(token: string, term: string, startISO: string, endISO: string) {
  const filter = [
    'buyingOptions:{AUCTION}',
    'price:[50..]',
    'priceCurrency:USD',
    `itemEndDate:[${startISO}..${endISO}]`,
  ].join(',')

  const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search')
  url.searchParams.set('q', term)
  url.searchParams.set('filter', filter)
  url.searchParams.set('sort', 'endingSoonest')
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text.substring(0, 200)}`)
  }
  return await res.json()
}

// ── Handler ────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    const { data: searches, error: dbErr } = await supabase
      .from('snipe_searches')
      .select('*')
      .eq('enabled', true)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    if (!searches || searches.length === 0) {
      return NextResponse.json({
        items: [],
        message: 'No search terms configured — add some on the Snipe page',
      })
    }

    const { startUTC, endUTC, dateLabel } = getCTWindowInUTC()
    const startISO = startUTC.toISOString()
    const endISO = endUTC.toISOString()

    const token = await getEbayToken()

    const results = await Promise.all(
      searches.map(async (s) => {
        try {
          const data = await searchEbay(token, s.search_term, startISO, endISO)
          return { term: s.search_term, items: data.itemSummaries ?? [], error: null as string | null }
        } catch (err: any) {
          return { term: s.search_term, items: [] as any[], error: err.message as string }
        }
      })
    )

    // Combine, dedupe by itemId, filter to items with ≥1 bid
    const itemMap = new Map<string, any>()
    for (const r of results) {
      for (const item of r.items) {
        if (!item.itemId) continue
        const bidCount = item.bidCount ?? 0
        if (bidCount < 1) continue

        if (!itemMap.has(item.itemId)) {
          itemMap.set(item.itemId, {
            itemId: item.itemId,
            title: item.title,
            currentPrice: item.currentBidPrice?.value ?? item.price?.value,
            currency: item.currentBidPrice?.currency ?? item.price?.currency ?? 'USD',
            bidCount,
            endDate: item.itemEndDate,
            url: item.itemWebUrl,
            imageUrl: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl,
            matchedTerms: [r.term],
          })
        } else {
          itemMap.get(item.itemId).matchedTerms.push(r.term)
        }
      }
    }

    const items = Array.from(itemMap.values()).sort(
      (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    )

    return NextResponse.json({
      items,
      window: { start: startISO, end: endISO, dateLabel },
      errors: results.filter((r) => r.error).map((r) => ({ term: r.term, error: r.error })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
