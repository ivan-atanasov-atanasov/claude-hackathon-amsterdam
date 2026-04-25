"""
Deterministic route scoring engine.

Scores each Google Directions route alternative using the pre-computed
safety_grid and time-of-day weights, then selects the highest-scoring one.

cell_score(t) = veiligheidsindex_buurt
  × ( w_people(t)   × people_density(t)
    + w_overview(t)  × overview_score
    + w_light(t)     × lighting_score
    + w_buildings(t) × building_density_score
    + w_camera(t)    × camera_bonus
    − w_overlast(t)  × overlast_penalty
    − w_incident(t)  × incident_score   [incident_score is already inverted]
    − w_hotspot(t)   × hotspot_penalty
    )

route_score = mean(cell_score) across sampled points, scaled 0–10.
"""

import asyncio
import os
from datetime import datetime, timezone

import polyline as polyline_lib
from supabase import create_client, Client

from .people_density import get_people_density

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _supabase

# Time-of-day weight tables (from PRD, seeded from 2025 survey Table 2)
_WEIGHTS = {
    "day": {
        "people": 0.22, "overview": 0.16, "lighting": 0.14, "buildings": 0.18,
        "camera": 0.04, "overlast": 0.08, "incidents": 0.10, "hotspot": 0.08,
    },
    "evening": {
        "people": 0.20, "overview": 0.18, "lighting": 0.20, "buildings": 0.14,
        "camera": 0.06, "overlast": 0.14, "incidents": 0.10, "hotspot": 0.12,
    },
    "night": {
        "people": 0.18, "overview": 0.20, "lighting": 0.26, "buildings": 0.10,
        "camera": 0.08, "overlast": 0.18, "incidents": 0.10, "hotspot": 0.16,
    },
}

# Amsterdam grid constants (must match compute_grid.py)
_GRID_RES = 0.001
_LAT_MIN, _LNG_MIN = 52.27, 4.72
_SAMPLE_EVERY_M = 50  # sample polyline every ~50m


def _time_window(dt: datetime) -> str:
    h = dt.hour
    if 6 <= h < 20:
        return "day"
    if 20 <= h < 23:
        return "evening"
    return "night"


def _decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """Return list of (lat, lng) tuples."""
    return polyline_lib.decode(encoded)


def _sample_points(coords: list[tuple[float, float]], every_m: float = _SAMPLE_EVERY_M) -> list[tuple[float, float]]:
    """Subsample a polyline to at most one point per ~every_m metres."""
    if not coords:
        return []
    sampled = [coords[0]]
    deg_per_m = 1 / 111320
    threshold = every_m * deg_per_m
    for lat, lng in coords[1:]:
        prev_lat, prev_lng = sampled[-1]
        dist = ((lat - prev_lat) ** 2 + (lng - prev_lng) ** 2) ** 0.5
        if dist >= threshold:
            sampled.append((lat, lng))
    return sampled


def _lat_lng_to_cell(lat: float, lng: float) -> tuple[int, int]:
    return int((lng - _LNG_MIN) / _GRID_RES), int((lat - _LAT_MIN) / _GRID_RES)


def _fetch_grid_cells(cell_keys: set[tuple[int, int]]) -> dict[tuple[int, int], dict]:
    """Batch-fetch safety_grid rows for the given cell keys."""
    if not cell_keys:
        return {}
    client = _get_supabase()
    # Fetch by grid_x/grid_y pairs — Supabase doesn't support tuple IN, so we
    # fetch a bounding box and filter in Python.
    xs = [k[0] for k in cell_keys]
    ys = [k[1] for k in cell_keys]
    rows = (
        client.table("safety_grid")
        .select("*")
        .gte("grid_x", min(xs))
        .lte("grid_x", max(xs))
        .gte("grid_y", min(ys))
        .lte("grid_y", max(ys))
        .execute()
        .data
    )
    return {(r["grid_x"], r["grid_y"]): r for r in rows if (r["grid_x"], r["grid_y"]) in cell_keys}


