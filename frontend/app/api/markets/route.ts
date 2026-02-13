import { NextRequest, NextResponse } from 'next/server'

/**
 * Polymarket Official API Endpoints
 */
const GAMMA_API_URL = 'https://gamma-api.polymarket.com/events'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'all'
  
  // 1. Map frontend categories to Polymarket Tag IDs or Slugs
  // Based on Polymarket Discovery: 21 is often Crypto, 2 is Politics/Business
  const tagMapping: Record<string, string> = {
    'crypto': '21',
    'finance': 'business', // Some use slugs, some use IDs
    'all': ''
  }

  const gammaUrl = new URL(GAMMA_API_URL)
  gammaUrl.searchParams.set('active', 'true')
  gammaUrl.searchParams.set('closed', 'false')
  gammaUrl.searchParams.set('limit', '50')
  
  if (category === 'crypto') {
    gammaUrl.searchParams.set('tag_id', '21')
  } else if (category === 'finance') {
    gammaUrl.searchParams.set('tag_slug', 'business')
  }

  console.log(`[Official-API-Proxy] Fetching: ${gammaUrl.toString()}`);

  try {
    const response = await fetch(gammaUrl.toString(), {
      headers: {
        'User-Agent': 'Polyalphascan/1.0 (https://polyalphascan.vercel.app)',
        'Accept': 'application/json',
      },
      next: { revalidate: 30 } // Cache for 30 seconds
    })

    if (!response.ok) {
      console.error(`[Official-API-Proxy] Gamma API Error: ${response.status}`);
      return NextResponse.json(
        { error: `Polymarket API Error: ${response.status}`, region_blocked: response.status === 403 },
        { status: response.status }
      )
    }

    const events = await response.json()
    
    // 2. Standardize data structure based on official "Event -> Market" model
    const markets = events.flatMap((event: any) => {
      return (event.markets || []).map((m: any) => {
        // Parse outcomes and prices (official format is stringified JSON)
        let yesPrice = 0.5
        let noPrice = 0.5
        try {
          const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices
          if (Array.isArray(prices) && prices.length >= 2) {
            yesPrice = parseFloat(prices[0])
            noPrice = parseFloat(prices[1])
          }
        } catch (e) {
          // Fallback to 0.5 if price parsing fails
        }

        return {
          id: m.id,
          title: m.question || event.title,
          category: category,
          yes_price: yesPrice,
          no_price: noPrice,
          volume_24h: parseFloat(m.volume) || 0,
          price_change_24h: 0,
          liquidity: parseFloat(m.liquidity) || 0,
          end_date: m.endDate,
          created_at: m.createdAt,
          icon: event.icon || m.icon,
          slug: m.slug,
          event_slug: event.slug
        }
      })
    }).sort((a: any, b: any) => b.volume_24h - a.volume_24h)

    return NextResponse.json({
      markets,
      meta: {
        total: markets.length,
        category,
        source: 'official_gamma_standard',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[Official-API-Proxy] Critical Failure:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Polymarket API' },
      { status: 502 }
    )
  }
}
