"""
One-shot script: fetch all data layers, compute safety_grid scores, write to Supabase.

Lighting points and incidents are fetched from the Amsterdam Data API in memory —
never stored in the database. Only safety_grid (the scored output) is persisted.

Run after import_all.py:
    cd backend && source venv/bin/activate
    python compute_grid.py [--dry-run] [--district=centrum]

Grid resolution: ~100m cells (0.001 degrees ≈ 111m at Amsterdam's latitude).
Amsterdam bounding box: lat 52.27–52.43, lng 4.72–5.08 → ~57,600 cells.
"""

import argparse
import asyncio
import json
import math
import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from shapely.geometry import Point, shape
from supabase import create_client

from data_import.client import AMSTERDAM_BBOX, paginate

load_dotenv()

# Grid resolution in degrees (~111m per 0.001°)
GRID_RES = 0.001

# Radius for density lookups (in grid cells)
DENSITY_RADIUS = 1  # 1 cell = ~100m

DATA_DIR = Path(__file__).parent / "data"
CHUNK_SIZE = 500

# Time-of-day weight tables (from PRD, seeded from 2025 survey)
WEIGHTS = {
    "day":     dict(people=0.22, overview=0.16, lighting=0.14, buildings=0.18, camera=0.04, overlast=0.08, incidents=0.10, hotspot=0.08),
    "evening": dict(people=0.20, overview=0.18, lighting=0.20, buildings=0.14, camera=0.06, overlast=0.14, incidents=0.10, hotspot=0.12),
    "night":   dict(people=0.18, overview=0.20, lighting=0.26, buildings=0.10, camera=0.08, overlast=0.18, incidents=0.10, hotspot=0.16),
}


# ---------------------------------------------------------------------------
# Grid helpers
# ---------------------------------------------------------------------------

def cell_coords(grid_x: int, grid_y: int) -> tuple[float, float]:
    lat_min, lng_min, _, _ = AMSTERDAM_BBOX
    lat = lat_min + grid_y * GRID_RES + GRID_RES / 2
    lng = lng_min + grid_x * GRID_RES + GRID_RES / 2
    return lat, lng


def point_to_cell(lat: float, lng: float) -> tuple[int, int]:
    lat_min, lng_min, _, _ = AMSTERDAM_BBOX
    return int((lng - lng_min) / GRID_RES), int((lat - lat_min) / GRID_RES)


def all_cells() -> list[tuple[int, int]]:
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    x_max = int((lng_max - lng_min) / GRID_RES)
    y_max = int((lat_max - lat_min) / GRID_RES)
    return [(x, y) for y in range(y_max) for x in range(x_max)]


def normalize(counts: dict, percentile: float = 0.95) -> dict:
    """Normalize counts to 0–1 using a percentile cap to reduce outlier influence."""
    if not counts:
        return {}
    values = sorted(counts.values())
    cap = values[int(len(values) * percentile)] or 1
    return {k: min(v / cap, 1.0) for k, v in counts.items()}


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

async def fetch_lighting_density() -> dict[tuple[int, int], float]:
    """Fetch all street lights and return normalized density per grid cell."""
    print("  Fetching lighting points from Amsterdam API...")
    raw: dict[tuple[int, int], int] = defaultdict(int)
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX

    async for item in paginate("leidingeninfrastructuur/amsterdam_ovl_lichtpunten"):
        geom = item.get("geometry") or {}
        coords = geom.get("coordinates")
        if not coords or len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])
        if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
            continue
        raw[point_to_cell(lat, lng)] += 1

    print(f"    {sum(raw.values())} lighting points across {len(raw)} cells.")
    return normalize(raw)


async def fetch_incident_density() -> dict[tuple[int, int], float]:
    """Fetch relevant meldingen (last 24m) and return normalized density per cell."""
    print("  Fetching incident reports from Amsterdam API...")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=730)).strftime("%Y-%m-%d")
    raw: dict[tuple[int, int], int] = defaultdict(int)
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX

    relevant = {
        "Overlast van en door personen of groepen",
        "Overlast in de openbare ruimte",
        "Overlast van boten",
        "Overlast Bedrijven en Horeca",
    }

    async for item in paginate("meldingen/meldingen", {"datumMelding[gte]": cutoff}):
        if item.get("hoofdcategorie") not in relevant:
            continue
        lat_raw = item.get("latitudeVisualisatie")
        lng_raw = item.get("longitudeVisualisatie")
        if not lat_raw or not lng_raw:
            continue
        try:
            lat, lng = float(lat_raw), float(lng_raw)
        except (ValueError, TypeError):
            continue
        if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
            continue
        raw[point_to_cell(lat, lng)] += 1

    print(f"    {sum(raw.values())} incidents across {len(raw)} cells.")
    return normalize(raw)


def load_bag_density() -> dict[tuple[int, int], float]:
    """Load building density from local file (generated by import_bag.py)."""
    path = DATA_DIR / "bag_density.json"
    if not path.exists():
        print("  bag_density.json not found — building_density_score will be 0.5 (default).")
        return {}
    with open(path) as f:
        raw = json.load(f)
    counts = {tuple(int(v) for v in k.split(",")): v for k, v in raw.items()}
    return normalize(counts)


