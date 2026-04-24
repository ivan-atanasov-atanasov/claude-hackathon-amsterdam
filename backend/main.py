import os
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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
):
    if not DIRECTIONS_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_DIRECTIONS_API_KEY not configured")

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

    return {"routes": routes, "mode": mode}