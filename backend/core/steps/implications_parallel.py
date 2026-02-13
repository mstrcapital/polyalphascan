"""
Parallel LLM processing for implications extraction.

This module provides optimized parallel processing of market groups
to significantly speed up the implications extraction pipeline.
"""

import asyncio
from typing import Any, List

from loguru import logger

from core.steps.implications import (
    extract_implications as extract_implications_single,
    IMPLICATIONS_MODEL
)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Maximum concurrent LLM requests
# Adjust based on your OpenRouter rate limits
MAX_CONCURRENT_REQUESTS = 5

# Batch size for processing groups
BATCH_SIZE = 10

# =============================================================================
# PARALLEL PROCESSING
# =============================================================================


async def extract_implications_batch(
    groups: List[dict],
    semaphore: asyncio.Semaphore
) -> List[dict]:
    """
    Extract implications for a batch of groups with concurrency control.
    
    Args:
        groups: List of market groups to process
        semaphore: Semaphore to limit concurrent requests
    
    Returns:
        List of implications
    """
    async def process_group(group: dict) -> List[dict]:
        """Process a single group with semaphore."""
        async with semaphore:
            try:
                # Call the original single-group extraction
                # Note: This assumes extract_implications can handle a single group
                # You may need to adapt this based on the actual implementation
                result = await asyncio.to_thread(
                    extract_implications_single,
                    [group]  # Pass as single-item list
                )
                return result if result else []
            except Exception as e:
                logger.error(f"Error processing group {group.get('id', 'unknown')}: {e}")
                return []
    
    # Process all groups concurrently with semaphore limiting
    tasks = [process_group(group) for group in groups]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Flatten results and filter errors
    implications = []
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Task failed with exception: {result}")
        elif isinstance(result, list):
            implications.extend(result)
    
    return implications


async def extract_implications_parallel(
    groups: List[dict],
    max_concurrent: int = MAX_CONCURRENT_REQUESTS
) -> List[dict]:
    """
    Extract implications from market groups using parallel processing.
    
    This function processes multiple groups concurrently to significantly
    speed up the LLM inference pipeline.
    
    Args:
        groups: List of market groups to analyze
        max_concurrent: Maximum number of concurrent LLM requests
    
    Returns:
        List of extracted implications
    
    Example:
        >>> groups = load_groups()
        >>> implications = await extract_implications_parallel(groups)
        >>> logger.info(f"Extracted {len(implications)} implications")
    """
    if not groups:
        logger.warning("No groups provided for implications extraction")
        return []
    
    logger.info(
        f"Starting parallel implications extraction for {len(groups)} groups "
        f"(max_concurrent={max_concurrent})"
    )
    
    # Create semaphore to limit concurrency
    semaphore = asyncio.Semaphore(max_concurrent)
    
    # Process in batches to avoid memory issues with very large datasets
    all_implications = []
    
    for i in range(0, len(groups), BATCH_SIZE):
        batch = groups[i:i + BATCH_SIZE]
        logger.info(f"Processing batch {i//BATCH_SIZE + 1} ({len(batch)} groups)")
        
        batch_implications = await extract_implications_batch(batch, semaphore)
        all_implications.extend(batch_implications)
        
        logger.info(
            f"Batch {i//BATCH_SIZE + 1} complete: "
            f"{len(batch_implications)} implications extracted"
        )
    
    logger.info(
        f"Parallel extraction complete: {len(all_implications)} total implications "
        f"from {len(groups)} groups"
    )
    
    return all_implications


def extract_implications_parallel_sync(
    groups: List[dict],
    max_concurrent: int = MAX_CONCURRENT_REQUESTS
) -> List[dict]:
    """
    Synchronous wrapper for parallel implications extraction.
    
    Use this in synchronous contexts or when called from non-async code.
    """
    return asyncio.run(extract_implications_parallel(groups, max_concurrent))


# =============================================================================
# PERFORMANCE MONITORING
# =============================================================================


async def extract_implications_with_timing(
    groups: List[dict],
    max_concurrent: int = MAX_CONCURRENT_REQUESTS
) -> tuple[List[dict], float]:
    """
    Extract implications with performance timing.
    
    Returns:
        Tuple of (implications, elapsed_time_seconds)
    """
    import time
    
    start_time = time.time()
    implications = await extract_implications_parallel(groups, max_concurrent)
    elapsed = time.time() - start_time
    
    logger.info(
        f"Performance: Processed {len(groups)} groups in {elapsed:.2f}s "
        f"({len(groups)/elapsed:.2f} groups/s)"
    )
    
    return implications, elapsed
