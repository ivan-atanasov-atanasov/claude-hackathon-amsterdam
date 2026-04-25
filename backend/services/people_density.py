"""
Time-aware people density scoring — pure heuristic, no external HTTP calls.

The crowdmonitor API was called once per sampled route point (every ~50m),
causing 40–120 sequential network round-trips per /routes request and 30–42s
response times. Replaced with a fast, deterministic heuristic that uses
building density and time-of-day instead.

Returned value: float 0.0–1.0 (higher = more people present = safer).
"""

from datetime import datetime


def _time_window(dt: datetime) -> str:
    h = dt.hour
    if 6 <= h < 20:
        return "day"
    if 20 <= h < 23:
        return "evening"
    return "night"


def _infer_street_type(building_density: float, hotspot_kind: str | None) -> str:
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


_HEURISTIC: dict[str, dict[str, float]] = {
    "residential": {"day": 0.4, "evening": 0.3, "night": 0.1},
    "commercial":  {"day": 0.8, "evening": 0.6, "night": 0.2},
    "park":        {"day": 0.5, "evening": 0.2, "night": 0.05},
    "transit":     {"day": 0.7, "evening": 0.5, "night": 0.2},
    "nightlife":   {"day": 0.5, "evening": 0.9, "night": 0.7},
    "default":     {"day": 0.5, "evening": 0.35, "night": 0.12},
}


async def get_people_density(
    lat: float,
    lng: float,
    departure_time: datetime,
    building_density: float = 0.5,
    hotspot_kind: str | None = None,
) -> tuple[float, str]:
    """Return (density_score 0.0–1.0, source='heuristic')."""
    window = _time_window(departure_time)
    street_type = _infer_street_type(building_density, hotspot_kind)
    return _HEURISTIC[street_type][window], "heuristic"


def get_people_density_sync(
    lat: float,
    lng: float,
    departure_time: datetime,
    building_density: float = 0.5,
    hotspot_kind: str | None = None,
) -> tuple[float, str]:
    import asyncio
    return asyncio.run(get_people_density(lat, lng, departure_time, building_density, hotspot_kind))
