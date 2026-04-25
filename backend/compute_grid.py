"""
One-shot script: fetch all data layers, compute safety_grid scores, write to Supabase.

Lighting points and incidents are fetched from the Amsterdam Data API in memory —
never stored in the database. Only safety_grid (the scored output) is persisted.

Run after import_all.py:
    cd backend && source venv/bin/activate
    python compute_grid.py [--dry-run]

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
from shapely.geometry import Point, box, shape
from shapely.strtree import STRtree
from supabase import create_client

from data_import.client import AMSTERDAM_BBOX, paginate

load_dotenv()

GRID_RES = 0.001  # ~111m per degree at Amsterdam's latitude
DATA_DIR = Path(__file__).parent / "data"
CHUNK_SIZE = 500


# ---------------------------------------------------------------------------
# Grid helpers
# ---------------------------------------------------------------------------

def cell_center(grid_x: int, grid_y: int) -> tuple[float, float]:
    lat_min, lng_min, _, _ = AMSTERDAM_BBOX
    lat = lat_min + grid_y * GRID_RES + GRID_RES / 2
    lng = lng_min + grid_x * GRID_RES + GRID_RES / 2
    return round(lat, 6), round(lng, 6)


def point_to_cell(lat: float, lng: float) -> tuple[int, int]:
    lat_min, lng_min, _, _ = AMSTERDAM_BBOX
    return int((lng - lng_min) / GRID_RES), int((lat - lat_min) / GRID_RES)


def all_cells() -> list[tuple[int, int]]:
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    x_max = int((lng_max - lng_min) / GRID_RES)
    y_max = int((lat_max - lat_min) / GRID_RES)
    return [(x, y) for y in range(y_max) for x in range(x_max)]


def normalize(counts: dict, percentile: float = 0.95) -> dict:
    """Normalize counts 0–1 using a percentile cap to reduce outlier influence."""
    if not counts:
        return {}
    values = sorted(counts.values())
    cap = values[int(len(values) * percentile)] or 1
    return {k: min(v / cap, 1.0) for k, v in counts.items()}


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

async def fetch_lighting_density() -> dict[tuple[int, int], float]:
    print("  Fetching lighting points...")
    raw: dict[tuple[int, int], int] = defaultdict(int)
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    n = 0
    async for item in paginate("leidingeninfrastructuur/amsterdam_ovl_lichtpunten"):
        geom = item.get("geometry") or {}
        coords = geom.get("coordinates")
        if not coords or len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            raw[point_to_cell(lat, lng)] += 1
            n += 1
    print(f"    {n} lighting points → {len(raw)} cells.")
    return normalize(raw)


async def fetch_incident_density() -> dict[tuple[int, int], float]:
    print("  Fetching incident reports (last 24 months)...")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=730)).strftime("%Y-%m-%d")
    relevant = {
        "Overlast van en door personen of groepen",
        "Overlast in de openbare ruimte",
        "Overlast van boten",
        "Overlast Bedrijven en Horeca",
    }
    raw: dict[tuple[int, int], int] = defaultdict(int)
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    n = 0
    async for item in paginate("meldingen/meldingen", {"datumMelding[gte]": cutoff}):
        if item.get("hoofdcategorie") not in relevant:
            continue
        try:
            lat = float(item["latitudeVisualisatie"])
            lng = float(item["longitudeVisualisatie"])
        except (KeyError, TypeError, ValueError):
            continue
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            raw[point_to_cell(lat, lng)] += 1
            n += 1
    print(f"    {n} incidents → {len(raw)} cells.")
    return normalize(raw)


def load_bag_density() -> dict[tuple[int, int], float]:
    path = DATA_DIR / "bag_density.json"
    if not path.exists():
        print("  bag_density.json not found — building_density_score defaults to 0.5.")
        return {}
    with open(path) as f:
        raw = json.load(f)
    counts = {tuple(int(v) for v in k.split(",")): v for k, v in raw.items()}
    normalized = normalize(counts)
    print(f"  Loaded building density for {len(normalized)} cells.")
    return normalized


def load_buurt_shapes() -> tuple[list, STRtree]:
    path = DATA_DIR / "buurt_polygons.json"
    if not path.exists():
        print("  buurt_polygons.json missing — run import_gebieden.py first.")
        return [], STRtree([])
    with open(path) as f:
        data = json.load(f)
    shapes, meta = [], []
    for feat in data:
        try:
            s = shape(feat["geometry"])
            shapes.append(s)
            meta.append(feat["buurt_code"])
        except Exception:
            pass
    print(f"  Loaded {len(shapes)} buurt polygons → spatial index built.")
    return meta, STRtree(shapes)


def load_zone_shapes(table: str) -> tuple[list, STRtree]:
    """Load polygon zones from Supabase and build an STRtree for fast lookup."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    rows = client.table(table).select("*").execute().data
    shapes, meta = [], []
    for row in rows:
        try:
            geom = json.loads(row["geometry"]) if isinstance(row["geometry"], str) else row["geometry"]
            s = shape(geom)
            shapes.append(s)
            meta.append(row)
        except Exception:
            pass
    print(f"  Loaded {len(shapes)} rows from {table} → spatial index built.")
    return meta, STRtree(shapes)


