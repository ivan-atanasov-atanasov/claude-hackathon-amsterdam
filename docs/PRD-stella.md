# PRD — Stella.app

## Overview

Stella.app calculates the safest cycling or walking route between two points in Amsterdam — not the fastest, the safest *for women*. Enter a start, destination, departure time, and travel mode; get a single safest route with estimated travel time, a plain-language list of the specific streets, squares, parks, and areas the route is **avoiding**, and contextual safety tips tailored to time of day, mode, and hotspots along the path. One tap opens the route in Google Maps — no new habit required.

The weighted safety score draws on real Amsterdam open data (street lighting, citizen incident reports, nuisance and camera zones, pedestrian counts, building density, neighborhood safety index), the Pointer/KRO-NCRV national unsafe-places map, and the Gemeente Amsterdam O&S survey that mapped this problem in the first place.

Route selection is **fully deterministic**. Claude is used only to name the streets and areas the route avoids and generate personalized tips — never to pick the route.

Built for the **Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26, 2026), in support of NGO **Wij eisen de nacht op**.

---

## The Problem

Amsterdam is one of the world's greatest cycling cities. Two thirds of Amsterdammers cycle regularly. But that freedom isn't equally shared.

According to Gemeente Amsterdam's own research, **78% of young women feel afraid of cycling in Amsterdam**. **22%** have actually been harassed on their bike. The fear peaks at night — exactly when women most need to get home.

**77% of young women cope** by texting when they leave, sharing their live location, or calling someone while cycling in the dark. Sometimes just pretending to. This is the invisible mental load women carry every time they get on a bike after sunset.

Across the Netherlands, nearly **10,000 women** marked specific unsafe spots on a national map. On **more than half**, something had already happened to them or someone they know. **70%** say the built environment makes it worse: broken streetlights, no alternative routes around dark or isolated areas.

**48% of women regularly take detours** to avoid unsafe spots. **39% sometimes don't go out alone at all.** Women are already routing for safety — manually, in their heads, every single time.

### The insight that changes everything

Existing navigation apps optimize for speed. Where safety tools exist, they're built around the wrong definition — designed around what makes *men* feel unsafe.

These are not the same thing.

- **For men**, safety means: fatbikes, unclear intersections, narrow cycling lanes.
- **For women**, safety means: other people around, good lighting, no high bushes, no blind corners.

No navigation tool makes this distinction. Stella.app does.

### Grounding data

From Gemeente Amsterdam's *Sociale veiligheid op de fiets 2025* survey (n=1,478):

| Stat | Value |
|------|------:|
| Young women who have been afraid on the bike | **78%** |
| Older men who have been afraid on the bike (contrast) | 15% |
| Cyclists who can name a specific location where they were harassed | **22%** |
| Young women who cope via texting / live-location / fake calls | **77%** |
| Women who regularly take detours to avoid unsafe spots | **48%** |
| Women who sometimes don't go out alone at all | **39%** |
| Adult cyclists who fear harassment while cycling | **47%** |

From the Pointer/KRO-NCRV national unsafe-places map:

| Stat | Value |
|------|------:|
| Women who marked specific unsafe spots on the national map | **~10,000** |
| Marked spots where something already happened to the woman or someone she knows | **>50%** |
| Women citing the built environment (lighting, lack of alternatives) as making it worse | **70%** |

Hotspot types named in the Amsterdam report: **parks, entertainment squares, train stations** — distributed across the whole city, not one district. Women's top-requested fixes are **better lighting, more supervision / cameras, and safer routes**. Women more often than men mitigate by sharing live location or switching transport mode. Stella.app directly addresses these asks.

The Amsterdam survey also quantifies *why* a place feels unsafe (women respondents, multi-select):

| Factor cited | % women citing |
|---|---:|
| Few people on street | 70% |
| Isolated location | 70% |
| Poor lighting | 57% |
| No overview (bushes, tunnels) | 57% |
| Few homes / residential density | 57% |
| Few businesses / non-residential activity | 55% |
| No escape route | 52% |
| People under influence | 52% |
| Someone else was harassed here | 42% |

These percentages seed the initial layer weights in the scoring model — no longer pure hackathon guesses.

---

## The Solution

Stella.app calculates the safest cycling or walking route from A to B in Amsterdam. Not the fastest — the safest for women. Its weighted safety score draws on:

