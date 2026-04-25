"""
Detect which named unsafe_areas (parks, squares, stations, corridors) a route
polyline passes near, plus how many crowdsourced Pointer reports it touches.

Used to power the "Why is this a safer route?" panel by comparing the safest
route's avoidances against an alternative's.

Each unsafe_area in the DB has: name, kind, source, geometry (MultiPolygon).
We pre-compute centroid + radius once at module load and cache them — checking
proximity then becomes a simple distance comparison per polyline point.
"""

import json
import logging
import math
from functools import lru_cache

import polyline as polyline_lib

from .route_scorer import _get_supabase

logger = logging.getLogger(__name__)


# Distance in metres from a route point at which we consider an area "passed through"
PROXIMITY_BUFFER_M = 80
# Crowdsourced Pointer points are tighter — they're already specific spots
POINTER_BUFFER_M = 60

# Per-kind reason strings shown to the user
KIND_REASONS: dict[str, str] = {
    "park":   "dark and isolated paths after sunset",
    "square": "open square reported as unsafe by residents",
    "station":"transient area with frequent reports of harassment",
    "corridor": "isolated stretch with poor street-level visibility",
}


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in metres between two lat/lng points."""
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def _polygon_bounds(geom: dict) -> tuple[float, float, float] | None:
    """Return (centroid_lat, centroid_lng, max_radius_m) or None if invalid."""
    coords_list: list[tuple[float, float]] = []

    def walk(node):
        if isinstance(node, list) and len(node) >= 2 and isinstance(node[0], (int, float)):
            coords_list.append((float(node[1]), float(node[0])))  # geojson is (lng, lat)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(geom.get("coordinates", []))
    if not coords_list:
        return None

    clat = sum(c[0] for c in coords_list) / len(coords_list)
    clng = sum(c[1] for c in coords_list) / len(coords_list)
    radius = max(_haversine_m(clat, clng, lat, lng) for lat, lng in coords_list)
    return clat, clng, radius


@lru_cache(maxsize=1)
def _load_unsafe_areas() -> tuple[list[dict], list[dict]]:
    """Load all unsafe_areas once. Returns (named_areas, pointer_points)."""
    sb = _get_supabase()
    rows = sb.table("unsafe_areas").select("*").execute().data
    logger.info("Loaded %d unsafe_areas", len(rows))

    named: list[dict] = []
    pointer: list[dict] = []

    for row in rows:
        try:
            geom = json.loads(row["geometry"]) if isinstance(row["geometry"], str) else row["geometry"]
        except Exception:
            continue
        bounds = _polygon_bounds(geom)
        if not bounds:
            continue
        clat, clng, radius = bounds

        entry = {
            "name": row.get("name"),
            "kind": row.get("kind"),
            "source": row.get("source"),
            "centroid_lat": clat,
            "centroid_lng": clng,
            "radius_m": radius,
        }
        if row.get("kind") == "crowdsourced_point":
            pointer.append(entry)
        else:
            named.append(entry)

    return named, pointer


def detect_passed_areas(encoded_polyline: str) -> dict:
    """
    Return what unsafe areas this route passes near.

    {
      "named": [{"name": "Vondelpark", "kind": "park", "reason": "..."}],
      "pointer_count": 12,
    }
    """
    try:
        coords = polyline_lib.decode(encoded_polyline)
    except Exception:
        return {"named": [], "pointer_count": 0}

    named_areas, pointer_points = _load_unsafe_areas()

    matched_named: dict[str, dict] = {}
    pointer_hits: set[int] = set()

    for lat, lng in coords:
        for area in named_areas:
            if area["name"] in matched_named:
                continue
            d = _haversine_m(lat, lng, area["centroid_lat"], area["centroid_lng"])
            if d <= area["radius_m"] + PROXIMITY_BUFFER_M:
                matched_named[area["name"]] = {
                    "name": area["name"],
                    "kind": area["kind"],
                    "reason": KIND_REASONS.get(area["kind"], "reported as unsafe"),
                }

        # Crowdsourced points (much smaller radius)
        for i, pt in enumerate(pointer_points):
            if i in pointer_hits:
                continue
            d = _haversine_m(lat, lng, pt["centroid_lat"], pt["centroid_lng"])
            if d <= max(pt["radius_m"], 1.0) + POINTER_BUFFER_M:
                pointer_hits.add(i)

    return {
        "named": list(matched_named.values()),
        "pointer_count": len(pointer_hits),
    }


def diff_avoidances(safe_passed: dict, alt_passed: dict) -> dict:
    """
    Compute what the safe route specifically avoids that the alternative passes through.

    safe_passed and alt_passed are outputs of detect_passed_areas().
    """
    safe_names = {n["name"] for n in safe_passed["named"]}
    alt_names = {n["name"] for n in alt_passed["named"]}

    # Things present on alt but NOT on safe = specifically avoided
    avoided_names = alt_names - safe_names
    avoided_named = [n for n in alt_passed["named"] if n["name"] in avoided_names]

    pointer_diff = max(0, alt_passed["pointer_count"] - safe_passed["pointer_count"])

    return {
        "avoided_named": avoided_named,
        "avoided_pointer_count": pointer_diff,
        "safe_still_passes": list(safe_names),
    }
