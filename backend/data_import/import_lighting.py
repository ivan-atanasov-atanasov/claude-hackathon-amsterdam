"""
Import street lighting points from Amsterdam Data API into lighting_points table.

Source: /v1/leidingeninfrastructuur/amsterdam_ovl_lichtpunten
Coordinates returned in WGS84 via Accept-Crs: EPSG:4326 header.

Usage:
    cd backend && source venv/bin/activate
    python -m data_import.import_lighting [--dry-run]
"""

import argparse
import asyncio
import os
import uuid

from dotenv import load_dotenv
from supabase import create_client

from .client import AMSTERDAM_BBOX, paginate

load_dotenv()

ENDPOINT = "leidingeninfrastructuur/amsterdam_ovl_lichtpunten"
CHUNK_SIZE = 500


def _in_bbox(lat: float, lng: float) -> bool:
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


async def fetch_records() -> list[dict]:
    records = []
    async for item in paginate(ENDPOINT):
        geom = item.get("geometry") or {}
        coords = geom.get("coordinates")
        if not coords or len(coords) < 2:
            continue
        # WGS84: [lng, lat]
        lng, lat = float(coords[0]), float(coords[1])
        if not _in_bbox(lat, lng):
            continue

        lamp_type = (
            item.get("bouwtype")
            or item.get("type_lichtpunt")
            or item.get("objecttype")
        )
        records.append({
            "id": str(uuid.uuid4()),
            "lat": lat,
            "lng": lng,
            "type": lamp_type,
        })

    return records


def upsert(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] Would insert {len(records)} lighting points.")
        if records:
            print("  Sample:", records[0])
        return

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    client.table("lighting_points").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    total = 0
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("lighting_points").insert(chunk).execute()
        total += len(chunk)
        print(f"  Inserted {total}/{len(records)}...")

    print(f"Done. {total} lighting points loaded.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Fetching lighting points...")
    records = asyncio.run(fetch_records())
    print(f"  Found {len(records)} records in Amsterdam bbox.")
    upsert(records, args.dry_run)


if __name__ == "__main__":
    main()