- **Lighting infrastructure** — where the streetlights are and where they aren't.
- **Incident reports** — where harassment and public-space incidents have actually been reported.
- **Social safety data** — spots perceived as unsafe by women, locations where incidents have occurred, and avoidance of areas that are isolated, dark, or quiet.

The data comes from **Gemeente Amsterdam Onderzoek & Statistiek**, the **Pointer/KRO-NCRV national unsafe-places map**, and the **Amsterdam open data API** — built with direct input from the city researchers who mapped this problem.

Route calculated → opens straight in Google Maps. No friction. No new habit.

---

## The Mission

78% of young Amsterdam women feel afraid on their bike. We're changing that — and giving women back the night.

This is Stella.app. Inspired by **Wij Eisen de Nacht Op**.

---

## Target Users

### Primary — women moving through Amsterdam at night
- Any neighborhood, any age; emphasis on young women (16–30) given the 78% fear rate
- Cycling or walking
- Planning ahead from home, or deciding in the moment before leaving
- Wants to feel confident without doing manual research
- Already uses Google Maps — Stella.app hands off into it, not competing

**Jobs to be done:** *pick a route I trust → share it if I want → leave on time.*

### Secondary — NGO *Wij eisen de nacht op*
- A concrete, shareable resource for their community and campaigns
- Potential future input: aggregated anonymous usage data to inform advocacy

---

## MVP Features (prioritized)

### P0 — must have for demo

1. **Route input** — start address, destination, departure time (defaults to now), mode (cycling / walking)
2. **Single safest route** — one route, chosen deterministically from Google Directions alternatives by safety score (internal only); shows distance and estimated travel time
3. **AI-generated "What this route avoids" summary** — 2–3 sentences in plain language that name the specific streets, squares, parks, or areas the route is routing around, e.g. *"This route avoids Leidseplein, the Vondelpark south edge, and the Overtoom tunnel after dark — all flagged unsafe by women in the 2025 survey."* The summary focuses on **avoided places**, not a general justification of the chosen path.
4. **Contextual safety tips** — 3–5 tips on the results page, tailored to route segments, time of day, and mode. Triggers include: passing a known hotspot type (park / square / station), post-sunset departure, walking vs. cycling
5. **Open in Google Maps** — one tap launches the route in Google Maps with the correct mode
6. **Time-aware scoring** — the internal score and tips both shift between day, evening, and late night

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

---

## User Stories

- As a woman about to cycle home at 23:30, I enter my start and destination and see one clearly safest route with travel time, so I can leave feeling confident.
- As a woman planning a night out, I set a future departure time and see how the tips change versus leaving now.
- As a user, I read the "what this route avoids" summary and 3–5 personalized tips, and I understand which specific streets, squares, and areas the product is routing me around without reading a manual.
- As a user, I tap "Open in Google Maps" and the safest route launches in the mode I selected, with no retyping.

---

## Technical Requirements

### Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 | App Router, deployed to Vercel |
| Backend | FastAPI (Python 3.14) | Deployed to Railway |
| Database | Supabase (PostgreSQL + PostGIS) | Stores pre-computed safety grid and seed data |
| Routing | Google Maps Directions API | Cycling + walking alternatives |
| Map display | Google Maps JavaScript API | Consistent with handoff deep-link |
| AI avoidance summary + tips | Claude `claude-sonnet-4-6` via Anthropic SDK | Prompt caching on system prompt |

### Data sources

All Amsterdam Data API endpoints (`api.data.amsterdam.nl/v1/`) require a free API key from `keys.api.data.amsterdam.nl/clients/v1/`.

