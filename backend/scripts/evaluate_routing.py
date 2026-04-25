"""
Routing evaluation script — compares Stella's safety-weighted routing
against Google Maps' default (shortest/fastest) recommendation.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/evaluate_routing.py [--time 23:00] [--mode walking]

Output: a table showing for each test trip:
  - Which route Google would recommend vs. which Stella picks
  - Safety scores for all alternatives
  - Distance/time trade-off of choosing the safer route
  - Whether Stella differed from Google at all
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
import argparse

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.route_scorer import select_safest_route

DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"

# Representative Amsterdam trips chosen to exercise the algorithm:
# mix of city-centre, post-going-out routes, isolated stretches, known hotspot areas
TEST_TRIPS = [
    {
        "name": "Leidseplein → Vondelpark (nightlife exit, park edge)",
        "origin": "Leidseplein, Amsterdam",
        "destination": "Vondelpark, Amsterdam",
    },
    {
        "name": "Centraal Station → De Pijp (long cross-city)",
        "origin": "Amsterdam Centraal, Amsterdam",
        "destination": "Albert Cuypmarkt, Amsterdam",
    },
    {
        "name": "Rembrandtplein → Oost (through city centre at night)",
        "origin": "Rembrandtplein, Amsterdam",
        "destination": "Linnaeusstraat, Amsterdam",
    },
    {
        "name": "Noord → Centraal (industrial waterfront area)",
        "origin": "Amsterdam Noord, Amsterdam",
        "destination": "Amsterdam Centraal, Amsterdam",
    },
    {
        "name": "Bijlmer ArenA → Amstelveen (suburban, isolated stretches)",
        "origin": "Amsterdam ArenA, Amsterdam",
        "destination": "Amstelveen, Netherlands",
    },
    {
        "name": "Wallen → Jordaan (red-light district exit)",
        "origin": "Oudezijds Voorburgwal, Amsterdam",
        "destination": "Jordaan, Amsterdam",
    },
    {
        "name": "Sloterdijk → Oud-West (industrial to residential)",
        "origin": "Amsterdam Sloterdijk, Amsterdam",
        "destination": "Kinkerstraat, Amsterdam",
    },
    {
        "name": "Zuidas → Museumplein (business district late)",
        "origin": "Zuidas, Amsterdam",
        "destination": "Museumplein, Amsterdam",
    },
    {
        "name": "NDSM Werf → Centraal (isolated dock area)",
        "origin": "NDSM-werf, Amsterdam",
        "destination": "Amsterdam Centraal, Amsterdam",
    },
    {
        "name": "Bos en Lommer → Dam (through Westerpark area)",
        "origin": "Bos en Lommer, Amsterdam",
        "destination": "Dam, Amsterdam",
    },
]


async def evaluate_trip(client: httpx.AsyncClient, trip: dict, dt: datetime, mode: str) -> dict:
    key = os.environ.get("GOOGLE_DIRECTIONS_API_KEY", "")
    resp = await client.get(
        DIRECTIONS_URL,
        params={
            "origin": trip["origin"],
            "destination": trip["destination"],
            "mode": mode,
            "alternatives": "true",
            "key": key,
        },
        timeout=15,
    )
    data = resp.json()
    if data.get("status") != "OK":
        return {"name": trip["name"], "error": data.get("status", "unknown")}

    routes = [
        {
            "summary": r.get("summary", f"Route {i+1}"),
            "distance_m": r["legs"][0]["distance"]["value"],
            "duration_s": r["legs"][0]["duration"]["value"],
            "distance_text": r["legs"][0]["distance"]["text"],
            "duration_text": r["legs"][0]["duration"]["text"],
            "polyline": r["overview_polyline"]["points"],
            "start_location": r["legs"][0]["start_location"],
            "end_location": r["legs"][0]["end_location"],
        }
        for i, r in enumerate(data["routes"])
    ]

    best_route, best_score, hotspots, scored = await select_safest_route(routes, dt)
    google_default = routes[0]
    chose_different = best_route["polyline"] != google_default["polyline"]

    google_score = next(
        (r["safety_score"] for r in scored if r["polyline"] == google_default["polyline"]), 0.0
    )

    extra_distance_m = best_route["distance_m"] - google_default["distance_m"]
    extra_time_s = best_route["duration_s"] - google_default["duration_s"]

    return {
        "name": trip["name"],
        "alternatives": len(routes),
        "chose_different": chose_different,
        "stella_score": best_score,
        "google_score": google_score,
        "score_gain": round(best_score - google_score, 3),
        "stella_summary": best_route.get("summary", "—"),
        "google_summary": google_default.get("summary", "—"),
        "extra_distance_m": extra_distance_m,
        "extra_time_s": extra_time_s,
        "stella_duration": best_route["duration_text"],
        "google_duration": google_default["duration_text"],
        "all_scores": [(r.get("summary", "?"), round(r["safety_score"], 3)) for r in scored],
        "hotspots": hotspots,
    }


def fmt_score(score: float) -> str:
    bar = "█" * int(score * 10) + "░" * (10 - int(score * 10))
    return f"{score:.3f} [{bar}]"


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--time", default="22:00", help="Departure time HH:MM (default 22:00)")
    parser.add_argument("--mode", default="bicycling", choices=["bicycling", "walking"])
    parser.add_argument("--trip", type=int, default=None, help="Run only trip N (0-indexed)")
    args = parser.parse_args()

    h, m = map(int, args.time.split(":"))
    now = datetime.now(timezone.utc)
    dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if dt < now:
        dt += timedelta(days=1)

    trips = [TEST_TRIPS[args.trip]] if args.trip is not None else TEST_TRIPS

    print(f"\n{'='*70}")
    print(f"  Stella routing evaluation — {args.mode.upper()} @ {args.time}")
    print(f"{'='*70}\n")

    chose_different_count = 0
    total_score_gain = 0.0

    async with httpx.AsyncClient() as client:
        results = []
        for trip in trips:
            print(f"  Evaluating: {trip['name']} ...", end=" ", flush=True)
            result = await evaluate_trip(client, trip, dt, args.mode)
            results.append(result)
            status = "✓" if "error" not in result else "✗"
            print(status)

    print()
    for r in results:
        if "error" in r:
            print(f"  ✗ {r['name']}: {r['error']}\n")
            continue

        diff_marker = "🔀 DIFFERENT" if r["chose_different"] else "   same"
        print(f"  ┌─ {r['name']}")
        print(f"  │  Alternatives offered by Google: {r['alternatives']}")
        print(f"  │  Decision: {diff_marker}")
        print(f"  │  Stella picks:  {r['stella_summary']:<30} score={fmt_score(r['stella_score'])}  {r['stella_duration']}")
        print(f"  │  Google picks:  {r['google_summary']:<30} score={fmt_score(r['google_score'])}  {r['google_duration']}")
        print(f"  │  Score gain: {r['score_gain']:+.3f}")

        if r["all_scores"]:
            print(f"  │  All scored alternatives:")
            for name, score in r["all_scores"]:
                marker = "← Stella" if abs(score - r["stella_score"]) < 0.001 else ""
                print(f"  │    {name:<35} {score:.3f}  {marker}")

        if r["extra_distance_m"] != 0:
            direction = "longer" if r["extra_distance_m"] > 0 else "shorter"
            print(f"  │  Trade-off: {abs(r['extra_distance_m'])}m {direction}, {abs(r['extra_time_s'])}s {'more' if r['extra_time_s'] > 0 else 'less'}")
        if r["hotspots"]:
            print(f"  │  Hotspots avoided: {', '.join(r['hotspots'])}")
        print(f"  └{'─'*60}")
        print()

        if r["chose_different"]:
            chose_different_count += 1
        total_score_gain += r["score_gain"]

    valid = [r for r in results if "error" not in r]
    if valid:
        print(f"  {'─'*60}")
        print(f"  Summary over {len(valid)} trips:")
        print(f"    Chose a different route than Google: {chose_different_count}/{len(valid)} ({chose_different_count/len(valid)*100:.0f}%)")
        print(f"    Average safety score gain:           {total_score_gain/len(valid):+.3f}")
        print(f"  {'─'*60}\n")
        print("  Interpretation guide:")
        print("    score gain ≈ 0      → Stella agrees with Google (route is already safe)")
        print("    score gain > 0.05   → Stella found a meaningfully safer alternative")
        print("    score gain > 0.15   → Strong safety improvement, expect longer route")
        print("    chose_different 0%  → Algorithm never deviates — check grid data coverage")
        print("    chose_different >50% → Algorithm is active and finding alternatives\n")


if __name__ == "__main__":
    asyncio.run(main())
