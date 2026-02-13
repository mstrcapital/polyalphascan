'use client'

import { useEffect, useState, useCallback } from 'react'
import { getApiBaseUrl } from '@/config/api-config'

// =============================================================================
// TYPES
// =============================================================================

interface Market {
  id: string
  title: string
  category: string
  yes_price: number
  no_price: number
  volume_24h: number
  price_change_24h: number
  liquidity: number
  end_date: string | null
  created_at: string | null
  icon: string | null
  slug: string
  event_slug: string
}

interface MarketsResponse {
  markets: Market[]
  meta: {
    total: number
    limit: number
    offset: number
    category: string
    source?: string
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<MarketsResponse['meta'] | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  
  // Filters
  const [category, setCategory] = useState<'all' | 'crypto' | 'finance'>('all')
  const [sortBy, setSortBy] = useState<'volume' | 'price_change' | 'created_at'>('volume')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50

  const addLog = (msg: string) => {
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      addLog(`Fetching markets for category: ${category}...`)
      
      const apiBase = getApiBaseUrl()
      const params = new URLSearchParams({
        category,
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortBy,
        active_only: 'true'
      })
      
      // --- LAYER 1: API Proxy (Simplified Path) ---
      const proxyUrl = `/api/markets?${params}`
      addLog(`Layer 1: Trying simplified proxy ${proxyUrl}`)
      
      let response: Response;
      let usedSource = 'proxy';
      
      try {
        response = await fetch(proxyUrl)
        if (!response.ok) throw new Error(`Proxy status ${response.status}`)
      } catch (proxyErr) {
        addLog(`Proxy failed: ${proxyErr instanceof Error ? proxyErr.message : 'Unknown'}`)
        
        // --- LAYER 2: Direct Backend (if possible) ---
        const directBackendUrl = `http://localhost:8000/data/markets?${params}`
        addLog(`Layer 2: Trying direct backend ${directBackendUrl}`)
        try {
          response = await fetch(directBackendUrl)
          if (!response.ok) throw new Error(`Direct status ${response.status}`)
          usedSource = 'direct_backend'
        } catch (backendErr) {
          addLog(`Direct backend failed: ${backendErr instanceof Error ? backendErr.message : 'Unknown'}`)
          
          // --- LAYER 3: Official Polymarket API Fallback (Via our Proxy to avoid CORS) ---
          addLog(`Layer 3: Falling back to official Gamma API...`)
          const gammaCategory = category === 'finance' ? 'business' : (category === 'crypto' ? 'crypto' : 'politics')
          // Use a public proxy or our own backend if it was up, but since everything failed, 
          // we try the most direct reliable URL.
          // --- LAYER 3: Official Polymarket API Fallback (DEPRECATED: Use Layer 1 Server Proxy instead) ---
          addLog(`Layer 3: Browser direct access is blocked by CORS/Region. Relying on Layer 1 Server Proxy...`)
          throw new Error("Local backend and Proxy both failed. Please check Server Logs.")
          const mappedMarkets: Market[] = []
          
          events.forEach((event: any) => {
            event.markets?.forEach((m: any) => {
              mappedMarkets.push({
                id: m.id,
                title: m.question,
                category: category === 'all' ? 'other' : category,
                yes_price: 0.5,
                no_price: 0.5,
                volume_24h: m.volume || 0,
                price_change_24h: 0,
                liquidity: m.liquidity || 0,
                end_date: m.endDate,
                created_at: m.createdAt,
                icon: event.icon,
                slug: m.slug,
                event_slug: event.slug
              })
            })
          })
          
          setMarkets(mappedMarkets)
          setTotal(mappedMarkets.length)
          setMeta({ total: mappedMarkets.length, limit, offset, category, source: 'official_api_fallback' })
          addLog(`Success via Official API Fallback!`)
          setLoading(false)
          return
        }
      }
      
      const data: MarketsResponse = await response.json()
      setMarkets(data.markets)
      setTotal(data.meta.total)
      setMeta(data.meta)
      addLog(`Success via ${usedSource}! Found ${data.markets.length} markets.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch markets'
      setError(msg)
      addLog(`Critical Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [category, sortBy, offset])

  useEffect(() => {
    fetchMarkets()
  }, [fetchMarkets])

  const filteredMarkets = markets.filter(market =>
    market.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatPrice = (price: number) => `${(price * 100).toFixed(1)}%`
  
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`
    return `$${volume.toFixed(0)}`
  }

  const formatPriceChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${(change * 100).toFixed(1)}%`
  }

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in relative">
      {/* Debug Panel Toggle */}
      <button 
        onClick={() => setShowDebug(!showDebug)}
        className="absolute -top-2 right-0 text-[10px] text-text-muted hover:text-cyan transition-colors"
      >
        {showDebug ? '[ Hide Debug ]' : '[ Show Debug ]'}
      </button>

      {/* Debug Info */}
      {showDebug && (
        <div className="bg-black/80 border border-cyan/30 rounded p-2 font-mono text-[10px] text-cyan/80 max-h-32 overflow-y-auto">
          {debugInfo.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}

      {/* Header */}
      <header className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Markets</h1>
            <p className="text-xs text-text-muted">Browse crypto and finance prediction markets</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold font-mono text-cyan">{total}</span>
              <span className="text-xs text-text-muted">active markets</span>
            </div>
            {meta?.source && meta.source !== 'local' && (
              <div className="px-2 py-0.5 bg-amber/10 border border-amber/20 rounded text-[10px] text-amber animate-pulse">
                {meta.source === 'official_api_fallback' ? 'Official API Live' : 'Fallback Mode'}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Category:</span>
            <div className="flex gap-1">
              {(['all', 'crypto', 'finance'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); setOffset(0); }}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    category === cat ? 'bg-cyan text-background' : 'bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 text-sm bg-surface-elevated border border-border rounded text-text-primary"
            >
              <option value="volume">Volume</option>
              <option value="price_change">Price Change</option>
              <option value="created_at">Newest</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1 text-sm bg-surface-elevated border border-border rounded text-text-primary placeholder:text-text-muted"
            />
          </div>

          <button
            onClick={fetchMarkets}
            disabled={loading}
            className="px-3 py-1 text-sm bg-cyan/10 text-cyan rounded hover:bg-cyan/20 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Error State */}
      {error && !markets.length && (
        <div className="bg-rose/10 border border-rose rounded-lg p-4">
          <p className="text-sm text-rose">Error: {error}. Please check your connection or try again.</p>
        </div>
      )}

      {/* Markets Grid */}
      {loading && markets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin" />
            <span className="text-sm text-text-muted">Connecting to data sources...</span>
          </div>
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-text-muted">No markets found in this category.</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarkets.map((market) => (
              <div
                key={market.id}
                className="bg-surface border border-border rounded-lg p-4 hover:border-cyan/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    market.category === 'crypto' ? 'bg-amber/20 text-amber' : market.category === 'finance' ? 'bg-cyan/20 text-cyan' : 'bg-surface-elevated text-text-muted'
                  }`}>
                    {market.category}
                  </span>
                  {market.price_change_24h !== 0 && (
                    <span className={`text-xs font-mono ${market.price_change_24h >= 0 ? 'text-green' : 'text-rose'}`}>
                      {formatPriceChange(market.price_change_24h)}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-medium text-text-primary mb-3 line-clamp-2 group-hover:text-cyan transition-colors">
                  {market.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-green/5 border border-green/10 rounded p-2">
                    <div className="text-[10px] text-text-muted mb-1 uppercase">Yes</div>
                    <div className="text-lg font-semibold text-green">{formatPrice(market.yes_price)}</div>
                  </div>
                  <div className="bg-rose/5 border border-rose/10 rounded p-2">
                    <div className="text-[10px] text-text-muted mb-1 uppercase">No</div>
                    <div className="text-lg font-semibold text-rose">{formatPrice(market.no_price)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
                  <div>VOL: <span className="text-text-secondary">{formatVolume(market.volume_24h)}</span></div>
                  <div>LIQ: <span className="text-text-secondary">{formatVolume(market.liquidity)}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 text-sm bg-surface-elevated border border-border rounded text-text-primary hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-text-muted font-mono">{offset + 1} - {Math.min(offset + limit, total)} / {total}</span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 text-sm bg-surface-elevated border border-border rounded text-text-primary hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