| Layer | Source | Role in score |
|-------|--------|---------------|
| Street lighting points | Amsterdam Data API `/v1/leidingeninfrastructuur/amsterdam_ovl_lichtpunten` | Lighting score per grid cell (density of light points) |
| Citizen incident reports | Amsterdam Data API `/v1/meldingen` (SIA) | Geocoded reports from mid-2018 onward; filter to person/group/public-space nuisance categories, last 24 months |
| Nuisance + camera zones | Amsterdam Data API `/v1/overlastgebieden` | 16 zone types with day/time validity. Most are penalties (drug dealing, alcohol ban, nightlife nuisance, knife ban). `cameratoezicht` is a **positive** signal. |
| Building density | Amsterdam Data API `/v1/bag` | Residential + non-residential density per grid cell — proxy for the top-2 survey fear factors ("few people on street" / "isolated") |
| Pedestrian counts | Amsterdam Data API `/v1/crowdmonitor` | Real sensor data where coverage exists; time-of-day × street-type heuristic as fallback outside sensor coverage |
| Neighborhood baseline | *Veiligheidsindex 2025-3* (XLSX, O&S Amsterdam) | One composite score per buurt (crime + victimization + perception); joined via `/v1/gebieden` polygons |
| Unsafe-area seed | *Sociale veiligheid op de fiets 2025* Tables 1 + §1.7 + §1.8 | Initial unsafe polygons/corridors, loaded from the survey into `unsafe_areas` |
| Park / green polygons | Amsterdam Data API `/v1/functionele_gebieden` | Geometry for named parks (Vondelpark, Oosterpark, etc.) without manual curation |
| Neighborhood polygons | Amsterdam Data API `/v1/gebieden` | Buurt / wijk boundaries for joining the Veiligheidsindex baseline |

### AI usage boundary

The AI boundary is narrow on purpose — it keeps the product reviewable, fast, and reliable.

- **Deterministic (no LLM):** route candidate fetching, safety grid computation, scoring, route selection.
- **AI-assisted (Claude):** the "what this route avoids" summary (names the specific streets, parks, squares, and areas the route is routing around) and contextual safety tips.
- **Inputs to Claude:** route polyline summary, grid cells crossed, per-layer subscores, departure time, mode, and which unsafe-area polygons the route intersects. **No PII.** Addresses are resolved to coordinates before leaving the server.
- **Budget:** one Claude call per `/routes` request; hard timeout 2s; prompt caching on the system prompt keeps repeat latency low.
- **Failure mode:** on AI error or timeout, the API returns `ai_status: "fallback"` and the UI renders a static fallback tip list. The product must work end-to-end without the AI.

### `safety_grid` is pre-computed

Static layers (lighting, building density, overlast zones, camera zones, incidents, unsafe-area penalties, veiligheidsindex baseline) are computed once per grid cell at data-import time. Only the time-dependent people-density score (crowdmonitor + heuristic) and final time-of-day weighting are computed per request.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/routes?from&to&time&mode` | Returns safest route, AI avoidance summary, and tips |
| GET | `/safety?lat&lng&radius&time` | Returns internal safety score for a location at a given time (debug / future use) |
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
  "avoids": {
    "areas": ["Leidseplein", "Vondelpark south edge", "Overtoom tunnel"],
    "summary": "This route avoids Leidseplein, the Vondelpark south edge, and the Overtoom tunnel after dark — all flagged unsafe by women in the 2025 survey."
  },
  "tips": [
    "You pass Vondelpark at 23:10 — stay on the north edge path, it's better lit.",
    "Share your live location with a friend before leaving.",
    "If you feel unsafe, the 24h Albert Heijn on Overtoom is on your route."
  ],
  "ai_status": "ok"
}
```

`avoids.areas` is the machine-readable list of avoided place names (rendered in the UI as chips/pills). `avoids.summary` is the AI-generated plain-language sentence built from that list. `ai_status` is `"ok"` or `"fallback"`. When `"fallback"`, `avoids.summary` may be empty (the `areas` list is still populated deterministically from the scorer) and `tips` comes from the static list.

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
| category | text | SIA category (e.g. `overlast-personen-groepen`) |
| occurred_at | timestamp | |
| imported_at | timestamp | |

### `overlast_zones`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| kind | text | `dealeroverlast` \| `alcoholverbod` \| `uitgaansoverlast` \| `cameratoezicht` \| ... (16 types) |
| geometry | jsonb | GeoJSON MultiPolygon |
| validity_days | text[] | e.g. `['thu','fri','sat']` |
| validity_hours | text | e.g. `'16:00–04:00'` |
| polarity | text | `penalty` \| `bonus` (`cameratoezicht` is bonus) |

### `unsafe_areas`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Display name (e.g. `Leidseplein`, `Gooiseweg-corridor`) |
| kind | text | `park` \| `square` \| `station` \| `corridor` \| `cluster` |
| source | text | `survey_cluster` (Table 1) \| `survey_corridor` (§1.7) \| `survey_hotspot_type` (§1.8) \| `curated` |
| geometry | jsonb | GeoJSON polygon or linestring |