def _fetch_buurt_baseline(buurt_codes: set[str]) -> dict[str, float]:
    if not buurt_codes:
        return {}
    client = _get_supabase()
    rows = (
        client.table("buurt_baseline")
        .select("buurt_code,veiligheidsindex")
        .in_("buurt_code", list(buurt_codes))
        .execute()
        .data
    )
    return {r["buurt_code"]: r["veiligheidsindex"] for r in rows}


async def score_route(
    encoded_polyline: str,
    departure_time: datetime,
) -> tuple[float, list[str]]:
    """
    Score a single route polyline.

    Returns (route_score 0–10, hotspot_kinds_passed).
    """
    coords = _decode_polyline(encoded_polyline)
    points = _sample_points(coords)
    if not points:
        return 0.0, []

    window = _time_window(departure_time)
    w = _WEIGHTS[window]

    # Resolve grid cells for all sample points
    cell_keys = {_lat_lng_to_cell(lat, lng) for lat, lng in points}
    grid_data = _fetch_grid_cells(cell_keys)

    # Fetch buurt baselines
    buurt_codes = {r["buurt_code"] for r in grid_data.values() if r.get("buurt_code")}
    baselines = _fetch_buurt_baseline(buurt_codes)

    hotspot_kinds: set[str] = set()
    cell_scores: list[float] = []

    for lat, lng in points:
        cell = _lat_lng_to_cell(lat, lng)
        row = grid_data.get(cell)
        if not row:
            cell_scores.append(5.0)  # neutral default for unmapped cells
            continue

        veiligheidsindex = baselines.get(row.get("buurt_code"), 0.7)

        # People density (async call — cached after first hit per location)
        people, _ = await get_people_density(
            lat, lng, departure_time,
            building_density=row.get("building_density_score", 0.5),
        )

        # Collect hotspot kinds for avoidance summary
        if row.get("hotspot_penalty", 0) > 0:
            # We don't have the kind here, flag generically for now
            hotspot_kinds.add("unsafe_area")

        if row.get("camera_bonus", 0) > 0:
            hotspot_kinds.add("camera_zone")

        raw = (
            w["people"]    * people
          + w["overview"]  * row.get("overview_score", 1.0)
          + w["lighting"]  * row.get("lighting_score", 0.5)
          + w["buildings"] * row.get("building_density_score", 0.5)
          + w["camera"]    * row.get("camera_bonus", 0.0)
          - w["overlast"]  * row.get("overlast_penalty", 0.0)
          - w["incidents"] * (1.0 - row.get("incident_score", 1.0))  # incident_score is inverted
          - w["hotspot"]   * row.get("hotspot_penalty", 0.0)
        )
        cell_score = max(0.0, min(1.0, raw)) * veiligheidsindex * 10
        cell_scores.append(cell_score)

    route_score = sum(cell_scores) / len(cell_scores) if cell_scores else 0.0
    return round(route_score, 2), sorted(hotspot_kinds)


async def select_safest_route(
    routes: list[dict],
    departure_time: datetime,
) -> tuple[dict, float, list[str], list[dict]]:
    """
    Score all route alternatives and return (best_route, score, hotspots, scored_alternatives).

    scored_alternatives contains every route with its safety_score attached, sorted
    best-first — useful for evaluation and the frontend comparison view.
    """
    results = await asyncio.gather(
        *[score_route(r["polyline"], departure_time) for r in routes]
    )
    best_route, best_score, best_hotspots = routes[0], 0.0, []
    scored = []
    for route, (score, hotspots) in zip(routes, results):
        scored.append({**route, "safety_score": score, "hotspots": hotspots})
        if score > best_score:
            best_route, best_score, best_hotspots = route, score, hotspots

    scored.sort(key=lambda r: r["safety_score"], reverse=True)
    return best_route, best_score, best_hotspots, scored