def load_buurt_shapes() -> list[dict]:
    """Load buurt polygons from local file."""
    path = DATA_DIR / "buurt_polygons.json"
    if not path.exists():
        print("  buurt_polygons.json not found — run import_gebieden.py first.")
        return []
    with open(path) as f:
        data = json.load(f)
    result = []
    for feat in data:
        try:
            result.append({
                "buurt_code": feat["buurt_code"],
                "shape": shape(feat["geometry"]),
            })
        except Exception:
            pass
    print(f"  Loaded {len(result)} buurt polygons.")
    return result


def load_supabase_polygons(table: str, kind_col: str = "kind") -> list[dict]:
    """Load polygon zones from Supabase."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    rows = client.table(table).select("*").execute().data
    result = []
    for row in rows:
        try:
            geom = json.loads(row["geometry"]) if isinstance(row["geometry"], str) else row["geometry"]
            result.append({
                **row,
                "shape": shape(geom),
            })
        except Exception:
            pass
    print(f"  Loaded {len(result)} rows from {table}.")
    return result


# ---------------------------------------------------------------------------
# Per-cell scoring
# ---------------------------------------------------------------------------

def build_grid(
    lighting: dict,
    incidents: dict,
    bag: dict,
    overlast_zones: list,
    unsafe_areas: list,
    buurt_shapes: list,
    dry_run: bool,
) -> list[dict]:
    cells = all_cells()
    print(f"  Computing scores for {len(cells)} grid cells...")

    records = []
    for grid_x, grid_y in cells:
        lat, lng = cell_coords(grid_x, grid_y)
        pt = Point(lng, lat)

        lighting_score = lighting.get((grid_x, grid_y), 0.0)
        incident_density = incidents.get((grid_x, grid_y), 0.0)
        incident_score = 1.0 - incident_density  # inverted: fewer incidents = safer
        building_density_score = bag.get((grid_x, grid_y), 0.5)

        # Overview score: reduced by parks/tunnels overlapping the cell
        overview_score = 1.0

        # Camera bonus and overlast penalty from overlastgebieden
        camera_bonus = 0.0
        overlast_penalty = 0.0
        for zone in overlast_zones:
            try:
                if zone["shape"].contains(pt) or zone["shape"].distance(pt) < GRID_RES / 2:
                    if zone["polarity"] == "bonus":
                        camera_bonus = min(camera_bonus + 0.1, 0.2)
                    else:
                        overlast_penalty = min(overlast_penalty + 0.05, 0.3)
            except Exception:
                pass

        # Hotspot penalty from unsafe_areas
        hotspot_penalty = 0.0
        for area in unsafe_areas:
            try:
                if area["shape"].contains(pt) or area["shape"].distance(pt) < GRID_RES / 2:
                    hotspot_penalty = min(hotspot_penalty + 0.1, 0.2)
                    break
            except Exception:
                pass

        # Buurt code via point-in-polygon
        buurt_code = None
        for buurt in buurt_shapes:
            try:
                if buurt["shape"].contains(pt):
                    buurt_code = buurt["buurt_code"]
                    break
            except Exception:
                pass

        records.append({
            "id": str(uuid.uuid4()),
            "grid_x": grid_x,
            "grid_y": grid_y,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "buurt_code": buurt_code,
            "lighting_score": round(lighting_score, 4),
            "incident_score": round(incident_score, 4),
            "building_density_score": round(building_density_score, 4),
            "overview_score": round(overview_score, 4),
            "camera_bonus": round(camera_bonus, 4),
            "overlast_penalty": round(overlast_penalty, 4),
            "hotspot_penalty": round(hotspot_penalty, 4),
        })

    return records


# ---------------------------------------------------------------------------
# Upsert
# ---------------------------------------------------------------------------

def upsert_grid(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        sample = records[0] if records else {}
        print(f"[dry-run] Would upsert {len(records)} grid cells.")
        print("  Sample:", {k: v for k, v in sample.items() if k != "id"})
        return

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    print(f"  Clearing existing safety_grid...")
    client.table("safety_grid").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    total = 0
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("safety_grid").insert(chunk).execute()
        total += len(chunk)
        if total % 5000 == 0 or total == len(records):
            print(f"  Inserted {total}/{len(records)} cells...")

    print(f"Done. {total} grid cells written to safety_grid.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(dry_run: bool) -> None:
    print("\n[1/5] Fetching lighting + incidents from Amsterdam API...")
    lighting, incidents = await asyncio.gather(
        fetch_lighting_density(),
        fetch_incident_density(),
    )

    print("\n[2/5] Loading local data files...")
    bag = load_bag_density()
    buurt_shapes = load_buurt_shapes()

    print("\n[3/5] Loading polygon layers from Supabase...")
    overlast_zones = load_supabase_polygons("overlast_zones")
    unsafe_areas = load_supabase_polygons("unsafe_areas")

    print("\n[4/5] Computing grid scores...")
    records = build_grid(lighting, incidents, bag, overlast_zones, unsafe_areas, buurt_shapes, dry_run)

    print(f"\n[5/5] Writing {len(records)} cells to Supabase safety_grid...")
    upsert_grid(records, dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute pre-scored safety grid for Amsterdam.")
    parser.add_argument("--dry-run", action="store_true", help="Compute but do not write to DB.")
    args = parser.parse_args()

    print("=== Stella.app safety grid computation ===")
    start = datetime.now()
    asyncio.run(run(args.dry_run))
    elapsed = (datetime.now() - start).total_seconds()
    print(f"\nTotal time: {elapsed:.0f}s")


if __name__ == "__main__":
    main()
