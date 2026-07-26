import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── eBay OAuth ─────────────────────────────────────────────────────────────
async function getEbayToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('EBAY credentials not set')

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  })
  if (!res.ok) throw new Error(`eBay OAuth failed (${res.status})`)
  const data = await res.json()
  return data.access_token
}

// ── Misspelling generator ──────────────────────────────────────────────────
// Generates likely fat-finger and typo variants for a search term.
// Focuses on the longest word (usually the last name) to keep results relevant.
function generateMisspellings(term: string): string[] {
  const results = new Set<string>()
  const words = term.trim().split(/\s+/)

  // Target the longest word — usually the player's last name
  const targetIdx = words.reduce((best, w, i) => w.length > words[best].length ? i : best, 0)
  const word = words[targetIdx]

  if (word.length < 4) return []

  function variant(misspelled: string): string {
    const w = [...words]
    w[targetIdx] = misspelled
    return w.join(' ')
  }

  // 1. Transpose adjacent letter pairs (most common fat-finger)
  for (let i = 0; i < word.length - 1; i++) {
    const v = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
    if (v !== word) results.add(variant(v))
  }

  // 2. Drop one letter
  for (let i = 1; i < word.length - 1; i++) { // skip first/last — too short usually
    const v = word.slice(0, i) + word.slice(i + 1)
    if (v.length >= 3) results.add(variant(v))
  }

  // 3. Double a letter (e.g., "Mahomes" → "Mahoomes")
  for (let i = 1; i < word.length - 1; i++) {
    const v = word.slice(0, i) + word[i] + word[i] + word.slice(i + 1)
    results.add(variant(v))
  }

  // 4. Common vowel swaps (a↔e, i↔e, o↔u)
  const vowelSwaps: Record<string, string> = { a: 'e', e: 'a', i: 'e', o: 'u', u: 'o' }
  for (let i = 0; i < word.length; i++) {
    const swap = vowelSwaps[word[i].toLowerCase()]
    if (swap) {
      const v = word.slice(0, i) + (word[i] === word[i].toUpperCase() ? swap.toUpperCase() : swap) + word.slice(i + 1)
      results.add(variant(v))
    }
  }

  // Exclude the original term and cap total
  results.delete(term)
  return Array.from(results).slice(0, 12)
}

// ── eBay search (no price floor, no bid requirement) ───────────────────────
async function searchEbay(token: string, term: string, startISO: string, endISO: string) {
  const filter = [
    'buyingOptions:{AUCTION}',
    `itemEndDate:[${startISO}..${endISO}]`,
  ].join(',')

  const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search')
  url.searchParams.set('q', term)
  url.searchParams.set('filter', filter)
  url.searchParams.set('sort', 'endingSoonest')
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
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
      return NextResponse.json({ items: [], message: 'No search terms configured' })
    }

    // Window: now → next 24 hours
    const startUTC = new Date()
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
    const startISO = startUTC.toISOString()
    const endISO = endUTC.toISOString()

    const token = await getEbayToken()

    // Build all (term, misspelling) pairs
    const pairs: { original: string; misspelling: string }[] = []
    for (const s of searches) {
      const variants = generateMisspellings(s.search_term)
      for (const v of variants) {
        pairs.push({ original: s.search_term, misspelling: v })
      }
    }

    // Search eBay for all misspellings in parallel
    const results = await Promise.all(
      pairs.map(async ({ original, misspelling }) => {
        try {
          const data = await searchEbay(token, misspelling, startISO, endISO)
          return { original, misspelling, items: data.itemSummaries ?? [], error: null as string | null }
        } catch (err: any) {
          return { original, misspelling, items: [] as any[], error: err.message as string }
        }
      })
    )

    // Dedupe by itemId, collect matched misspellings per item
    const itemMap = new Map<string, any>()
    let totalRaw = 0
    for (const r of results) {
      totalRaw += r.items.length
      for (const item of r.items) {
        if (!item.itemId) continue
        if (!itemMap.has(item.itemId)) {
          itemMap.set(item.itemId, {
            itemId: item.itemId,
            title: item.title,
            currentPrice: item.currentBidPrice?.value ?? item.price?.value,
            currency: item.currentBidPrice?.currency ?? item.price?.currency ?? 'USD',
            bidCount: item.bidCount ?? 0,
            endDate: item.itemEndDate,
            url: item.itemWebUrl,
            imageUrl: item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl,
            originalTerm: r.original,
            misspelling: r.misspelling,
          })
        }
      }
    }

    // Sort by ending soonest
    const items = Array.from(itemMap.values()).sort(
      (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    )

    const errors = results.filter(r => r.error).map(r => ({ misspelling: r.misspelling, error: r.error }))

    return NextResponse.json({
      items,
      window: { start: startISO, end: endISO },
      totalMisspellings: pairs.length,
      totalRaw,
      finalCount: items.length,
      errors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
