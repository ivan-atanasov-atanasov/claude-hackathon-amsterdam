# PRD — NachtRoute

## Overview

NachtRoute is a cycling and walking route planner for women in Amsterdam that prioritizes **safety over speed**. Enter a start, destination, departure time, and travel mode — get the single safest route with estimated travel time, scored on real Amsterdam open data (street lighting, reported incidents, foot traffic) and with a plain-language explanation of *why* this route was chosen. Contextual safety tips appear alongside the route, tailored to time of day, mode, and hotspots along the path. One tap opens the route in Google Maps.

Route selection is **fully deterministic**. Claude is used only to narrate the chosen route and generate personalized tips — never to pick the route.

Built for the **Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26, 2026), in support of NGO **Wij eisen de nacht op**.

---

## Problem Statement

Women in Amsterdam avoid cycling and walking at night because they don't know which route is safe. Google Maps optimizes for speed, not safety. The municipality already publishes the data needed to do better — lighting, incidents, hotspot geometry — but no tool brings it together for the rider.

Grounding from Gemeente Amsterdam's *Sociale veiligheid op de fiets 2025* survey:

| Stat | Value |
|------|------:|
| Adult cyclists who fear harassment while cycling | **47%** |
| Young women who have been afraid on the bike | **78%** |
| Older men who have been afraid on the bike (contrast) | 15% |
| Cyclists who can name a specific location where they were harassed | **22%** |
| Cyclists who already avoid certain routes | **~50%** |

Hotspot types named in the report: **parks, entertainment squares, train stations** — distributed across the whole city, not one district. Women's top-requested fixes are **better lighting, safer cycling routes, and awareness**. Women more often than men mitigate by sharing live location or switching transport mode. NachtRoute directly addresses the top two asks.

---

## Target Users

### Primary — women moving through Amsterdam at night
- Any neighborhood, any age; emphasis on young women (16–30) given the 78% fear rate
- Cycling or walking
- Planning ahead from home, or deciding in the moment before leaving
- Wants to feel confident without doing manual research
- Already uses Google Maps — NachtRoute hands off into it, not competing

**Jobs to be done:** *pick a route I trust → share it if I want → leave on time.*

### Secondary — NGO *Wij eisen de nacht op*
- A concrete, shareable resource for their community and campaigns
- Potential future input: aggregated anonymous usage data to inform advocacy

---

## MVP Features (prioritized)

### P0 — must have for demo

1. **Route input** — start address, destination, departure time (defaults to now), mode (cycling / walking)
2. **Single safest route** — one route, chosen deterministically from Google Directions alternatives by safety score (internal only); shows distance and estimated travel time
3. **AI-generated "Why this route" explanation** — 2–3 sentences in plain language, e.g. *"This route avoids Leidseplein after 23:00 and uses Haarlemmerdijk, which has dense lighting and steady foot traffic."*
5. **Contextual safety tips** — 3–5 tips on the results page, tailored to route segments, time of day, and mode. Triggers include: passing a known hotspot type (park / square / station), post-sunset departure, walking vs. cycling
6. **Open in Google Maps** — one tap launches the route in Google Maps with the correct mode
7. **Time-aware scoring** — safety score and tips both shift between day, evening, and late night

### P1 — nice to have

- Share route via URL / WhatsApp
- "Report a spot" — lightweight feedback to NGO for advocacy
- Static tips page linked from footer

### P2 — out of scope

- User accounts, saved routes
- Live user-reported incidents
- Mid-journey push notifications
- Native iOS/Android apps
- Languages beyond Dutch/English
- Real-time foot traffic

---

## User Stories

- As a woman about to cycle home at 23:30, I enter my start and destination and see one clearly safest route with travel time, so I can leave feeling confident.
- As a woman planning a night out, I set a future departure time and see how the safety score and tips change versus leaving now.
- As a user, I read the "why this route" explanation and 3–5 personalized tips, and I understand what the product is doing for me without reading a manual.
- As a user, I tap "Open in Google Maps" and the safest route launches in the mode I selected, with no retyping.

---

## Technical Requirements

### Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 | App Router, deployed to Vercel |
| Backend | FastAPI (Python 3.14) | Deployed to Railway |
| Database | Supabase (PostgreSQL) | Stores processed safety data |
| Routing | Google Maps Directions API | Cycling + walking alternatives |
| Map display | Google Maps JavaScript API | Consistent with handoff deep-link |
| AI narration + tips | Claude `claude-sonnet-4-6` via Anthropic SDK | Prompt caching on system prompt |
| Street lighting | `maps.amsterdam.nl/lichtpunten/` | Open dataset, one-time import |
| Incidents | `onderzoek.amsterdam.nl` (openbare orde & veiligheid) | Open dataset, one-time import |
| Hotspot polygons | Amsterdam open geodata | Manually curated: parks, squares, stations |
| Foot traffic | Simulated (time-of-day × street-type heuristic) | Flagged in UI |

### AI usage boundary

The AI boundary is narrow on purpose — it keeps the product reviewable, fast, and reliable.

