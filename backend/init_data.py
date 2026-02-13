
import asyncio
import json
import os
from pathlib import Path
from core.steps.fetch import fetch_events
from core.steps.groups import build_groups
from core.state import load_state, export_live_data

async def init_data():
    print("Starting data initialization...")
    try:
        # 1. Fetch some events
        events = await fetch_events(max_events=50)
        print(f"Fetched {len(events)} events.")
        
        # 2. Build groups
        groups, summary = build_groups(events)
        print(f"Built {len(groups)} groups.")
        
        # 3. Export to _live/
        state = load_state()
        export_live_data(state, groups, [], events=events)
        print("Data exported to data/_live/")
        
    except Exception as e:
        print(f"Error during initialization: {e}")

if __name__ == "__main__":
    asyncio.run(init_data())
