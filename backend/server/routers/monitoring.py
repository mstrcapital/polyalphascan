"""
Account monitoring router - track Polymarket accounts and detect bots.

Endpoints:
- GET /monitoring/accounts/{address} - Get account summary
- GET /monitoring/accounts/{address}/activity - Get account activity
- GET /monitoring/bots/leaderboard - Get bot leaderboard
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from loguru import logger

router = APIRouter()

# =============================================================================
# CONFIGURATION
# =============================================================================

POLYMARKET_DATA_API = "https://data-api.polymarket.com"
REQUEST_TIMEOUT = 30.0

# Bot detection thresholds
BOT_THRESHOLDS = {
    "high_frequency": {
        "trades_per_hour": 10,
        "min_trades": 50
    },
    "arbitrage": {
        "avg_hold_time_minutes": 60,
        "paired_trades_ratio": 0.7
    },
    "market_maker": {
        "bid_ask_ratio": 0.4,  # 40% of trades are both buy and sell
        "min_volume": 10000
    }
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


async def fetch_activity(
    address: str,
    limit: int = 100,
    offset: int = 0,
    start: Optional[int] = None,
    end: Optional[int] = None,
    activity_type: Optional[str] = None
) -> Dict[str, Any]:
    """Fetch account activity from Polymarket Data API."""
    try:
        params = {
            "user": address,
            "limit": min(limit, 500),
            "offset": offset,
            "sortBy": "TIMESTAMP",
            "sortDirection": "DESC"
        }
        
        if start:
            params["start"] = start
        if end:
            params["end"] = end
        if activity_type:
            params["type"] = activity_type
        
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(f"{POLYMARKET_DATA_API}/activity", params=params)
            resp.raise_for_status()
            return resp.json()
    
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return []
        logger.error(f"HTTP error fetching activity for {address}: {e}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching activity for {address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def calculate_bot_score(activities: List[Dict]) -> Dict[str, Any]:
    """
    Analyze trading patterns and calculate bot score.
    
    Returns:
        {
            "bot_score": float (0-1),
            "bot_type": str | None,
            "indicators": {
                "high_frequency": bool,
                "regular_intervals": bool,
                "arbitrage_pattern": bool,
                "market_maker": bool
            }
        }
    """
    if not activities:
        return {
            "bot_score": 0.0,
            "bot_type": None,
            "indicators": {}
        }
    
    # Filter trades only
    trades = [a for a in activities if a.get("type") == "TRADE"]
    
    if len(trades) < 10:
        return {
            "bot_score": 0.0,
            "bot_type": None,
            "indicators": {}
        }
    
    indicators = {}
    score = 0.0
    
    # 1. High frequency trading
    if len(trades) >= BOT_THRESHOLDS["high_frequency"]["min_trades"]:
        timestamps = [t["timestamp"] for t in trades]
        time_span_hours = (max(timestamps) - min(timestamps)) / 3600
        
        if time_span_hours > 0:
            trades_per_hour = len(trades) / time_span_hours
            if trades_per_hour >= BOT_THRESHOLDS["high_frequency"]["trades_per_hour"]:
                indicators["high_frequency"] = True
                score += 0.3
    
    # 2. Regular time intervals (bot-like behavior)
    if len(trades) >= 20:
        timestamps = sorted([t["timestamp"] for t in trades])
        intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
        
        # Calculate coefficient of variation
        if intervals:
            avg_interval = sum(intervals) / len(intervals)
            variance = sum((x - avg_interval) ** 2 for x in intervals) / len(intervals)
            std_dev = variance ** 0.5
            
            if avg_interval > 0:
                cv = std_dev / avg_interval
                if cv < 0.5:  # Low variance = regular intervals
                    indicators["regular_intervals"] = True
                    score += 0.2
    
    # 3. Arbitrage pattern (quick buy-sell pairs)
    buy_trades = [t for t in trades if t.get("side") == "BUY"]
    sell_trades = [t for t in trades if t.get("side") == "SELL"]
    
    if buy_trades and sell_trades:
        # Count paired trades within 1 hour
        paired_count = 0
        for buy in buy_trades:
            for sell in sell_trades:
                time_diff = abs(buy["timestamp"] - sell["timestamp"])
                if time_diff < 3600:  # Within 1 hour
                    paired_count += 1
                    break
        
        paired_ratio = paired_count / len(trades)
        if paired_ratio >= BOT_THRESHOLDS["arbitrage"]["paired_trades_ratio"]:
            indicators["arbitrage_pattern"] = True
            score += 0.3
    
    # 4. Market maker pattern (balanced buy/sell)
    if buy_trades and sell_trades:
        buy_ratio = len(buy_trades) / len(trades)
        if 0.4 <= buy_ratio <= 0.6:  # Balanced
            total_volume = sum(t.get("usdcSize", 0) for t in trades)
            if total_volume >= BOT_THRESHOLDS["market_maker"]["min_volume"]:
                indicators["market_maker"] = True
                score += 0.2
    
    # Determine bot type
    bot_type = None
    if indicators.get("arbitrage_pattern"):
        bot_type = "arbitrage"
    elif indicators.get("market_maker"):
        bot_type = "market_maker"
    elif indicators.get("high_frequency"):
        bot_type = "high_frequency"
    
    return {
        "bot_score": min(score, 1.0),
        "bot_type": bot_type,
        "indicators": indicators
    }


def calculate_pnl(activities: List[Dict]) -> Dict[str, Any]:
    """Calculate profit and loss from activities."""
    trades = [a for a in activities if a.get("type") == "TRADE"]
    
    total_bought = sum(
        t.get("usdcSize", 0) 
        for t in trades 
        if t.get("side") == "BUY"
    )
    
    total_sold = sum(
        t.get("usdcSize", 0) 
        for t in trades 
        if t.get("side") == "SELL"
    )
    
    realized_pnl = total_sold - total_bought
    
    # Calculate win rate
    profitable_trades = sum(
        1 for t in trades 
        if t.get("side") == "SELL" and t.get("usdcSize", 0) > 0
    )
    
    win_rate = profitable_trades / len(trades) if trades else 0
    
    return {
        "realized_pnl": round(realized_pnl, 2),
        "total_bought": round(total_bought, 2),
        "total_sold": round(total_sold, 2),
        "win_rate": round(win_rate, 4)
    }


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.get("/accounts/{address}")
async def get_account_summary(address: str):
    """
    Get account summary including bot detection.
    
    Returns:
        {
            "address": str,
            "total_trades": int,
            "total_volume": float,
            "pnl": float,
            "win_rate": float,
            "bot_score": float,
            "bot_type": str | None,
            "first_trade": str,
            "last_trade": str
        }
    """
    try:
        # Fetch recent activity (last 500 trades)
        activities = await fetch_activity(address, limit=500)
        
        if not activities:
            raise HTTPException(status_code=404, detail="No activity found for this address")
        
        # Calculate metrics
        trades = [a for a in activities if a.get("type") == "TRADE"]
        
        total_volume = sum(t.get("usdcSize", 0) for t in trades)
        
        pnl_data = calculate_pnl(activities)
        bot_analysis = calculate_bot_score(activities)
        
        # Get first and last trade timestamps
        timestamps = [t["timestamp"] for t in trades]
        first_trade = datetime.fromtimestamp(min(timestamps), tz=timezone.utc).isoformat() if timestamps else None
        last_trade = datetime.fromtimestamp(max(timestamps), tz=timezone.utc).isoformat() if timestamps else None
        
        return {
            "address": address,
            "total_trades": len(trades),
            "total_volume": round(total_volume, 2),
            "pnl": pnl_data["realized_pnl"],
            "win_rate": pnl_data["win_rate"],
            "bot_score": bot_analysis["bot_score"],
            "bot_type": bot_analysis["bot_type"],
            "bot_indicators": bot_analysis["indicators"],
            "first_trade": first_trade,
            "last_trade": last_trade
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account summary for {address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/{address}/activity")
async def get_account_activity(
    address: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    activity_type: Optional[str] = Query(None, regex="^(TRADE|SPLIT|MERGE|REDEEM|REWARD|CONVERSION|MAKER_REBATE)$")
):
    """
    Get detailed activity history for an account.
    
    Returns:
        {
            "activities": [...],
            "meta": {
                "total": int,
                "limit": int,
                "offset": int
            }
        }
    """
    try:
        activities = await fetch_activity(
            address,
            limit=limit,
            offset=offset,
            activity_type=activity_type
        )
        
        return {
            "activities": activities,
            "meta": {
                "total": len(activities),
                "limit": limit,
                "offset": offset
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting activity for {address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bots/detect/{address}")
async def detect_bot(address: str):
    """
    Analyze an address and detect if it's a bot.
    
    Returns detailed bot analysis.
    """
    try:
        # Fetch recent activity
        activities = await fetch_activity(address, limit=500)
        
        if not activities:
            return {
                "address": address,
                "is_bot": False,
                "bot_score": 0.0,
                "reason": "No activity found"
            }
        
        bot_analysis = calculate_bot_score(activities)
        
        return {
            "address": address,
            "is_bot": bot_analysis["bot_score"] >= 0.5,
            "bot_score": bot_analysis["bot_score"],
            "bot_type": bot_analysis["bot_type"],
            "indicators": bot_analysis["indicators"],
            "total_trades": len([a for a in activities if a.get("type") == "TRADE"])
        }
    
    except Exception as e:
        logger.error(f"Error detecting bot for {address}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
