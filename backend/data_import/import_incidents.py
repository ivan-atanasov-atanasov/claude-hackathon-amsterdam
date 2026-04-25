"""
Import citizen incident reports (SIA meldingen) from Amsterdam Data API into incidents table.

Source: /v1/meldingen/meldingen
Filters: social-safety-relevant categories, last 24 months, Amsterdam bbox.

Usage:
    cd backend && source venv/bin/activate
    python -m data_import.import_incidents [--dry-run]
"""

import argparse
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client

from .client import AMSTERDAM_BBOX, paginate

load_dotenv()

ENDPOINT = "meldingen/meldingen"
CHUNK_SIZE = 500

RELEVANT_CATEGORIES = {
    "Overlast van en door personen of groepen",
    "Overlast in de openbare ruimte",
    "Overlast van boten",
    "Overlast Bedrijven en Horeca",
}


def _in_bbox(lat: float, lng: float) -> bool:
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


def _cutoff_date() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=730)).strftime("%Y-%m-%d")


async def fetch_records() -> list[dict]:
    records = []
    cutoff = _cutoff_date()

    async for item in paginate(ENDPOINT, {"datumMelding[gte]": cutoff}):
        category = item.get("hoofdcategorie", "")
        if category not in RELEVANT_CATEGORIES:
            continue

        lat_raw = item.get("latitudeVisualisatie")
        lng_raw = item.get("longitudeVisualisatie")
        if not lat_raw or not lng_raw:
            continue

        try:
            lat, lng = float(lat_raw), float(lng_raw)
        except (ValueError, TypeError):
            continue

        if not _in_bbox(lat, lng):
            continue

        occurred_date = item.get("datumOverlast") or item.get("datumMelding")
        occurred_time = item.get("tijdstipOverlast") or item.get("tijdstipMelding")
        occurred_at = f"{occurred_date}T{occurred_time}" if occurred_date and occurred_time else occurred_date

        records.append({
            "id": str(uuid.uuid4()),
            "lat": lat,
            "lng": lng,
            "category": category,
            "occurred_at": occurred_at,
        })

    return records


def upsert(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] Would insert {len(records)} incidents.")
        if records:
            print("  Sample:", records[0])
        return

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    client.table("incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    total = 0
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("incidents").insert(chunk).execute()
        total += len(chunk)
        print(f"  Inserted {total}/{len(records)}...")

    print(f"Done. {total} incidents loaded.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cutoff = _cutoff_date()
    print(f"Fetching incidents (last 24 months, from {cutoff})...")
    records = asyncio.run(fetch_records())
    print(f"  Found {len(records)} relevant records in Amsterdam bbox.")
    upsert(records, args.dry_run)


if __name__ == "__main__":
    main()
