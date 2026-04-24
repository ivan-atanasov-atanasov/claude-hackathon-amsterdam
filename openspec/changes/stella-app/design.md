# Design — Stella.app

## Architecture

```
User (browser)
    │
    ▼
Frontend (Next.js)
  /app/page.tsx          ← Route input form (start, destination, time, mode)
  /app/results/page.tsx  ← Safest route + score + AI explanation + tips + "Open in Google Maps"
  /lib/api.ts            ← API calls to backend
    │
    ▼
Backend (FastAPI)
  GET /routes            ← Safest route, score, AI explanation, tips
  GET /safety            ← Safety score for a coordinate + time
  GET /tips              ← Regenerate tips without re-routing
    │
    ├──▶ Google Maps Directions API  (cycling or walking alternatives)
    ├──▶ Anthropic API (Claude claude-sonnet-4-6)  ← narration + tips only
    └──▶ Supabase (PostgreSQL)
           lighting_points    ← from maps.amsterdam.nl/lichtpunten/
           incidents          ← from onderzoek.amsterdam.nl
           hotspots           ← curated: parks, entertainment squares, stations
           safety_grid        ← pre-computed lighting + incident + hotspot_penalty
```

## Key Design Decisions

### Single safest route (not fastest vs. safest)
We show one route — the safest — with its travel time. No fastest alternative. Keeps the UI focused and reinforces Stella.app as a safety tool, not a navigation app.

### AI boundary (deterministic routing, AI narration)
This boundary is deliberate and load-bearing.

- **Deterministic:** route candidate fetching, safety grid computation, scoring, route selection. No LLM on this path.
- **AI-assisted (Claude):** the "why this route" explanation and contextual safety tips.
- **Inputs to Claude:** route polyline summary, grid cells crossed, safety subscores, departure time, mode, hotspot types intersected. No PII; addresses are resolved to coordinates server-side first.
- **Budget:** one Claude call per `/routes` request, 2s hard timeout, prompt caching on the system prompt.
- **Fallback:** on error or timeout, response includes `ai_status: "fallback"` and the UI renders deterministic score + a static fallback tip list. Product works end-to-end without AI.

### Safety scoring model

```
cell_score(t) = w_light(t) * lighting_score
              + w_incident(t) * incident_score
              + w_traffic(t) * traffic_score(t)
              − hotspot_penalty_at_time(t)

route_score = mean(cell_score across traversed cells), scaled to 0–10
```

Time-of-day weights:

| Window | lighting | incident | traffic |
|--------|---------:|---------:|--------:|
| 06:00–20:00 | 0.30 | 0.40 | 0.30 |
| 20:00–23:00 | 0.45 | 0.40 | 0.15 |
| 23:00–06:00 | 0.55 | 0.40 | 0.05 |

Hotspot penalty (cell sits inside a curated park/square/station polygon):
- Daytime: −0.05
- Evening: −0.10
- Late night: −0.15

Weights are hackathon-tuned and flagged for NGO validation post-hackathon.

### Route selection
1. Request up to 3 alternatives from Google Directions for the chosen mode.
2. Score each route using the grid + time-of-day weights + hotspot penalty.
3. Return the highest-scoring route with its subscores and hotspot types intersected.

### AI narration pipeline
1. `/routes` assembles a compact summary: subscores, hotspots passed, time window, mode, and one-sentence route shape.
2. Single Claude call generates `explanation` (2–3 sentences) and `tips` (3–5 items) in one JSON response.
3. On timeout/error, return `ai_status: "fallback"` with static tips. Never block the route response on AI.

### Google Maps handoff
"Open in Google Maps" constructs a `maps.google.com` deep link with start + end coordinates and travel mode. No Google Maps SDK required for handoff.

## Data Sources

| Dataset | Source | Format | Real for demo? |
|---------|--------|--------|---------------:|
| Street lighting | maps.amsterdam.nl/lichtpunten/ | GeoJSON | Yes, one-time import |
| Incidents (openbare orde) | onderzoek.amsterdam.nl | CSV/JSON | Yes, last 24 months |
| Hotspot polygons | Amsterdam open geodata, curated | GeoJSON | Yes, manually curated |
| Foot traffic | Time-of-day × street-type model | Computed | Simulated, flagged in UI |
| Framing stats | onderzoek.amsterdam.nl/publicatie/sociale-veiligheid-op-de-fiets-2025 | Cited | Real |

## Frontend Pages

### `/` — Route input
- Start address input (Google Places autocomplete)
- Destination address input
- Departure time picker (defaults to now)
- Mode toggle: Cycling / Walking
- A grounding stat above the form ("78% of young women have been afraid on the bike — *Gemeente Amsterdam, 2025*")
- "Find safest route" CTA

### `/results` — Route result
- Safety score badge ("Safety: 8.2/10") with subscore breakdown
- Estimated travel time and distance
- Google Maps embed with the route polyline
- **"Why this route"** — 2–3 sentence AI explanation (or empty in fallback)
- **Safety tips** — 3–5 contextual tips (or static fallback list)
- "Open in Google Maps" button
- "Search again" link back to home
- Small `ai_status` indicator when `"fallback"`

## API Contract

### `GET /routes`
Query: `from`, `to`, `time` (ISO8601), `mode` (`cycling` | `walking`).

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
    },
    "hotspots_passed": ["park", "station"]
  },
  "explanation": "This route avoids Leidseplein after 23:00 and uses Haarlemmerdijk, which has dense lighting and steady foot traffic.",
  "tips": [
    "You pass Vondelpark at 23:10 — stay on the north edge path, it's better lit.",
    "Share your live location with a friend before leaving.",
    "If you feel unsafe, the 24h Albert Heijn on Overtoom is on your route."
  ],
  "ai_status": "ok"
}
```

### `GET /safety`
Query: `lat`, `lng`, `radius` (m), `time` (ISO8601).

```json
{
  "safety_score": 7.4,
  "lighting_score": 0.80,
  "incident_score": 0.72,
  "traffic_score": 0.65,
  "hotspot_penalty": 0.10
}
```

### `GET /tips`
Query: `time`, `mode`, `hotspots` (comma-separated kinds).

```json
{
  "tips": ["…", "…", "…"],
  "ai_status": "ok"
}
```

## Schema Additions vs. v1
- New `hotspots` table (`id`, `kind`, `name`, `geometry`)
- `safety_grid` gains `hotspot_penalty` column
- `safety_grid.traffic_score` removed from table — computed per request
