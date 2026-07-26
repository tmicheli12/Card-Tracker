'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface SnipeItem {
  itemId: string
  title: string
  currentPrice: string
  currency: string
  bidCount: number
  endDate: string
  url: string
  imageUrl?: string
  matchedTerms?: string[]
  originalTerm?: string
  misspelling?: string
}

interface SnipeSearch {
  id: string
  search_term: string
  enabled: boolean
}

export default function SnipePage() {
  const [activeTab, setActiveTab] = useState<'snipe' | 'fatfinger'>('snipe')

  return (
    <div>
      <h1 className="page-title mb-4">Snipe Tool</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
        <button
          onClick={() => setActiveTab('snipe')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'snipe'
              ? 'bg-blue-600 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          🎯 Snipe
        </button>
        <button
          onClick={() => setActiveTab('fatfinger')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'fatfinger'
              ? 'bg-violet-600 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          🔤 Fat Finger
        </button>
      </div>

      {activeTab === 'snipe' ? <SnipeTab /> : <FatFingerTab />}
    </div>
  )
}

// ── Snipe Tab ──────────────────────────────────────────────────────────────
function SnipeTab() {
  const [searches, setSearches] = useState<SnipeSearch[]>([])
  const [items, setItems] = useState<SnipeItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [newTerm, setNewTerm] = useState('')
  const [showSearches, setShowSearches] = useState(false)
  const [windowInfo, setWindowInfo] = useState<{ start: string; end: string; dateLabel: string } | null>(null)
  const [errors, setErrors] = useState<{ term: string; error: string }[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<any | null>(null)
  const [showDiag, setShowDiag] = useState(false)

  const loadSearches = useCallback(async () => {
    const { data } = await supabase.from('snipe_searches').select('*').order('search_term')
    setSearches(data ?? [])
  }, [])

  useEffect(() => { loadSearches() }, [loadSearches])

  async function refresh() {
    setRefreshing(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/snipe', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Unknown error')
      } else {
        setItems(data.items ?? [])
        setWindowInfo(data.window ?? null)
        setErrors(data.errors ?? [])
        setDiagnostics(data.diagnostics ?? null)
        setLastRefresh(new Date())
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    }
    setRefreshing(false)
  }

  async function addSearch() {
    const t = newTerm.trim()
    if (!t) return
    const { error } = await supabase.from('snipe_searches').insert({ search_term: t, enabled: true })
    if (error) { alert(`Add failed: ${error.message}`); return }
    setNewTerm('')
    loadSearches()
  }

  async function removeSearch(id: string) {
    const { error } = await supabase.from('snipe_searches').delete().eq('id', id)
    if (error) { alert(`Remove failed: ${error.message}`); return }
    loadSearches()
  }

  async function toggleSearch(id: string, enabled: boolean) {
    const { error } = await supabase.from('snipe_searches').update({ enabled: !enabled }).eq('id', id)
    if (error) { alert(`Toggle failed: ${error.message}`); return }
    loadSearches()
  }

  const enabledCount = searches.filter(s => s.enabled).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={refresh}
          disabled={refreshing || enabledCount === 0}
          className="btn-primary w-auto px-4 py-2 text-sm disabled:opacity-40 ml-auto"
        >
          {refreshing ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Window info banner */}
      <div className="card mb-3 text-sm">
        <p className="text-zinc-300">
          🎯 Auctions ending <strong className="text-blue-400">12 AM – 6 AM CT</strong>
          {windowInfo && <span className="text-zinc-500"> on {windowInfo.dateLabel}</span>}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Filtered to: <span className="text-zinc-400">≥ 1 bid</span> · <span className="text-zinc-400">≥ $50</span> · <span className="text-zinc-400">{enabledCount} search term{enabledCount !== 1 ? 's' : ''} active</span>
        </p>
        {lastRefresh && (
          <p className="text-xs text-zinc-600 mt-1">Last refreshed {lastRefresh.toLocaleTimeString()}</p>
        )}
      </div>

      {/* Search terms management */}
      <div className="card mb-4">
        <button onClick={() => setShowSearches(s => !s)} className="flex items-center justify-between w-full text-left">
          <span className="section-header mb-0">Search Terms ({enabledCount} of {searches.length} active)</span>
          <span className="text-zinc-500 text-xs">{showSearches ? '▲ Hide' : '▼ Manage'}</span>
        </button>
        {showSearches && (
          <div className="mt-3 space-y-1.5">
            {searches.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <input type="checkbox" checked={s.enabled} onChange={() => toggleSearch(s.id, s.enabled)} className="w-4 h-4 accent-blue-500" />
                <span className={`flex-1 text-sm ${s.enabled ? 'text-zinc-200' : 'text-zinc-500 line-through'}`}>{s.search_term}</span>
                <button onClick={() => removeSearch(s.id)} className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1">✕</button>
              </div>
            ))}
            <div className="flex gap-2 pt-3 border-t border-zinc-800 mt-3">
              <input
                className="input flex-1 text-sm"
                placeholder="Add search term..."
                value={newTerm}
                onChange={e => setNewTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSearch() }}
              />
              <button onClick={addSearch} className="btn-secondary text-xs px-3" disabled={!newTerm.trim()}>+ Add</button>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="card mb-3 border border-red-900/50 bg-red-900/20 text-sm text-red-300">
          <p className="font-semibold">Refresh failed</p>
          <p className="text-xs mt-1 text-red-400 break-all">{errorMsg}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="card mb-3 border border-amber-900/40 bg-amber-900/20 text-xs">
          <p className="text-amber-300 font-semibold mb-1">{errors.length} search{errors.length > 1 ? 'es' : ''} failed:</p>
          <ul className="text-amber-400/80 space-y-0.5">
            {errors.map(e => <li key={e.term}><strong>{e.term}:</strong> {e.error.substring(0, 120)}</li>)}
          </ul>
        </div>
      )}

      {diagnostics && (
        <div className="card mb-3 text-xs">
          <button onClick={() => setShowDiag(s => !s)} className="flex items-center justify-between w-full">
            <span className="text-zinc-500">
              {diagnostics.totalRawItems} raw → {diagnostics.totalBidFiltered} no-bid filtered → {diagnostics.finalCount} after dedup
            </span>
            <span className="text-zinc-600">{showDiag ? '▲' : '▼'} per-search</span>
          </button>
          {showDiag && (
            <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
              {diagnostics.perSearch.map((s: any) => (
                <div key={s.term} className="flex justify-between text-zinc-500">
                  <span className="truncate">{s.term}</span>
                  <span className="text-zinc-400 shrink-0 ml-2">{s.raw} of {s.total} eBay match</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!lastRefresh ? (
        <div className="card text-center py-10 text-zinc-500">
          {enabledCount === 0 ? 'Add at least one search term above, then click Refresh.' : "Click 🔄 Refresh to load tonight's auctions."}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-10 text-zinc-500">No auctions match the criteria right now. Try refreshing later.</div>
      ) : (
        <div>
          <p className="text-xs text-zinc-500 mb-2">
            Showing <strong className="text-zinc-300">{items.length}</strong> auction{items.length !== 1 ? 's' : ''} ending in the target window
          </p>
          <div className="space-y-2">
            {items.map(item => <SnipeRow key={item.itemId} item={item} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fat Finger Tab ─────────────────────────────────────────────────────────
function FatFingerTab() {
  const [items, setItems] = useState<SnipeItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ totalMisspellings: number; totalRaw: number; finalCount: number } | null>(null)

  async function refresh() {
    setRefreshing(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/fat-finger', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Unknown error')
      } else {
        setItems(data.items ?? [])
        setMeta({ totalMisspellings: data.totalMisspellings, totalRaw: data.totalRaw, finalCount: data.finalCount })
        setLastRefresh(new Date())
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    }
    setRefreshing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={refresh}
          disabled={refreshing}
          className="btn-primary w-auto px-4 py-2 text-sm disabled:opacity-40"
          style={{ background: refreshing ? undefined : 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
        >
          {refreshing ? '⏳ Scanning...' : '🔤 Scan for Typos'}
        </button>
      </div>

      {/* Info banner */}
      <div className="card mb-4 text-sm">
        <p className="text-zinc-300">
          🔤 Searches eBay for <strong className="text-violet-400">misspelled listings</strong> of your search terms
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Generates transpositions, dropped letters, doubled letters, and vowel swaps · Auctions ending in the next <strong className="text-zinc-400">24 hours</strong> · Sorted by ending soonest
        </p>
        {lastRefresh && meta && (
          <p className="text-xs text-zinc-600 mt-1">
            Last scan {lastRefresh.toLocaleTimeString()} · {meta.totalMisspellings} variants searched · {meta.totalRaw} raw results → {meta.finalCount} unique
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="card mb-3 border border-red-900/50 bg-red-900/20 text-sm text-red-300">
          <p className="font-semibold">Scan failed</p>
          <p className="text-xs mt-1 text-red-400 break-all">{errorMsg}</p>
        </div>
      )}

      {!lastRefresh ? (
        <div className="card text-center py-10 text-zinc-500">
          <p className="text-2xl mb-2">🔤</p>
          <p>Click <strong className="text-zinc-300">Scan for Typos</strong> to find misspelled listings.</p>
          <p className="text-xs mt-2 text-zinc-600">Uses your Snipe search terms — no setup needed.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-10 text-zinc-500">No misspelled listings found right now. Try again later.</div>
      ) : (
        <div>
          <p className="text-xs text-zinc-500 mb-2">
            <strong className="text-zinc-300">{items.length}</strong> misspelled listing{items.length !== 1 ? 's' : ''} found · ending soonest first
          </p>
          <div className="space-y-2">
            {items.map(item => <FatFingerRow key={item.itemId} item={item} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared Row Components ──────────────────────────────────────────────────
function SnipeRow({ item }: { item: SnipeItem }) {
  const endDate = new Date(item.endDate)
  const now = new Date()
  const msLeft = endDate.getTime() - now.getTime()
  const totalMins = Math.max(0, Math.floor(msLeft / 60000))
  const hoursLeft = Math.floor(totalMins / 60)
  const minsLeft = totalMins % 60

  const endsCT = endDate.toLocaleString('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
  })

  const urgency = msLeft < 30 * 60 * 1000 ? 'text-red-400' : msLeft < 2 * 60 * 60 * 1000 ? 'text-amber-400' : 'text-blue-400'

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="card-hover block">
      <div className="flex items-start gap-3">
        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 bg-zinc-800" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
            <span className="text-emerald-400 font-bold">${item.currentPrice}</span>
            <span className="text-zinc-500 text-xs">{item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}</span>
            <span className="text-zinc-500 text-xs">Ends {endsCT} CT</span>
            <span className={`${urgency} text-xs font-semibold`}>in {hoursLeft}h {minsLeft}m</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1 truncate">matched: {item.matchedTerms?.join(' · ')}</p>
        </div>
      </div>
    </a>
  )
}

function FatFingerRow({ item }: { item: SnipeItem }) {
  const endDate = new Date(item.endDate)
  const now = new Date()
  const msLeft = endDate.getTime() - now.getTime()
  const totalMins = Math.max(0, Math.floor(msLeft / 60000))
  const hoursLeft = Math.floor(totalMins / 60)
  const minsLeft = totalMins % 60

  const endsCT = endDate.toLocaleString('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true,
  })

  const urgency = msLeft < 30 * 60 * 1000 ? 'text-red-400' : msLeft < 2 * 60 * 60 * 1000 ? 'text-amber-400' : 'text-violet-400'

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="card-hover block">
      <div className="flex items-start gap-3">
        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0 bg-zinc-800" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
            <span className="text-emerald-400 font-bold">${item.currentPrice}</span>
            <span className="text-zinc-500 text-xs">{item.bidCount} bid{item.bidCount !== 1 ? 's' : ''}</span>
            <span className="text-zinc-500 text-xs">Ends {endsCT} CT</span>
            <span className={`${urgency} text-xs font-semibold`}>in {hoursLeft}h {minsLeft}m</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-violet-900/40 text-violet-400 px-1.5 py-0.5 rounded font-mono">
              {item.misspelling}
            </span>
            <span className="text-[10px] text-zinc-600">for "{item.originalTerm}"</span>
          </div>
        </div>
      </div>
    </a>
  )
}