- **Deterministic (no LLM):** route candidate fetching, safety grid computation, scoring, route selection.
- **AI-assisted (Claude):** the "why this route" explanation and contextual safety tips.
- **Inputs to Claude:** route polyline summary, grid cells crossed, safety subscores, departure time, mode, and which hotspot types the route intersects. **No PII.** Addresses are resolved to coordinates before leaving the server.
- **Budget:** one Claude call per `/routes` request; hard timeout 2s; prompt caching on the system prompt keeps repeat latency low.
- **Failure mode:** on AI error or timeout, the API returns `ai_status: "fallback"` and the UI renders a static fallback tip list. The product must work end-to-end without the AI.

### `safety_grid` is pre-computed

Grid cells and their base `lighting_score` / `incident_score` are built once at data import time. Only the time-dependent `traffic_score` and final weighting are computed per request.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/routes?from&to&time&mode` | Returns safest route, AI explanation, and tips |
| GET | `/safety?lat&lng&radius&time` | Returns safety score for a location at a given time |
| GET | `/tips?time&mode&hotspots` | Regenerates tips without re-routing (used by client if user tweaks time) |

### `GET /routes` response

```json
{
  "route": {
    "polyline": "encoded_polyline_string",
    "distance_m": 2400,
    "duration_min": 12,
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

`ai_status` is `"ok"` or `"fallback"`. When `"fallback"`, `explanation` may be empty and `tips` comes from the static list.

---

## Database Schema

### `lighting_points`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| lat | float | Latitude |
| lng | float | Longitude |
| type | text | Street light type |
| imported_at | timestamp | |

### `incidents`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| lat | float | Latitude |
| lng | float | Longitude |
| category | text | Incident type |
| occurred_at | timestamp | |
| imported_at | timestamp | |

### `hotspots`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| kind | text | `park` \| `square` \| `station` |
| name | text | Display name |
| geometry | jsonb | GeoJSON polygon |

### `safety_grid`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| grid_x | int | ~100m cell |
| grid_y | int | ~100m cell |
| lat | float | Cell center |
| lng | float | Cell center |
| lighting_score | float | 0.0–1.0 |
| incident_score | float | 0.0–1.0 (inverted) |
| hotspot_penalty | float | 0.0–0.2, from overlapping hotspot polygons |
| updated_at | timestamp | |

`traffic_score` is computed per request from time-of-day × street-type, not stored.

---

## Safety Scoring Model

```
cell_score(t) = w_light(t) * lighting_score
              + w_incident(t) * incident_score
              + w_traffic(t) * traffic_score(t)
              − hotspot_penalty_at_time(t)

route_score = mean(cell_score across cells the route traverses), scaled to 0–10
```

### Time-of-day weights

| Window | lighting | incident | traffic |
|--------|---------:|---------:|--------:|
| 06:00–20:00 | 0.30 | 0.40 | 0.30 |
| 20:00–23:00 | 0.45 | 0.40 | 0.15 |
| 23:00–06:00 | 0.55 | 0.40 | 0.05 |

### Hotspot penalty

A cell receives a fixed penalty if it sits inside a curated park / square / station polygon, scaled by time of day (larger at night). Tuned starting value: −0.05 daytime, −0.10 evening, −0.15 late night.

### Route selection

1. Request up to 3 alternatives from Google Directions for the chosen mode.
2. Compute `route_score` for each using the grid + time-of-day weights.
3. Return the highest-scoring route.

### Calibration note

Weights are hackathon-tuned. Validating them with *Wij eisen de nacht op* and real users is a post-hackathon task.

---

## Data Confidence

| Dataset | Real for demo? | Notes |
|---|---|---|
| Street lighting (lichtpunten) | **Yes** — one-time import | Full Amsterdam coverage |
| Incidents (openbare orde) | **Yes** — one-time import | Filtered to last 24 months |
| Hotspot polygons | **Yes** — curated | Parks, entertainment squares, stations |
| Foot traffic | **Simulated** | Time-of-day × street-type heuristic; flagged in UI |
| 2025 cyclist-safety survey stats | **Real** — cited | Used for framing, not computation |

---

## Out of Scope

- User accounts or login
- Live user-submitted incident reports
- Real-time foot traffic data
- Mid-journey push notifications
- Native mobile apps
- Languages beyond Dutch/English

---

## Success Criteria

Demo checklist:

1. Enter a start + destination in Amsterdam → safest route with travel time in under 5 seconds
2. "Why this route" explanation rendered in plain language
3. Changing departure time midday ↔ midnight visibly changes tips
4. Changing mode cycling ↔ walking visibly changes tips
5. AI explanation renders within 2s p95; on failure, fallback tips render without UI breakage
6. Landing page surfaces a grounding stat ("78% of young women have been afraid cycling…")
7. "Open in Google Maps" launches the correct route and mode
8. A non-technical person understands the product in under 30 seconds

---

## References

- *Sociale veiligheid op de fiets 2025* — Gemeente Amsterdam — `https://onderzoek.amsterdam.nl/publicatie/sociale-veiligheid-op-de-fiets-2025` (primary grounding for problem statement and hotspot taxonomy)
- Street lighting dataset — `https://maps.amsterdam.nl/lichtpunten/`
- Incidents dataset — `https://onderzoek.amsterdam.nl` (Openbare Orde en Veiligheid)
- NGO partner — *Wij eisen de nacht op* — `https://wijeisendenachtop.nl`
- Google Maps Directions API — cycling + walking modes with alternatives

---

*Version: 2.0 — 2026-04-21*
*NGO partner: Wij eisen de nacht op*
