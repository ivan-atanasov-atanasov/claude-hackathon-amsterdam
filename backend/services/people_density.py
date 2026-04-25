"""
Time-aware people density scoring.

Uses Amsterdam crowdmonitor sensor data where available; falls back to a
street-type × time-of-day heuristic for uncovered areas.

Returned value is a float 0.0–1.0 (higher = more people = safer).
"""

import asyncio
import time
from datetime import datetime, timezone
from functools import lru_cache

import httpx

CROWDMONITOR_URL = "https://api.data.amsterdam.nl/v1/crowdmonitor/crowdmonitor/"
CACHE_TTL = 900  # 15 minutes

_cache: dict[str, tuple[float, float]] = {}  # key → (score, expires_at)


def _time_window(dt: datetime) -> str:
    """Return 'day', 'evening', or 'night' for a given datetime."""
    h = dt.hour
    if 6 <= h < 20:
        return "day"
    if 20 <= h < 23:
        return "evening"
    return "night"


# Heuristic density table: street_type × time_window → 0.0–1.0
# Higher = more people present = safer (less isolated)
_HEURISTIC: dict[str, dict[str, float]] = {
    "residential": {"day": 0.4, "evening": 0.3, "night": 0.1},
    "commercial":  {"day": 0.8, "evening": 0.6, "night": 0.2},
    "park":        {"day": 0.5, "evening": 0.2, "night": 0.05},
    "transit":     {"day": 0.7, "evening": 0.5, "night": 0.2},
    "nightlife":   {"day": 0.5, "evening": 0.9, "night": 0.7},
    "default":     {"day": 0.5, "evening": 0.35, "night": 0.12},
}


def _infer_street_type(building_density: float, hotspot_kind: str | None) -> str:
    """Infer a street type from grid cell metadata."""
    if hotspot_kind in ("park",):
        return "park"
    if hotspot_kind in ("station",):
        return "transit"
    if hotspot_kind in ("square", "corridor"):
        return "nightlife"
    if building_density >= 0.7:
        return "commercial"
    if building_density >= 0.3:
        return "residential"
    return "default"


async def _fetch_crowdmonitor(lat: float, lng: float) -> float | None:
    """
    Try to fetch a real pedestrian density reading from the crowdmonitor API.
    Returns 0.0–1.0 or None if no sensor covers this location.
    """
    cache_key = f"{lat:.3f},{lng:.3f}"
    now = time.time()
    if cache_key in _cache:
        score, expires = _cache[cache_key]
        if now < expires:
            return score

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(
                CROWDMONITOR_URL,
                params={
                    "location[near]": f"{lng},{lat}",
                    "_pageSize": 1,
                },
                headers={"Accept-Crs": "EPSG:4326"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            embedded = data.get("_embedded", {})
            items = list(embedded.values())[0] if embedded else []
            if not items:
                return None

            item = items[0]
            # Normalize sensor reading; field names vary per sensor type
            raw = (
                item.get("aantal")
                or item.get("count")
                or item.get("drukte_index")
            )
            if raw is None:
                return None

            # Drukte index is already 0–1; counts need normalization (cap at 500)
            score = min(float(raw) / 500, 1.0) if float(raw) > 1 else float(raw)
            _cache[cache_key] = (score, now + CACHE_TTL)
            return score
    except Exception:
        return None


async def get_people_density(
    lat: float,
    lng: float,
    departure_time: datetime,
    building_density: float = 0.5,
    hotspot_kind: str | None = None,
) -> tuple[float, str]:
    """
    Return (density_score 0.0–1.0, source) where source is 'crowdmonitor' or 'heuristic'.
    """
    # Try real sensor data first
    sensor = await _fetch_crowdmonitor(lat, lng)
    if sensor is not None:
        return sensor, "crowdmonitor"

    # Heuristic fallback
    window = _time_window(departure_time)
    street_type = _infer_street_type(building_density, hotspot_kind)
    score = _HEURISTIC[street_type][window]
    return score, "heuristic"


def get_people_density_sync(
    lat: float,
    lng: float,
    departure_time: datetime,
    building_density: float = 0.5,
    hotspot_kind: str | None = None,
) -> tuple[float, str]:
    """Synchronous wrapper for use outside async contexts."""
    return asyncio.run(get_people_density(lat, lng, departure_time, building_density, hotspot_kind))
