# Design — NachtRoute

## Architecture

```
User (browser)
    │
    ▼
Frontend (Next.js)
  /app/page.tsx          ← Route input form (start, destination, time, mode)
  /app/results/page.tsx  ← Safest route + safety score + map + "Open in Google Maps"
  /lib/api.ts            ← API calls to backend
    │
    ▼
Backend (FastAPI)
  GET /routes            ← Returns safest route with safety score + travel time
  GET /safety            ← Returns safety score for a coordinate + time
    │
    ├──▶ Google Maps Directions API  (cycling or walking route options)
    │
    └──▶ Supabase (PostgreSQL)
           lighting_points    ← Imported from maps.amsterdam.nl/lichtpunten/
           incidents          ← Imported from onderzoek.amsterdam.nl
           safety_grid        ← Pre-computed safety scores per 100m grid cell
```

## Key Design Decisions

### Single safest route (not fastest vs. safest)
We show one route — the safest — with its travel time. We do not show a fastest alternative. This keeps the UI focused and reinforces that NachtRoute is a safety tool, not a navigation app.

### Safety scoring model
Each 100m grid cell in Amsterdam gets a composite safety score:

```
safety_score = (
  0.40 * lighting_score   ← density of street lights nearby
  0.40 * incident_score   ← inverse of incident density (lower incidents = higher score)
  0.20 * traffic_score    ← approximated foot/cycle traffic by time of day
)
```

At night (after sunset), lighting weight increases to 0.55, traffic drops to 0.10.

Route safety score = average cell score across all cells the route passes through.

### Route selection
1. Request 3 alternative cycling/walking routes from Google Maps Directions API
2. Score each route using the safety grid
3. Return the highest-scoring route

### Time-aware scoring
Departure time is passed to the API. Scoring weights shift:
- Daytime (6:00–20:00): balanced weights
- Night (20:00–6:00): lighting weighted higher, traffic lower

### Google Maps handoff
"Open in Google Maps" button constructs a `maps.google.com` deep link with start + end coordinates and travel mode. No Google Maps SDK required on frontend for this step.

## Data Sources

| Dataset | Source | Format | Update frequency |
|---------|--------|--------|-----------------|
| Street lighting | maps.amsterdam.nl/lichtpunten/ | GeoJSON | One-time import for demo |
| Incidents (public order & safety) | onderzoek.amsterdam.nl | CSV/JSON | One-time import for demo |
| Foot traffic | Simulated by time-of-day model | Computed | N/A |

## Frontend Pages

### `/` — Route input
- Start address input (autocomplete via Google Places API)
- Destination address input
- Departure time picker (defaults to now)
- Mode toggle: Cycling / Walking
- "Find safest route" CTA button

### `/results` — Route result
- Safety score badge (e.g. "Safety: 8.2/10")
- Estimated travel time
- Google Maps embed showing the route
- "Open in Google Maps" button
- "Search again" link back to home

## API Contract

### `GET /routes`
**Query params:** `from`, `to`, `time` (ISO8601), `mode` (cycling|walking)

**Response:**
```json
{
  "route": {
    "polyline": "encoded_polyline_string",
    "distance_m": 2400,
    "duration_min": 12,
    "safety_score": 8.2,
    "safety_breakdown": {
      "lighting": 0.85,
      "incidents": 0.79,
      "traffic": 0.71
    }
  }
}
```

### `GET /safety`
**Query params:** `lat`, `lng`, `radius` (metres), `time` (ISO8601)

**Response:**
```json
{
  "safety_score": 7.4,
  "lighting_score": 0.80,
  "incident_score": 0.72,
  "traffic_score": 0.65
}
```
