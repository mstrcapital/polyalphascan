"""
Enhanced price aggregation with multiple WebSocket connections.

This module extends the original price_aggregation.py to support
unlimited token subscriptions by creating multiple WebSocket connections.
"""

import asyncio
from typing import List

from loguru import logger

from server.clob_websocket import ClobWebSocketClient
from server.price_aggregation import PriceAggregationService

# =============================================================================
# CONFIGURATION
# =============================================================================

MAX_TOKENS_PER_CONNECTION = 500  # Polymarket limit
MAX_WEBSOCKET_CONNECTIONS = 10   # Safety limit


# =============================================================================
# MULTI-CONNECTION PRICE AGGREGATION
# =============================================================================


class MultiConnectionPriceAggregation(PriceAggregationService):
    """
    Enhanced price aggregation service with multiple WebSocket support.
    
    Automatically creates multiple WebSocket connections when the number
    of tokens exceeds MAX_TOKENS_PER_CONNECTION.
    """
    
    def __init__(self) -> None:
        super().__init__()
        self._ws_clients: List[ClobWebSocketClient] = []
    
    async def start(self) -> None:
        """Start the price aggregation service with multiple WebSocket connections."""
        if self._running:
            logger.warning("PriceAggregationService already running")
            return
        
        logger.info("Starting Multi-Connection PriceAggregationService...")
        self._running = True
        
        # Start event processing loop
        self._event_loop_task = asyncio.create_task(self._event_loop())
        
        # Start subscription refresh loop
        self._refresh_task = asyncio.create_task(self._refresh_subscriptions())
        
        # Start callback batching loop
        self._callback_task = asyncio.create_task(self._callback_loop())
        
        logger.info("Multi-Connection PriceAggregationService started")
    
    async def stop(self) -> None:
        """Stop all WebSocket connections and tasks."""
        logger.info("Stopping Multi-Connection PriceAggregationService...")
        self._running = False
        
        # Stop all WebSocket clients
        for client in self._ws_clients:
            try:
                await client.stop()
            except Exception as e:
                logger.error(f"Error stopping WebSocket client: {e}")
        
        self._ws_clients.clear()
        
        # Stop tasks
        for task in [self._event_loop_task, self._refresh_task, self._callback_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        logger.info("Multi-Connection PriceAggregationService stopped")
    
    async def _refresh_subscriptions(self) -> None:
        """
        Periodically refresh WebSocket subscriptions.
        
        Creates multiple connections if needed to handle all tokens.
        """
        from server.token_resolver import token_resolver
        from core.paths import LIVE_DIR
        
        while self._running:
            try:
                # Get all token IDs from portfolios
                portfolios_file = LIVE_DIR / "portfolios.json"
                if portfolios_file.exists():
                    token_ids = await token_resolver.get_all_tokens()
                    
                    if token_ids:
                        await self._update_multi_connections(token_ids)
                
            except Exception as e:
                logger.error(f"Error refreshing subscriptions: {e}")
            
            # Wait before next refresh
            await asyncio.sleep(5)  # SUBSCRIPTION_REFRESH_INTERVAL
    
    async def _update_multi_connections(self, token_ids: List[str]) -> None:
        """
        Update WebSocket connections to handle all tokens.
        
        Creates multiple connections if tokens exceed MAX_TOKENS_PER_CONNECTION.
        """
        num_tokens = len(token_ids)
        num_connections_needed = (num_tokens + MAX_TOKENS_PER_CONNECTION - 1) // MAX_TOKENS_PER_CONNECTION
        
        # Safety check
        if num_connections_needed > MAX_WEBSOCKET_CONNECTIONS:
            logger.warning(
                f"Token count ({num_tokens}) requires {num_connections_needed} connections, "
                f"limiting to {MAX_WEBSOCKET_CONNECTIONS}"
            )
            num_connections_needed = MAX_WEBSOCKET_CONNECTIONS
            token_ids = token_ids[:MAX_WEBSOCKET_CONNECTIONS * MAX_TOKENS_PER_CONNECTION]
        
        # Stop existing clients if connection count changed
        if len(self._ws_clients) != num_connections_needed:
            logger.info(
                f"Updating WebSocket connections: {len(self._ws_clients)} → {num_connections_needed}"
            )
            
            for client in self._ws_clients:
                await client.stop()
            
            self._ws_clients.clear()
            
            # Create new clients
            for i in range(num_connections_needed):
                start_idx = i * MAX_TOKENS_PER_CONNECTION
                end_idx = min((i + 1) * MAX_TOKENS_PER_CONNECTION, num_tokens)
                batch = token_ids[start_idx:end_idx]
                
                client = ClobWebSocketClient(self._price_queue)
                await client.start(batch)
                self._ws_clients.append(client)
                
                logger.info(
                    f"Started WebSocket connection {i+1}/{num_connections_needed} "
                    f"with {len(batch)} tokens"
                )
        
        else:
            # Same number of connections, just resubscribe
            for i, client in enumerate(self._ws_clients):
                start_idx = i * MAX_TOKENS_PER_CONNECTION
                end_idx = min((i + 1) * MAX_TOKENS_PER_CONNECTION, num_tokens)
                batch = token_ids[start_idx:end_idx]
                
                await client.resubscribe(batch)


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

# Replace the original price_aggregation instance
multi_ws_price_aggregation = MultiConnectionPriceAggregation()


# =============================================================================
# USAGE EXAMPLE
# =============================================================================

if __name__ == "__main__":
    async def main():
        # Start service
        await multi_ws_price_aggregation.start()
        
        # Wait for some time
        await asyncio.sleep(60)
        
        # Get prices
        prices = multi_ws_price_aggregation.get_prices()
        logger.info(f"Got prices for {len(prices)} markets")
        
        # Stop service
        await multi_ws_price_aggregation.stop()
    
    asyncio.run(main())
