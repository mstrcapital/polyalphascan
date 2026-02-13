"""
Markets data router - provides categorized market information.

Endpoints:
- GET /data/markets - List markets by category (crypto, finance, all)
- GET /data/markets/{market_id}/stats - Get detailed market statistics
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from loguru import logger

from core.paths import GAMMA_API_BASE_URL, LIVE_DIR
from server.price_aggregation import price_aggregation

router = APIRouter()

# =============================================================================
# CONFIGURATION
# =============================================================================

CRYPTO_KEYWORDS = [
    "bitcoin", "btc", "ethereum", "eth", "crypto", "cryptocurrency",
    "blockchain", "defi", "nft", "token", "coin", "solana", "cardano",
    "polygon", "avalanche", "binance", "coinbase"
]

FINANCE_KEYWORDS = [
    "stock", "stocks", "s&p", "dow", "nasdaq", "treasury", "bond",
    "interest rate", "fed", "federal reserve", "inflation", "gdp",
    "unemployment", "recession", "bull market", "bear market", "earnings"
]

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def categorize_market(title: str, tags: List[str]) -> str:
    """
    Categorize market based on title and tags.
    
    Returns: "crypto" | "finance" | "other"
    """
    title_lower = title.lower()
    tags_lower = [t.lower() for t in tags]
    
    # Check tags first
    if "crypto" in tags_lower:
        return "crypto"
    if "finance" in tags_lower or "economy" in tags_lower:
        return "finance"
    
    # Check title keywords
    for keyword in CRYPTO_KEYWORDS:
        if keyword in title_lower:
            return "crypto"
    
    for keyword in FINANCE_KEYWORDS:
        if keyword in title_lower:
            return "finance"
    
    return "other"


async def fetch_markets_from_gamma_direct(category: str) -> List[dict]:
    """Fallback: Fetch markets directly from Gamma API if local data is missing."""
    tag_map = {
        "crypto": "crypto",
        "finance": "business", # Gamma uses business/economy for finance
        "all": "politics" # Default to politics if all
    }
    
    tag_slug = tag_map.get(category, "politics")
    url = f"{GAMMA_API_BASE_URL}/events?tag_slug={tag_slug}&limit=20&active=true"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            events = resp.json()
            
            markets = []
            for event in events:
                event_tags = [t.get("name", "") for t in event.get("tags", [])]
                for market in event.get("markets", []):
                    m_title = market.get("question", "")
                    m_cat = categorize_market(m_title, event_tags)
                    
                    markets.append({
                        "id": market.get("id"),
                        "title": m_title,
                        "category": m_cat,
                        "yes_price": 0.5, # Default for fallback
                        "no_price": 0.5,
                        "volume_24h": market.get("volume", 0),
                        "price_change_24h": 0.0,
                        "liquidity": market.get("liquidity", 0),
                        "end_date": market.get("endDate"),
                        "created_at": market.get("createdAt"),
                        "icon": event.get("icon"),
                        "slug": market.get("slug"),
                        "event_slug": event.get("slug"),
                    })
            return markets
    except Exception as e:
        logger.error(f"Fallback fetch failed: {e}")
        return []


async def fetch_market_from_gamma(market_id: str) -> Optional[dict]:
    """Fetch market details from Gamma API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{GAMMA_API_BASE_URL}/markets/{market_id}")
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to fetch market {market_id}: {e}")
        return None


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.get("/")
async def list_markets(
    category: str = Query("all", regex="^(crypto|finance|all)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query("volume", regex="^(volume|price_change|created_at)$"),
    active_only: bool = Query(True),
):
    """List markets by category with fallback to live API."""
    markets = []
    total = 0
    
    try:
        # 1. Try to load from local groups.json
        groups_file = LIVE_DIR / "groups.json"
        if groups_file.exists():
            groups_data = json.loads(groups_file.read_text())
            groups = groups_data.get("groups", [])
            live_prices = price_aggregation.get_prices()
            
            for group in groups:
                event_tags = group.get("tags", [])
                for market in group.get("markets", []):
                    if active_only and not market.get("active"):
                        continue
                    
                    m_id = market.get("id")
                    title = market.get("question", "")
                    m_cat = categorize_market(title, event_tags)
                    
                    if category != "all" and m_cat != category:
                        continue
                    
                    price_data = live_prices.get(m_id)
                    yes_price = price_data.price if price_data and price_data.price else 0.5
                    
                    markets.append({
                        "id": m_id,
                        "title": title,
                        "category": m_cat,
                        "yes_price": round(yes_price, 4),
                        "no_price": round(1 - yes_price, 4),
                        "volume_24h": market.get("volume", 0),
                        "price_change_24h": 0.0,
                        "liquidity": market.get("liquidity", 0),
                        "end_date": market.get("endDate"),
                        "created_at": market.get("createdAt"),
                        "icon": group.get("icon"),
                        "slug": market.get("slug"),
                        "event_slug": group.get("slug"),
                    })
        
        # 2. Fallback to Gamma API if no markets found locally
        if not markets:
            logger.info(f"No local markets found, falling back to Gamma API for {category}")
            markets = await fetch_markets_from_gamma_direct(category)
            
        # 3. Sort and Paginate
        if sort == "volume":
            markets.sort(key=lambda m: m.get("volume_24h", 0), reverse=True)
        elif sort == "price_change":
            markets.sort(key=lambda m: abs(m.get("price_change_24h", 0)), reverse=True)
        elif sort == "created_at":
            markets.sort(key=lambda m: m.get("created_at") or "", reverse=True)
            
        total = len(markets)
        markets = markets[offset:offset + limit]
        
        return {
            "markets": markets,
            "meta": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "category": category,
                "source": "local" if groups_file.exists() else "gamma_fallback"
            }
        }
        
    except Exception as e:
        logger.error(f"Error listing markets: {e}")
        # Return empty list instead of 500 to keep UI alive
        return {
            "markets": [],
            "meta": {"total": 0, "error": str(e)}
        }


@router.get("/{market_id}/stats")
async def get_market_stats(market_id: str):
    """Get detailed statistics for a specific market."""
    try:
        market_data = await fetch_market_from_gamma(market_id)
        if not market_data:
            raise HTTPException(status_code=404, detail="Market not found")
            
        live_prices = price_aggregation.get_prices()
        price_data = live_prices.get(market_id)
        current_price = price_data.price if price_data and price_data.price else 0.5
        
        return {
            "market_id": market_id,
            "title": market_data.get("question", ""),
            "description": market_data.get("description", ""),
            "current_price": {
                "yes": round(current_price, 4),
                "no": round(1 - current_price, 4)
            },
            "volume": market_data.get("volume", 0),
            "liquidity": market_data.get("liquidity", 0),
            "outcomes": market_data.get("outcomes", ["YES", "NO"]),
            "end_date": market_data.get("endDate"),
            "created_at": market_data.get("createdAt"),
            "closed": market_data.get("closed", False),
            "active": market_data.get("active", True),
            "clob_token_ids": json.loads(market_data.get("clobTokenIds", "[]")),
            "recent_trades": [],
            "price_history": []
        }
    except Exception as e:
        logger.error(f"Error getting market stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
