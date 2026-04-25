"""
Seed unsafe_areas from the 2025 cyclist safety survey.

Sources:
  - Park polygons: Amsterdam Data API /v1/functionele_gebieden/groen (real geometries)
  - Stations, squares, nightlife, corridors: hardcoded from survey §1.8 and §1.7

Usage:
    cd backend && source venv/bin/activate
    python -m data_import.import_unsafe_areas [--dry-run]
"""

import argparse
import asyncio
import json
import math
import os
import uuid

from dotenv import load_dotenv
from supabase import create_client

from .client import paginate

load_dotenv()

CHUNK_SIZE = 100

# Parks to fetch from functionele_gebieden/groen API (survey §1.8 + Table 1)
SURVEY_PARKS = {
    "Vondelpark", "Oosterpark", "Rembrandtpark", "Noorderpark",
    "Westerpark", "Sloterpark", "Mandelapark", "Diemerpark",
    "Flevopark", "Beatrixpark", "Gaasperpark", "Amstelpark",
}


def _circle_polygon(lat: float, lng: float, radius_m: float = 150, points: int = 16) -> dict:
    """Approximate a circle as a GeoJSON Polygon."""
    lat_deg = radius_m / 111320
    lng_deg = radius_m / (111320 * math.cos(math.radians(lat)))
    coords = [
        [
            lng + lng_deg * math.cos(2 * math.pi * i / points),
            lat + lat_deg * math.sin(2 * math.pi * i / points),
        ]
        for i in range(points)
    ]
    coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


def _line_buffer(points_latLng: list[tuple[float, float]], radius_m: float = 100) -> dict:
    """Approximate a buffered corridor as a rough polygon (simplified rectangle)."""
    lat_deg = radius_m / 111320
    coords = []
    latlng = points_latLng
    for lat, lng in latlng:
        lng_deg = radius_m / (111320 * math.cos(math.radians(lat)))
        coords.append([lng - lng_deg, lat - lat_deg])
    for lat, lng in reversed(latlng):
        lng_deg = radius_m / (111320 * math.cos(math.radians(lat)))
        coords.append([lng + lng_deg, lat + lat_deg])
    coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


# Survey §1.8 — specific squares, stations, and nightlife areas
HARDCODED_AREAS = [
    # Stations
    {"name": "Amsterdam Centraal",    "kind": "station",  "source": "survey_hotspot_type", "lat": 52.3791, "lng": 4.9003},
    {"name": "Muiderpoort station",   "kind": "station",  "source": "survey_hotspot_type", "lat": 52.3624, "lng": 4.9299},
    {"name": "Lelylaan station",      "kind": "station",  "source": "survey_hotspot_type", "lat": 52.3568, "lng": 4.8351},
    # Nightlife / squares
    {"name": "Leidseplein",           "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3638, "lng": 4.8830},
    {"name": "Wallengebied",          "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3732, "lng": 4.8997},
    {"name": "Beukenplein",           "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3562, "lng": 4.9222},
    {"name": "De Hallen",             "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3669, "lng": 4.8632},
    {"name": "Osdorpplein",           "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3598, "lng": 4.8040},
    {"name": "Plein 40-45",           "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3671, "lng": 4.8511},
    {"name": "Bos en Lommerplein",    "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3786, "lng": 4.8474},
    {"name": "Gulden Winckelplein",   "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3792, "lng": 4.8599},
    {"name": "Buikslotermeerplein",   "kind": "square",   "source": "survey_hotspot_type", "lat": 52.4012, "lng": 4.9289},
    {"name": "Delflandplein",         "kind": "square",   "source": "survey_hotspot_type", "lat": 52.3580, "lng": 4.8384},
    {"name": "Krugerplein",           "kind": "square",   "source": "survey_cluster",      "lat": 52.3521, "lng": 4.9264},
]

# Survey §1.7 — hard-to-avoid corridors
CORRIDOR_AREAS = [
    {
        "name": "Gooiseweg/Weesperzijde corridor",
        "kind": "corridor",
        "source": "survey_corridor",
        "points": [(52.3460, 4.9290), (52.3530, 4.9380)],
    },
    {
        "name": "Buiksloterweg corridor",
        "kind": "corridor",
        "source": "survey_corridor",
        "points": [(52.3993, 4.9070), (52.4060, 4.9160)],
    },
    {
        "name": "Transformatorweg corridor",
        "kind": "corridor",
        "source": "survey_corridor",
        "points": [(52.3880, 4.8350), (52.3950, 4.8430)],
    },
    {
        "name": "Diemerpark corridor",
        "kind": "corridor",
        "source": "survey_corridor",
        "points": [(52.3340, 4.9750), (52.3420, 4.9870)],
    },
    {
        "name": "Sloterplas roundabout",
        "kind": "corridor",
        "source": "survey_corridor",
        "points": [(52.3680, 4.8120), (52.3720, 4.8180)],
    },
]


async def fetch_park_areas() -> list[dict]:
    """Fetch park polygons from functionele_gebieden/groen, one request per park name."""
    records = []
    fetched: set[str] = set()

    async def _fetch_one(park_name: str) -> None:
        async for item in paginate("functionele_gebieden/groen", {"naam": park_name, "_pageSize": 10}):
            if park_name in fetched:
                break  # only take first matching polygon per park
            geom = item.get("geometrie") or item.get("geometry")
            if not geom:
                continue
            fetched.add(park_name)
            records.append({
                "id": str(uuid.uuid4()),
                "name": park_name,
                "kind": "park",
                "source": "survey_hotspot_type",
                "geometry": json.dumps(geom),
            })

    for park in SURVEY_PARKS:
        await _fetch_one(park)

    print(f"  Fetched {len(records)} park polygons: {sorted(fetched)}")
    missing = SURVEY_PARKS - fetched
    if missing:
        print(f"  Not found in API (will skip): {sorted(missing)}")
    return records


def build_hardcoded_records() -> list[dict]:
    records = []
    for area in HARDCODED_AREAS:
        records.append({
            "id": str(uuid.uuid4()),
            "name": area["name"],
            "kind": area["kind"],
            "source": area["source"],
            "geometry": json.dumps(_circle_polygon(area["lat"], area["lng"])),
        })
    for corridor in CORRIDOR_AREAS:
        records.append({
            "id": str(uuid.uuid4()),
            "name": corridor["name"],
            "kind": corridor["kind"],
            "source": corridor["source"],
            "geometry": json.dumps(_line_buffer(corridor["points"])),
        })
    return records


def upsert(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] Would insert {len(records)} unsafe areas.")
        for r in records[:5]:
            print(f"  {r['kind']:10} {r['source']:25} {r['name']}")
        return

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    # Clear non-crowdsource rows (keep pointer_crowdsource if already loaded)
    client.table("unsafe_areas").delete().neq("source", "pointer_crowdsource").execute()

    total = 0
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("unsafe_areas").insert(chunk).execute()
        total += len(chunk)

    print(f"Done. {total} unsafe areas loaded.")


async def run(dry_run: bool) -> None:
    print("Fetching park polygons from Amsterdam Data API...")
    park_records = await fetch_park_areas()

    print("Building hardcoded station/square/corridor records...")
    hardcoded = build_hardcoded_records()
    print(f"  {len(hardcoded)} hardcoded areas ({len(HARDCODED_AREAS)} points, {len(CORRIDOR_AREAS)} corridors).")

    all_records = park_records + hardcoded
    print(f"\nTotal: {len(all_records)} unsafe areas.")
    upsert(all_records, dry_run)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    main()
