import os
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from services.route_scorer import select_safest_route
from services.ai_narrator import generate_route_narrative

load_dotenv()

app = FastAPI()

_extra = [o for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://claude-hackathon-amsterdam.vercel.app",
        *_extra,
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

DIRECTIONS_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY", "")
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/routes")
async def get_routes(
    origin: str = Query(..., description="Start address or lat,lng"),
    destination: str = Query(..., description="End address or lat,lng"),
    mode: str = Query("bicycling", description="Travel mode: bicycling or walking"),
    departure_time: str = Query(None, description="ISO 8601 departure time; defaults to now"),
):
    if not DIRECTIONS_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_DIRECTIONS_API_KEY not configured")

    if departure_time:
        try:
            dt = datetime.fromisoformat(departure_time)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid departure_time format; use ISO 8601")
    else:
        dt = datetime.now(timezone.utc)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            DIRECTIONS_URL,
            params={
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "alternatives": "true",
                "key": DIRECTIONS_API_KEY,
            },
            timeout=10,
        )

    data = resp.json()
    status = data.get("status")

    if status != "OK":
        raise HTTPException(status_code=400, detail=f"Directions API error: {status}")

    routes = [
        {
            "summary": r.get("summary", ""),
            "distance_m": r["legs"][0]["distance"]["value"],
            "distance_text": r["legs"][0]["distance"]["text"],
            "duration_s": r["legs"][0]["duration"]["value"],
            "duration_text": r["legs"][0]["duration"]["text"],
            "polyline": r["overview_polyline"]["points"],
            "start_location": r["legs"][0]["start_location"],
            "end_location": r["legs"][0]["end_location"],
        }
        for r in data["routes"]
    ]

    # Score all route alternatives and select the safest
    best_route, safety_score, hotspots = await select_safest_route(routes, dt)

    # Return route immediately — frontend fetches AI tips separately via /tips
    from services.ai_narrator import _fallback_response
    fallback = _fallback_response(hotspots, dt)

    return {
        "route": best_route,
        "all_routes": routes,
        "safety_score": safety_score,
        "avoids": fallback["avoids"],
        "tips": fallback["tips"],
        "ai_status": "pending",
        "hotspots": hotspots,
        "mode": mode,
        "departure_time": dt.isoformat(),
    }


@app.get("/tips")
async def get_tips(
    safety_score: float = Query(..., description="Route safety score 0–10"),
    hotspots: str = Query("", description="Comma-separated hotspot kinds"),
    departure_time: str = Query(None, description="ISO 8601 departure time; defaults to now"),
    mode: str = Query("bicycling"),
):
    """Regenerate safety tips for a route (e.g. after time-of-day change)."""
    if departure_time:
        try:
            dt = datetime.fromisoformat(departure_time)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid departure_time format")
    else:
        dt = datetime.now(timezone.utc)

    hotspot_list = [h.strip() for h in hotspots.split(",") if h.strip()]
    narrative = await generate_route_narrative(
        hotspots_passed=hotspot_list,
        route_score=safety_score,
        departure_time=dt,
        mode=mode,
    )

    return {
        "avoids": narrative["avoids"],
        "tips": narrative["tips"],
        "ai_status": narrative["ai_status"],
    }