### `buurt_baseline`
| Column | Type | Notes |
|--------|------|-------|
| buurt_code | text | Primary key, joins to `/v1/gebieden` |
| veiligheidsindex | float | 2025-3 composite score, normalized 0.0–1.0 |
| updated_at | timestamp | |

### `safety_grid`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| grid_x | int | ~100m cell |
| grid_y | int | ~100m cell |
| lat | float | Cell center |
| lng | float | Cell center |
| buurt_code | text | For baseline join |
| lighting_score | float | 0.0–1.0 (light-point density) |
| incident_score | float | 0.0–1.0 (inverted meldingen density, last 24m) |
| building_density_score | float | 0.0–1.0 (BAG residential + non-residential) |
| overview_score | float | 0.0–1.0 (inverse of dense-green / tunnel coverage) |
| camera_bonus | float | 0.0–0.2 (cameratoezicht overlap) |
| overlast_penalty | float | 0.0–0.3 (time-valid overlastgebieden overlap) |
| hotspot_penalty | float | 0.0–0.2 (unsafe_areas overlap) |
| updated_at | timestamp | |

`people_density_score` (crowdmonitor + heuristic fallback) is computed per request from time-of-day, not stored.

---

## Safety Scoring Model

```
cell_score(t) = veiligheidsindex_buurt
  * (  w_people(t)    * people_density(t)         // crowdmonitor + heuristic fallback
     + w_overview(t)  * overview_score            // inverse of dense-green / tunnels
     + w_light(t)     * lighting_score            // lichtpunten density
     + w_buildings(t) * building_density_score    // BAG (homes + businesses)
     + w_camera(t)    * camera_bonus              // cameratoezicht zones (positive)
     − w_overlast(t)  * overlast_penalty(t)       // overlastgebieden, time-valid
     − w_incident(t)  * incident_score            // meldingen, last 24m
     − w_hotspot(t)   * hotspot_penalty           // unsafe_areas (survey seed)
    )

route_score = mean(cell_score across cells the route traverses), scaled 0–10 (internal).
```

### Initial layer weights — seeded from survey Table 2

Weights sum to ≈1.0 on the positive side; penalties subtract. Night windows shift emphasis toward lighting, overview, and overlast/incident layers.

| Layer | Survey signal | Day (06–20) | Evening (20–23) | Night (23–06) |
|---|---|--:|--:|--:|
| People density | 70% ("few people" / "isolated") | 0.22 | 0.20 | 0.18 |
| Overview | 57% ("no overview") | 0.16 | 0.18 | 0.20 |
| Lighting | 57% ("poor lighting") | 0.14 | 0.20 | 0.26 |
| Building density | 57% ("few homes") + 55% ("few businesses") | 0.18 | 0.14 | 0.10 |
| Camera bonus | 11% ("more cameras" as requested fix) | 0.04 | 0.06 | 0.08 |
| Overlast penalty | 52% ("people under influence") | 0.08 | 0.14 | 0.18 |
| Incidents (meldingen) | 42% ("someone was harassed here") | 0.10 | 0.10 | 0.10 |
| Hotspot penalty (survey seed) | — | 0.08 | 0.12 | 0.16 |

### Unsafe areas (single tier)

