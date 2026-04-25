"""Shared async client for the Amsterdam Data API with pagination and retry."""

import asyncio
import os
from typing import AsyncIterator

import httpx

BASE_URL = "https://api.data.amsterdam.nl/v1"
AMSTERDAM_BBOX = (52.27, 4.72, 52.43, 5.08)  # lat_min, lng_min, lat_max, lng_max
PAGE_SIZE = 1000
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0


def _headers() -> dict[str, str]:
    headers = {"Accept-Crs": "EPSG:4326"}
    key = os.getenv("AMSTERDAM_DATA_API_KEY", "")
    if key:
        headers["X-Api-Key"] = key
    return headers


async def _get_json(client: httpx.AsyncClient, url: str, params: dict) -> dict:
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.get(url, params=params, headers=_headers(), timeout=30)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = RETRY_BACKOFF ** attempt
            print(f"  Retry {attempt + 1}/{MAX_RETRIES} after {wait}s ({exc})")
            await asyncio.sleep(wait)
    raise RuntimeError("unreachable")


def _extract_items(data: dict) -> list:
    """Extract the list of items from any Amsterdam Data API response format."""
    # GeoJSON FeatureCollection
    if data.get("type") == "FeatureCollection":
        return data.get("features", [])
    # HAL+JSON _embedded (key is dataset-specific)
    embedded = data.get("_embedded", {})
    if embedded:
        return next(iter(embedded.values()), [])
    # DRF-style
    return data.get("results", [])


async def paginate(path: str, params: dict | None = None) -> AsyncIterator[dict]:
    """Yield all items from a paginated Amsterdam Data API endpoint."""
    url = f"{BASE_URL}/{path.lstrip('/')}"
    extra = dict(params or {})
    extra.setdefault("_pageSize", PAGE_SIZE)

    async with httpx.AsyncClient() as client:
        while url:
            data = await _get_json(client, url, extra)
            items = _extract_items(data)
            for item in items:
                yield item

            # Follow HAL _links.next
            next_link = data.get("_links", {}).get("next")
            if isinstance(next_link, dict):
                url = next_link.get("href")
            elif isinstance(next_link, str):
                url = next_link
            else:
                url = None
            extra = {}  # params already encoded in next URL