# ---------------------------------------------------------------------------
# Grid computation
# ---------------------------------------------------------------------------

def build_grid(
    lighting: dict,
    incidents: dict,
    bag: dict,
    overlast_meta: list,
    overlast_tree: STRtree,
    unsafe_meta: list,
    unsafe_tree: STRtree,
    buurt_meta: list,
    buurt_tree: STRtree,
) -> list[dict]:
    cells = all_cells()
    print(f"  Scoring {len(cells)} grid cells...")

    records = []
    half = GRID_RES / 2

    for grid_x, grid_y in cells:
        lat, lng = cell_center(grid_x, grid_y)
        cell_box = box(lng - half, lat - half, lng + half, lat + half)
        pt = Point(lng, lat)

        lighting_score    = lighting.get((grid_x, grid_y), 0.0)
        incident_density  = incidents.get((grid_x, grid_y), 0.0)
        incident_score    = round(1.0 - incident_density, 4)  # inverted
        building_density_score = bag.get((grid_x, grid_y), 0.5)
        overview_score    = 1.0  # refined in future by park/tunnel overlap

        # Camera bonus and overlast penalty — fast via STRtree
        camera_bonus     = 0.0
        overlast_penalty = 0.0
        for idx in overlast_tree.query(cell_box):
            zone = overlast_meta[idx]
            try:
                if overlast_tree.geometries[idx].intersects(cell_box):
                    if zone["polarity"] == "bonus":
                        camera_bonus = min(camera_bonus + 0.1, 0.2)
                    else:
                        overlast_penalty = min(overlast_penalty + 0.05, 0.3)
            except Exception:
                pass

        # Hotspot penalty — fast via STRtree
        hotspot_penalty = 0.0
        for idx in unsafe_tree.query(cell_box):
            try:
                if unsafe_tree.geometries[idx].intersects(cell_box):
                    hotspot_penalty = min(hotspot_penalty + 0.1, 0.2)
            except Exception:
                pass

        # Buurt code — point-in-polygon via STRtree
        buurt_code = None
        for idx in buurt_tree.query(pt):
            try:
                if buurt_tree.geometries[idx].contains(pt):
                    buurt_code = buurt_meta[idx]
                    break
            except Exception:
                pass

        records.append({
            "id": str(uuid.uuid4()),
            "grid_x": grid_x,
            "grid_y": grid_y,
            "lat": lat,
            "lng": lng,
            "buurt_code": buurt_code,
            "lighting_score":          round(lighting_score, 4),
            "incident_score":          round(incident_score, 4),
            "building_density_score":  round(building_density_score, 4),
            "overview_score":          round(overview_score, 4),
            "camera_bonus":            round(camera_bonus, 4),
            "overlast_penalty":        round(overlast_penalty, 4),
            "hotspot_penalty":         round(hotspot_penalty, 4),
        })

    return records


# ---------------------------------------------------------------------------
# Upsert
# ---------------------------------------------------------------------------

def upsert_grid(records: list[dict], dry_run: bool) -> None:
    if dry_run:
        non_zero = [r for r in records if r["lighting_score"] > 0 or r["hotspot_penalty"] > 0]
        print(f"[dry-run] {len(records)} cells computed; {len(non_zero)} with non-zero scores.")
        if non_zero:
            print("  Sample with data:", {k: v for k, v in non_zero[0].items() if k != "id"})
        return

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    print("  Clearing existing safety_grid...")
    client.table("safety_grid").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    total = 0
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("safety_grid").insert(chunk).execute()
        total += len(chunk)
        if total % 10000 == 0 or total == len(records):
            print(f"  Inserted {total}/{len(records)} cells...")

    print(f"Done. {total} grid cells written to safety_grid.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(dry_run: bool) -> None:
    print("\n[1/5] Fetching lighting + incidents from Amsterdam API (parallel)...")
    lighting, incidents = await asyncio.gather(
        fetch_lighting_density(),
        fetch_incident_density(),
    )

    print("\n[2/5] Loading local data files...")
    bag = load_bag_density()

    print("\n[3/5] Loading polygon layers from Supabase + building spatial indexes...")
    buurt_meta, buurt_tree   = load_buurt_shapes()
    overlast_meta, overlast_tree = load_zone_shapes("overlast_zones")
    unsafe_meta, unsafe_tree     = load_zone_shapes("unsafe_areas")

    print("\n[4/5] Computing grid scores...")
    t0 = datetime.now()
    records = build_grid(
        lighting, incidents, bag,
        overlast_meta, overlast_tree,
        unsafe_meta, unsafe_tree,
        buurt_meta, buurt_tree,
    )
    print(f"    Grid computed in {(datetime.now() - t0).total_seconds():.1f}s.")

    print(f"\n[5/5] Writing {len(records)} cells to Supabase safety_grid...")
    upsert_grid(records, dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute pre-scored safety grid for Amsterdam.")
    parser.add_argument("--dry-run", action="store_true", help="Compute but do not write to DB.")
    args = parser.parse_args()

    print("=== Stella.app safety grid computation ===")
    t_start = datetime.now()
    asyncio.run(run(args.dry_run))
    print(f"\nTotal elapsed: {(datetime.now() - t_start).total_seconds():.0f}s")


if __name__ == "__main__":
    main()