The `unsafe_areas` table is loaded from three parts of the 2025 survey and treated uniformly — no "hard-to-avoid" discount. If the only viable route still crosses one, we return it and the avoidance summary acknowledges the trade-off honestly (naming the area that couldn't be routed around).

- **Survey Table 1 clusters** (22 named unsafe clusters + 8 park clusters + 8 route corridors, organized by stadsdeel).
- **§1.7 hard-to-avoid corridors** (e.g. Gooiseweg/Weesperzijde, Diemerpark, Buiksloterweg, Krugerplein, Transformatorweg, Delflandplein, Rembrandtpark, Sloterplas roundabout).
- **§1.8 specific parks / nightlife / stations / squares** (Vondelpark, Oosterpark, Rembrandtpark, Noorderpark, Sloterplas, Mandelapark, Westerpark, Wallengebied, Leidseplein, Beukenplein, de Hallen, Centraal, Muiderpoort, Lelylaan, Osdorpplein, Plein 40-45, Bos en Lommerplein, Gulden Winckelplein, Buikslotermeerplein, Delflandplein).

### Route selection

1. Request up to 3 alternatives from Google Directions for the chosen mode.
2. Compute `route_score` for each using the grid + time-of-day weights.
3. Return the highest-scoring route.

### Calibration note

Initial weights come from the 2025 survey's stated fear factors (Table 2) — an evidence-based starting point, not pure hackathon guesses. Validating them with *Wij eisen de nacht op* and real users is a post-hackathon task.

---

## Data Confidence

| Dataset | Real for demo? | Notes |
|---|---|---|
| Street lighting (lichtpunten) | **Yes** | Amsterdam Data API, one-time import, citywide |
| Citizen incidents (meldingen / SIA) | **Yes** | Amsterdam Data API, filtered to last 24 months and relevant categories |
| Nuisance + camera zones (overlastgebieden) | **Yes** | Amsterdam Data API, 16 zone types with time validity |
| Building density (BAG) | **Yes** | Amsterdam Data API, aggregated per grid cell |
| Neighborhood baseline (Veiligheidsindex 2025-3) | **Yes** | O&S XLSX, joined via `/v1/gebieden` |
| Unsafe-area seed (survey 2025) | **Yes** | Geocoded from Tables 1 + §1.7 + §1.8 of the survey |
| Park polygons | **Yes** | Amsterdam Data API `/v1/functionele_gebieden` |
| Pedestrian counts (crowdmonitor) | **Partial** | Real sensor data where coverage exists; time-of-day × street-type heuristic fallback elsewhere, flagged in UI |
| 2025 cyclist-safety survey stats | **Real** | Framing + empirical layer weights from Table 2 |

---

## Out of Scope

- User accounts or login
- Live user-submitted incident reports
- Real-time foot traffic data (beyond the available `crowdmonitor` sensors)
- Mid-journey push notifications
- Native mobile apps
- Languages beyond Dutch/English

---

## Success Criteria

Demo checklist:

1. Enter a start + destination in Amsterdam → safest route with travel time in under 5 seconds
2. "What this route avoids" summary rendered in plain language, naming specific streets / squares / parks / areas being routed around
3. Changing departure time midday ↔ midnight visibly changes the selected route and tips
4. Changing mode cycling ↔ walking visibly changes tips
5. AI avoidance summary renders within 2s p95; on failure, the deterministic `avoids.areas` chips and fallback tips still render without UI breakage
6. Landing page surfaces a grounding stat ("78% of young women have been afraid cycling…")
7. "Open in Google Maps" launches the correct route and mode
8. A non-technical person understands the product in under 30 seconds

---

## References

- *Sociale veiligheid op de fiets 2025* — Gemeente Amsterdam, Onderzoek & Statistiek (December 2025). Authors: Lieselotte Bicknese, Merel Kieft. https://onderzoek.amsterdam.nl/publicatie/sociale-veiligheid-op-de-fiets-2025
- *Veiligheidsindex 2025-3* (XLSX) — Onderzoek & Statistiek Amsterdam. https://onderzoek.amsterdam.nl/dataset/openbare-orde-en-veiligheid
- Amsterdam Data API v1 — https://api.data.amsterdam.nl/v1/docs/index.html
  - Key endpoints used: `/v1/leidingeninfrastructuur`, `/v1/meldingen`, `/v1/overlastgebieden`, `/v1/crowdmonitor`, `/v1/bag`, `/v1/gebieden`, `/v1/functionele_gebieden`, `/v1/loopfietsnetwerk`
- Amsterdam Data API keys (free) — https://keys.api.data.amsterdam.nl/clients/v1/
- NGO partner — *Wij eisen de nacht op* — https://wijeisendenachtop.nl
- Google Maps Directions API — cycling + walking modes with alternatives

---

*Version: 4.1 — 2026-04-24 — reframed AI output from "why this route was chosen" to "what this route avoids" (naming specific streets, squares, parks, and areas being routed around); API now returns `avoids: { areas, summary }` instead of `explanation`.*
*Version: 4.0 — 2026-04-24 — renamed Starlight → Stella.app; added Pointer data source, new framing ("invisible mental load", men-vs-women safety definitions), and mission statement.*
*NGO partner: Wij eisen de nacht op*
