"""
Import Pointer/KRO-NCRV crowdsourced unsafe location pins into Supabase unsafe_areas.

Source:
  CSV:  https://data.kro-ncrv.nl/2025/onveilige-plekken-kaart-2/assets/20-11-25/webversie_mapped.csv
  JSON: https://data.kro-ncrv.nl/2025/onveilige-plekken-kaart-2/assets/20-11-25/webversie_mapped.json

CSV columns (numeric-coded): reden, gedrag_aanpassing, tijdstip, lat, lng, leeftijd, datum, gender, GM
JSON:                          lookup table mapping numeric codes to string values

Filters to Amsterdam only, upserts into unsafe_areas with source='pointer_crowdsource'.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/import_pointer_data.py [--dry-run]
"""

import argparse
import csv
import io
import json
import sys
import uuid

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

import os

CSV_URL = "https://data.kro-ncrv.nl/2025/onveilige-plekken-kaart-2/assets/20-11-25/webversie_mapped.csv"
JSON_URL = "https://data.kro-ncrv.nl/2025/onveilige-plekken-kaart-2/assets/20-11-25/webversie_mapped.json"

# Amsterdam bounding box (loose) — pre-filter before GM lookup
AMSTERDAM_BBOX = {"lat_min": 52.27, "lat_max": 52.43, "lng_min": 4.72, "lng_max": 5.08}

# reden codes → human-readable
REDEN_MAP = {
    "1": "environment",
    "2": "person",
    "3": "other",
}

# tijdstip codes → human-readable
TIJDSTIP_MAP = {
    "1": "any",
    "2": "dark",
    "3": "daytime",
}


def fetch_lookup(url: str) -> dict:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_csv(url: str) -> list[dict]:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    # CSV is semicolon-delimited with a UTF-8 BOM
    text = resp.text.lstrip("﻿")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    return list(reader)


def find_amsterdam_gm_code(lookup: dict) -> str | None:
    """Return the numeric GM code for Amsterdam from the lookup table."""
    gm_entries = lookup.get("GM", {})
    for code, name in gm_entries.items():
        if isinstance(name, str) and name.strip().lower() == "amsterdam":
            return str(code)
    return None


def build_records(rows: list[dict], amsterdam_gm: str | None) -> list[dict]:
    records = []
    skipped_bbox = 0
    skipped_gm = 0

    for row in rows:
        try:
            lat = float(row["lat"])
            lng = float(row["lng"])
        except (ValueError, KeyError):
            continue

        # Bounding-box pre-filter
        bb = AMSTERDAM_BBOX
        if not (bb["lat_min"] <= lat <= bb["lat_max"] and bb["lng_min"] <= lng <= bb["lng_max"]):
            skipped_bbox += 1
            continue

        # GM filter — if we resolved a code, apply it; otherwise trust the bbox
        gm_raw = row.get("GM", "").strip()
        if amsterdam_gm and gm_raw and gm_raw != amsterdam_gm:
            skipped_gm += 1
            continue

        # First column may carry a BOM prefix — check both forms
        reden_raw = (row.get("reden") or row.get("ï»¿reden") or "").strip().split(",")[0]
        tijdstip_raw = row.get("tijdstip", "").strip()

        records.append(
            {
                "id": str(uuid.uuid4()),
                "name": f"pointer_{lat:.5f}_{lng:.5f}",
                "kind": "crowdsourced_point",
                "source": "pointer_crowdsource",
                "geometry": json.dumps({"type": "Point", "coordinates": [lng, lat]}),
            }
        )

    print(f"  Rows skipped (outside bbox):  {skipped_bbox}")
    print(f"  Rows skipped (wrong GM code): {skipped_gm}")
    return records


def upsert_records(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        print(f"\n[dry-run] Would upsert {len(records)} records into unsafe_areas.")
        if records:
            print("  Sample record:", json.dumps(records[0], indent=2))
        return

    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_KEY"]
    client = create_client(supabase_url, supabase_key)

    # Delete existing pointer_crowdsource rows first to allow re-import
    client.table("unsafe_areas").delete().eq("source", "pointer_crowdsource").execute()

    # Batch insert in chunks of 500 to stay within Supabase limits
    chunk_size = 500
    total = 0
    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        client.table("unsafe_areas").insert(chunk).execute()
        total += len(chunk)
        print(f"  Inserted {total}/{len(records)} records...")

    print(f"\nDone. {total} Pointer records loaded into unsafe_areas.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Pointer unsafe location data into Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing to DB.")
    args = parser.parse_args()

    print("Fetching lookup table...")
    lookup = fetch_lookup(JSON_URL)

    amsterdam_gm = find_amsterdam_gm_code(lookup)
    if amsterdam_gm:
        print(f"  Amsterdam GM code: {amsterdam_gm}")
    else:
        print("  Warning: could not resolve Amsterdam GM code — relying on bounding box only.")

    print("Fetching CSV...")
    rows = fetch_csv(CSV_URL)
    print(f"  Total rows in CSV: {len(rows)}")

    print("Filtering to Amsterdam...")
    records = build_records(rows, amsterdam_gm)
    print(f"  Amsterdam records: {len(records)}")

    if not records:
        print("No Amsterdam records found. Check GM codes or bounding box.")
        sys.exit(1)

    upsert_records(records, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
