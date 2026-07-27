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
interface Misspelling {
  phrase: string        // full search phrase with the typo, e.g. "Parick mahomes"
  typoWord: string      // just the misspelled word, e.g. "parick" (lowercased)
  correctWord: string   // the correct spelling, e.g. "mahomes" (lowercased)
}

function generateMisspellings(term: string): Misspelling[] {
  const words = term.trim().split(/\s+/)

  // Target the longest word — usually the player's last name
  const targetIdx = words.reduce((best, w, i) => w.length > words[best].length ? i : best, 0)
  const word = words[targetIdx]

  if (word.length < 5) return []

  const typos = new Set<string>()

  // 1. Transpose adjacent letter pairs (most common fat-finger)
  for (let i = 0; i < word.length - 1; i++) {
    const v = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
    if (v !== word) typos.add(v)
  }

  // 2. Drop one letter
  for (let i = 1; i < word.length - 1; i++) {
    const v = word.slice(0, i) + word.slice(i + 1)
    if (v.length >= 4) typos.add(v)
  }

  // 3. Double a letter (e.g., "Mahomes" → "Mahoomes")
  for (let i = 1; i < word.length - 1; i++) {
    typos.add(word.slice(0, i) + word[i] + word[i] + word.slice(i + 1))
  }

  // 4. Common vowel swaps (a↔e, i↔e, o↔u)
  const vowelSwaps: Record<string, string> = { a: 'e', e: 'a', i: 'e', o: 'u', u: 'o' }
  for (let i = 0; i < word.length; i++) {
    const swap = vowelSwaps[word[i].toLowerCase()]
    if (swap) {
      typos.add(word.slice(0, i) + (word[i] === word[i].toUpperCase() ? swap.toUpperCase() : swap) + word.slice(i + 1))
    }
  }

  typos.delete(word)

  const correctWord = word.toLowerCase()
  return Array.from(typos).slice(0, 12).map(typo => {
    const w = [...words]
    w[targetIdx] = typo
    return { phrase: w.join(' '), typoWord: typo.toLowerCase(), correctWord }
  })
}

// ── eBay search (≥ $50, auctions only) ─────────────────────────────────────
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
  url.searchParams.set('limit', '200')

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

    // Window: now → next 72 hours
    const startUTC = new Date()
    const endUTC = new Date(startUTC.getTime() + 72 * 60 * 60 * 1000)
    const startISO = startUTC.toISOString()
    const endISO = endUTC.toISOString()

    const token = await getEbayToken()

    // Build all (term, misspelling) pairs
    const pairs: { original: string; m: Misspelling }[] = []
    for (const s of searches) {
      for (const m of generateMisspellings(s.search_term)) {
        pairs.push({ original: s.search_term, m })
      }
    }

    // Search eBay for all misspellings in parallel
    const results = await Promise.all(
      pairs.map(async ({ original, m }) => {
        try {
          const data = await searchEbay(token, m.phrase, startISO, endISO)
          return { original, m, items: data.itemSummaries ?? [], error: null as string | null }
        } catch (err: any) {
          return { original, m, items: [] as any[], error: err.message as string }
        }
      })
    )

    // Dedupe by itemId, filter to titles that ACTUALLY contain the typo.
    // eBay auto-corrects search queries, so most results spell the name
    // correctly — those are useless to us and must be discarded.
    const itemMap = new Map<string, any>()
    let totalRaw = 0
    let bidFiltered = 0
    let spellFiltered = 0
    for (const r of results) {
      totalRaw += r.items.length
      for (const item of r.items) {
        if (!item.itemId) continue

        const title = (item.title ?? '').toLowerCase()
        // Keep only if the title contains the typo AND not the correct spelling
        if (!title.includes(r.m.typoWord) || title.includes(r.m.correctWord)) {
          spellFiltered++
          continue
        }

        const bidCount = item.bidCount ?? 0
        if (bidCount < 1) { bidFiltered++; continue }

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
            originalTerm: r.original,
            misspelling: r.m.phrase,
            typoWord: r.m.typoWord,
          })
        }
      }
    }

    // Sort by ending soonest
    const items = Array.from(itemMap.values()).sort(
      (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    )

    const errors = results.filter(r => r.error).map(r => ({ misspelling: r.m.phrase, error: r.error }))

    return NextResponse.json({
      items,
      window: { start: startISO, end: endISO },
      totalMisspellings: pairs.length,
      totalRaw,
      spellFiltered,
      bidFiltered,
      finalCount: items.length,
      errors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
