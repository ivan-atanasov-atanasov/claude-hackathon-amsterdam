"""
Fetch Amsterdam neighborhood (buurt) polygons from the Data API.

Source: /v1/gebieden/buurten
Used by the grid scorer to join cells to buurt_code for the veiligheidsindex baseline.
Polygons are stored locally as a JSON file (not in Supabase) since they are only
needed at grid-compute time.

Output: backend/data/buurt_polygons.json

Usage:
    cd backend && source venv/bin/activate
    python -m data_import.import_gebieden [--dry-run]
"""

import argparse
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv

from .client import paginate

load_dotenv()

ENDPOINT = "gebieden/buurten"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "buurt_polygons.json"


async def fetch_buurten() -> list[dict]:
    features = []
    async for item in paginate(ENDPOINT):
        # Gebieden API returns flat objects (not GeoJSON features)
        geom = item.get("geometrie") or item.get("geometry")
        if not geom:
            continue
        buurt_code = item.get("code") or item.get("identificatie") or item.get("vollcode")
        if not buurt_code:
            continue
        features.append({
            "buurt_code": buurt_code,
            "naam": item.get("naam"),
            "geometry": geom,
        })
    return features


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Fetching buurt polygons from gebieden API...")
    features = asyncio.run(fetch_buurten())
    print(f"  Found {len(features)} buurten.")

    if args.dry_run:
        print("[dry-run] Would write to", OUTPUT_PATH)
        return

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(features, f)
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
