"""
Import nuisance and camera zones (overlastgebieden) from Amsterdam Data API.

The API exposes each zone type as its own sub-endpoint under /v1/overlastgebieden/.
cameratoezicht is treated as a positive signal (bonus); all others are penalties.

Usage:
    cd backend && source venv/bin/activate
    python -m data_import.import_overlast_zones [--dry-run]
"""

import argparse
import asyncio
import json
import os
import uuid

from dotenv import load_dotenv
from supabase import create_client

from .client import paginate

load_dotenv()

CHUNK_SIZE = 200

# All sub-endpoints under /v1/overlastgebieden/ (exclude detail routes /{id})
ZONE_KINDS = [
    "alcoholverbod",
    "alcoholverkoopverbod",
    "algemeenoverlast",
    "barbecueverbod",
    "bedelverbod",
    "blowverbodsgebied",
    "cameratoezicht",
    "dealeroverlast",
    "groepsfietsverbod",
    "messenverbod",
    "rondleidingverbod",
    "sluitingstijdenkernwallen",
    "straatartiestverbod",
    "taxistandplaats",
    "uitgaansoverlast",
    "vuurwerkvrij",
]

BONUS_KINDS = {"cameratoezicht"}


async def fetch_records() -> list[dict]:
    records = []
    for kind in ZONE_KINDS:
        endpoint = f"overlastgebieden/{kind}"
        count = 0
        async for item in paginate(endpoint):
            geom = item.get("geometry")
            if not geom:
                continue

            validity_days = item.get("geldigOpDag") or item.get("geldig_op_dag") or []
            if isinstance(validity_days, str):
                validity_days = [d.strip() for d in validity_days.split(",") if d.strip()]

            validity_hours = (
                item.get("geldigVanTot")
                or item.get("geldig_van_tot")
                or item.get("tijdstip")
            )

            records.append({
                "id": str(uuid.uuid4()),
                "kind": kind,
                "geometry": json.dumps(geom),
                "validity_days": validity_days or None,
                "validity_hours": str(validity_hours) if validity_hours else None,
                "polarity": "bonus" if kind in BONUS_KINDS else "penalty",
            })
            count += 1

        print(f"  {kind}: {count} zones")

    return records


def upsert(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] Would insert {len(records)} overlast zones.")
        if records:
            print("  Sample:", {k: v for k, v in records[0].items() if k != "geometry"})
        return

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    client.table("overlast_zones").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    total = 0
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("overlast_zones").insert(chunk).execute()
        total += len(chunk)
        print(f"  Inserted {total}/{len(records)}...")

    print(f"Done. {total} overlast zones loaded.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Fetching overlast zones (all sub-endpoints)...")
    records = asyncio.run(fetch_records())
    print(f"  Total: {len(records)} zones across {len(ZONE_KINDS)} types.")
    upsert(records, args.dry_run)


if __name__ == "__main__":
    main()
