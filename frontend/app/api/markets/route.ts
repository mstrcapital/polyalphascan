import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'all'
  
  // Polymarket Gamma API Mapping
  const gammaCategory = category === 'finance' ? 'business' : (category === 'crypto' ? 'crypto' : 'politics')
  const gammaUrl = `https://gamma-api.polymarket.com/events?tag_slug=${gammaCategory}&limit=40&active=true`

  console.log(`[Final-Fix] Fetching from: ${gammaUrl}`);

  try {
    const response = await fetch(gammaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 30 }
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Official API Error: ${response.status}` }, { status: response.status })
    }

    const events = await response.json()
    const markets = events.flatMap((event: any) => 
      (event.markets || []).map((m: any) => ({
        id: m.id,
        title: m.question,
        category: category,
        yes_price: 0.5,
        no_price: 0.5,
        volume_24h: parseFloat(m.volume) || 0,
        price_change_24h: 0,
        liquidity: parseFloat(m.liquidity) || 0,
        end_date: m.endDate,
        created_at: m.createdAt,
        icon: event.icon,
        slug: m.slug,
        event_slug: event.slug
      }))
    ).sort((a: any, b: any) => b.volume_24h - a.volume_24h)

    return NextResponse.json({
      markets,
      meta: { total: markets.length, category, source: 'official_gamma_direct' }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Server connection failed' }, { status: 502 })
  }
}
