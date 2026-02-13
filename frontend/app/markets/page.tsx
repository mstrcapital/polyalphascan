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
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [category, setCategory] = useState<'all' | 'crypto' | 'finance'>('all')
  const [sortBy, setSortBy] = useState<'volume' | 'price_change' | 'created_at'>('volume')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const apiBase = getApiBaseUrl()
      const params = new URLSearchParams({
        category,
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortBy,
        active_only: 'true'
      })
      
      // Use the streamlined endpoint: /api/markets_data
      const response = await fetch(`${apiBase}/markets_data?${params}`)
      
      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorData.error || '';
        } catch (e) {}
        throw new Error(`HTTP ${response.status}: ${response.statusText} ${errorDetail}`)
      }
      
      const data: MarketsResponse = await response.json()
      setMarkets(data.markets)
      setTotal(data.meta.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets')
      console.error('Error fetching markets:', err)
    } finally {
      setLoading(false)
    }
  }, [category, sortBy, offset])

  useEffect(() => {
    fetchMarkets()
  }, [fetchMarkets])

  // Filter markets by search query
  const filteredMarkets = markets.filter(market =>
    market.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Format price as percentage
  const formatPrice = (price: number) => {
    return `${(price * 100).toFixed(1)}%`
  }

  // Format volume
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`
    }
    return `$${volume.toFixed(0)}`
  }

  // Format price change
  const formatPriceChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${(change * 100).toFixed(1)}%`
  }

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* Header */}
      <header className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Markets</h1>
            <p className="text-xs text-text-muted">
              Browse crypto and finance prediction markets
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-semibold font-mono text-cyan">{total}</div>
            <div className="text-xs text-text-muted">active markets</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Category:</span>
            <div className="flex gap-1">
              {(['all', 'crypto', 'finance'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat)
                    setOffset(0)
                  }}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    category === cat
                      ? 'bg-cyan text-background'
                      : 'bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Sort by:</span>
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

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1 text-sm bg-surface-elevated border border-border rounded text-text-primary placeholder:text-text-muted"
            />
          </div>

          {/* Refresh Button */}
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
      {error && (
        <div className="bg-rose/10 border border-rose rounded-lg p-4">
          <p className="text-sm text-rose">{error}</p>
        </div>
      )}

      {/* Markets Grid */}
      {loading && markets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-text-muted">Loading markets...</span>
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-text-muted">No markets found</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarkets.map((market) => (
              <div
                key={market.id}
                className="bg-surface border border-border rounded-lg p-4 hover:border-cyan/50 transition-colors cursor-pointer"
              >
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    market.category === 'crypto' 
                      ? 'bg-amber/20 text-amber'
                      : market.category === 'finance'
                      ? 'bg-cyan/20 text-cyan'
                      : 'bg-surface-elevated text-text-muted'
                  }`}>
                    {market.category}
                  </span>
                  
                  {market.price_change_24h !== 0 && (
                    <span className={`text-xs ${
                      market.price_change_24h >= 0 ? 'text-green' : 'text-rose'
                    }`}>
                      {formatPriceChange(market.price_change_24h)}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-text-primary mb-3 line-clamp-2">
                  {market.title}
                </h3>

                {/* Prices */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-green/10 rounded p-2">
                    <div className="text-xs text-text-muted mb-1">YES</div>
                    <div className="text-lg font-semibold text-green">
                      {formatPrice(market.yes_price)}
                    </div>
                  </div>
                  <div className="bg-rose/10 rounded p-2">
                    <div className="text-xs text-text-muted mb-1">NO</div>
                    <div className="text-lg font-semibold text-rose">
                      {formatPrice(market.no_price)}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div>
                    <span className="text-text-secondary">Vol:</span> {formatVolume(market.volume_24h)}
                  </div>
                  <div>
                    <span className="text-text-secondary">Liq:</span> {formatVolume(market.liquidity)}
                  </div>
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
              
              <span className="text-sm text-text-muted">
                {offset + 1} - {Math.min(offset + limit, total)} of {total}
              </span>
              
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
