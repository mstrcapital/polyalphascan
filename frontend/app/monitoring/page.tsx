'use client'

import { useState, useCallback } from 'react'
import { getApiBaseUrl } from '@/config/api-config'

// =============================================================================
// TYPES
// =============================================================================

interface AccountSummary {
  address: string
  total_trades: number
  total_volume: number
  pnl: number
  win_rate: number
  bot_score: number
  bot_type: string | null
  bot_indicators: Record<string, boolean>
  first_trade: string | null
  last_trade: string | null
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MonitoringPage() {
  const [searchAddress, setSearchAddress] = useState('')
  const [trackedAccounts, setTrackedAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trackAccount = useCallback(async () => {
    if (!searchAddress.trim()) {
      setError('Please enter a valid address')
      return
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(searchAddress.trim())) {
      setError('Invalid Ethereum address format')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const apiBase = getApiBaseUrl()
      const response = await fetch(`${apiBase}/monitoring/accounts/${searchAddress.trim()}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No activity found for this address')
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: AccountSummary = await response.json()

      // Add to tracked accounts if not already tracked
      setTrackedAccounts(prev => {
        const exists = prev.some(acc => acc.address === data.address)
        if (exists) {
          return prev.map(acc => acc.address === data.address ? data : acc)
        }
        return [...prev, data]
      })

      setSearchAddress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account data')
      console.error('Error tracking account:', err)
    } finally {
      setLoading(false)
    }
  }, [searchAddress])

  const removeAccount = (address: string) => {
    setTrackedAccounts(prev => prev.filter(acc => acc.address !== address))
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getBotScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-rose'
    if (score >= 0.4) return 'text-amber'
    return 'text-green'
  }

  const getBotTypeLabel = (type: string | null) => {
    if (!type) return 'Human'
    const labels: Record<string, string> = {
      'arbitrage': 'Arbitrage Bot',
      'market_maker': 'Market Maker',
      'high_frequency': 'HFT Bot'
    }
    return labels[type] || type
  }

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* Header */}
      <header className="bg-surface border border-border rounded-lg p-4">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-text-primary">Account Monitoring</h1>
          <p className="text-xs text-text-muted">
            Track Polymarket accounts and detect trading bots
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter wallet address (0x...)"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && trackAccount()}
            className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded text-sm text-text-primary placeholder:text-text-muted focus:border-cyan/50 focus:outline-none"
          />
          <button
            onClick={trackAccount}
            disabled={loading}
            className="px-4 py-2 bg-cyan text-background rounded text-sm font-medium hover:bg-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Tracking...' : 'Track'}
          </button>
        </div>

        {error && (
          <div className="mt-2 text-sm text-rose">
            {error}
          </div>
        )}
      </header>

      {/* Tracked Accounts */}
      {trackedAccounts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-border rounded-lg bg-surface">
          <p className="text-sm text-text-secondary mb-1">No accounts tracked yet</p>
          <p className="text-xs text-text-muted">
            Enter a wallet address above to start monitoring
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {trackedAccounts.map((account) => (
            <div
              key={account.address}
              className="bg-surface border border-border rounded-lg p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-mono text-text-primary">
                      {formatAddress(account.address)}
                    </h3>
                    <button
                      onClick={() => navigator.clipboard.writeText(account.address)}
                      className="text-xs text-text-muted hover:text-cyan transition-colors"
                      title="Copy address"
                    >
                      📋
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      account.bot_score >= 0.5
                        ? 'bg-rose/20 text-rose'
                        : 'bg-green/20 text-green'
                    }`}>
                      {getBotTypeLabel(account.bot_type)}
                    </span>
                    <span className={`text-xs font-semibold ${getBotScoreColor(account.bot_score)}`}>
                      Bot Score: {formatPercentage(account.bot_score)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => removeAccount(account.address)}
                  className="text-xs text-text-muted hover:text-rose transition-colors"
                >
                  Remove
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-surface-elevated rounded p-3">
                  <div className="text-xs text-text-muted mb-1">Total Trades</div>
                  <div className="text-lg font-semibold text-text-primary">
                    {account.total_trades.toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface-elevated rounded p-3">
                  <div className="text-xs text-text-muted mb-1">Volume</div>
                  <div className="text-lg font-semibold text-text-primary">
                    {formatCurrency(account.total_volume)}
                  </div>
                </div>

                <div className="bg-surface-elevated rounded p-3">
                  <div className="text-xs text-text-muted mb-1">PnL</div>
                  <div className={`text-lg font-semibold ${
                    account.pnl >= 0 ? 'text-green' : 'text-rose'
                  }`}>
                    {account.pnl >= 0 ? '+' : ''}{formatCurrency(account.pnl)}
                  </div>
                </div>

                <div className="bg-surface-elevated rounded p-3">
                  <div className="text-xs text-text-muted mb-1">Win Rate</div>
                  <div className="text-lg font-semibold text-text-primary">
                    {formatPercentage(account.win_rate)}
                  </div>
                </div>
              </div>

              {/* Bot Indicators */}
              {account.bot_indicators && Object.keys(account.bot_indicators).length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs text-text-muted mb-2">Bot Indicators:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(account.bot_indicators).map(([key, value]) => (
                      value && (
                        <span
                          key={key}
                          className="text-xs px-2 py-1 bg-amber/20 text-amber rounded"
                        >
                          {key.replace(/_/g, ' ')}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div>
                    First trade: {account.first_trade 
                      ? new Date(account.first_trade).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <div>
                    Last trade: {account.last_trade
                      ? new Date(account.last_trade).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-surface-elevated border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-2">How Bot Detection Works</h3>
        <ul className="text-xs text-text-muted space-y-1">
          <li>• <strong>High Frequency:</strong> More than 10 trades per hour</li>
          <li>• <strong>Regular Intervals:</strong> Consistent time patterns between trades</li>
          <li>• <strong>Arbitrage:</strong> Quick buy-sell pairs within 1 hour</li>
          <li>• <strong>Market Maker:</strong> Balanced buy/sell ratio with high volume</li>
        </ul>
      </div>
    </div>
  )
}
