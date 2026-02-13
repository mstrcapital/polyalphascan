"""
Markets data router - provides categorized market information.

Endpoints:
- GET /markets - List markets by category (crypto, finance, all)
- GET /markets/{market_id}/stats - Get detailed market statistics
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


def calculate_price_change(
    current_price: float,
    history: List[dict]
) -> Optional[float]:
    """Calculate 24h price change."""
    if not history:
        return None
    
    # Find price 24h ago
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    
    for entry in reversed(history):
        ts = datetime.fromtimestamp(entry["timestamp"], tz=timezone.utc)
        if ts <= day_ago:
            old_price = entry.get("yes", 0.5)
            return current_price - old_price
    
    return None


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.get("/markets")
async def list_markets(
    category: str = Query("all", regex="^(crypto|finance|all)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query("volume", regex="^(volume|price_change|created_at)$"),
    active_only: bool = Query(True),
):
    """
    List markets by category.
    
    Args:
        category: Filter by category (crypto, finance, all)
        limit: Number of results to return
        offset: Pagination offset
        sort: Sort field (volume, price_change, created_at)
        active_only: Only return active markets
    
    Returns:
        {
            "markets": [...],
            "meta": {
                "total": int,
                "limit": int,
                "offset": int,
                "category": str
            }
        }
    """
    try:
        # Load events from live data
        events_file = LIVE_DIR / "events.json"
        if not events_file.exists():
            return {
                "markets": [],
                "meta": {
                    "total": 0,
                    "limit": limit,
                    "offset": offset,
                    "category": category
                }
            }
        
        events = json.loads(events_file.read_text())
        
        # Get live prices
        live_prices = price_aggregation.get_prices()
        
        # Extract and categorize markets
        markets = []
        for event in events:
            event_tags = event.get("tags", [])
            
            for market in event.get("markets", []):
                if active_only and not market.get("active"):
                    continue
                
                market_id = market.get("id")
                title = market.get("question", "")
                
                # Categorize
                market_category = categorize_market(title, event_tags)
                
                # Filter by category
                if category != "all" and market_category != category:
                    continue
                
                # Get live price
                price_data = live_prices.get(market_id)
                yes_price = price_data.price if price_data and price_data.price else 0.5
                no_price = 1 - yes_price
                
                # Parse outcome prices for volume estimation
                outcome_prices = market.get("outcomePrices", [0.5, 0.5])
                if isinstance(outcome_prices, str):
                    outcome_prices = json.loads(outcome_prices)
                
                # Estimate volume (placeholder - would need historical data)
                volume_24h = market.get("volume", 0)
                
                markets.append({
                    "id": market_id,
                    "title": title,
                    "category": market_category,
                    "yes_price": round(yes_price, 4),
                    "no_price": round(no_price, 4),
                    "volume_24h": volume_24h,
                    "price_change_24h": 0.0,  # Placeholder
                    "liquidity": market.get("liquidity", 0),
                    "end_date": market.get("endDate"),
                    "created_at": market.get("createdAt"),
                    "icon": event.get("icon"),
                    "slug": market.get("slug"),
                    "event_slug": event.get("slug"),
                })
        
        # Sort
        if sort == "volume":
            markets.sort(key=lambda m: m["volume_24h"], reverse=True)
        elif sort == "price_change":
            markets.sort(key=lambda m: abs(m["price_change_24h"]), reverse=True)
        elif sort == "created_at":
            markets.sort(key=lambda m: m["created_at"] or "", reverse=True)
        
        # Paginate
        total = len(markets)
        markets = markets[offset:offset + limit]
        
        return {
            "markets": markets,
            "meta": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "category": category
            }
        }
    
    except Exception as e:
        logger.error(f"Error listing markets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/markets/{market_id}/stats")
async def get_market_stats(market_id: str):
    """
    Get detailed statistics for a specific market.
    
    Returns:
        {
            "market_id": str,
            "title": str,
            "current_price": float,
            "volume_24h": float,
            "recent_trades": [...],
            "price_history": [...]
        }
    """
    try:
        # Fetch market details from Gamma API
        market_data = await fetch_market_from_gamma(market_id)
        
        if not market_data:
            raise HTTPException(status_code=404, detail="Market not found")
        
        # Get current price
        live_prices = price_aggregation.get_prices()
        price_data = live_prices.get(market_id)
        current_price = price_data.price if price_data and price_data.price else 0.5
        
        # Parse outcome prices
        outcome_prices = market_data.get("outcomePrices", "[0.5, 0.5]")
        if isinstance(outcome_prices, str):
            outcome_prices = json.loads(outcome_prices)
        
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
            "recent_trades": [],  # Placeholder - would need CLOB API
            "price_history": []   # Placeholder - would need historical data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting market stats for {market_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
