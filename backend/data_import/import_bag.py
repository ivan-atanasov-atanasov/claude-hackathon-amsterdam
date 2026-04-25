"""
Fetch BAG (Basisregistratie Adressen en Gebouwen) building data from Amsterdam Data API.

Source: /v1/bag/v2/panden  (building footprints)
Aggregates residential + non-residential building counts per ~100m grid cell.
Output stored locally as backend/data/bag_density.json for use by the grid scorer.

Usage:
    cd backend && source venv/bin/activate
    python -m data_import.import_bag [--dry-run]
"""

import argparse
import asyncio
import json
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv

from .client import AMSTERDAM_BBOX, paginate

load_dotenv()

ENDPOINT = "bag/v2/panden"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "bag_density.json"

# ~100m grid resolution in degrees (≈0.001° ≈ 111m)
GRID_RES = 0.001


def _cell(lat: float, lng: float) -> tuple[int, int]:
    lat_min, lng_min, _, _ = AMSTERDAM_BBOX
    x = int((lng - lng_min) / GRID_RES)
    y = int((lat - lat_min) / GRID_RES)
    return x, y


def _in_bbox(lat: float, lng: float) -> bool:
    lat_min, lng_min, lat_max, lng_max = AMSTERDAM_BBOX
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


def _centroid(geom: dict) -> tuple[float, float] | None:
    """Return (lat, lng) centroid of a GeoJSON geometry."""
    try:
        coords_list: list = []
        t = geom.get("type", "")
        raw = geom.get("coordinates", [])
        if t == "Point":
            coords_list = [raw]
        elif t == "Polygon":
            coords_list = raw[0] if raw else []
        elif t == "MultiPolygon":
            for poly in raw:
                coords_list.extend(poly[0] if poly else [])
        if not coords_list:
            return None
        lng = sum(c[0] for c in coords_list) / len(coords_list)
        lat = sum(c[1] for c in coords_list) / len(coords_list)
        return lat, lng
    except Exception:
        return None


async def fetch_density() -> dict[tuple[int, int], int]:
    counts: dict[tuple[int, int], int] = defaultdict(int)
    async for feature in paginate(ENDPOINT):
        geom = feature.get("geometry")
        if not geom:
            continue
        centroid = _centroid(geom)
        if not centroid:
            continue
        lat, lng = centroid
        if not _in_bbox(lat, lng):
            continue
        cell = _cell(lat, lng)
        counts[cell] += 1
    return counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Fetching BAG building data (this may take a while)...")
    counts = asyncio.run(fetch_density())
    print(f"  Aggregated {sum(counts.values())} buildings across {len(counts)} grid cells.")

    if args.dry_run:
        print("[dry-run] Would write to", OUTPUT_PATH)
        return

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    serializable = {f"{x},{y}": count for (x, y), count in counts.items()}
    with open(OUTPUT_PATH, "w") as f:
        json.dump(serializable, f)
    print(f"Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
