# PRD — NachtRoute

## Overview

NachtRoute is a cycling and walking route planner for women in Amsterdam that prioritizes safety over speed. Enter a start, destination, departure time, and travel mode — get the safest route with estimated travel time, scored on real Amsterdam open data: street lighting, reported incidents, and foot traffic. One tap to open in Google Maps.

Built for the **Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26, 2026), in support of NGO **Wij eisen de nacht op**.

---

## Problem Statement

> *Women in Amsterdam avoid cycling or walking at night because they don't know which route is safe. Google Maps optimizes for speed — not safety. No tool exists that routes women through well-lit, busy streets with low incident history, whether they're on a bike or on foot.*

---

## Target Users

**Primary — women cycling in Amsterdam:**
- Any age, any neighborhood
- Planning a route before leaving home, or right before departure
- Wants to feel confident about her route without doing manual research
- Already uses Google Maps — NachtRoute feeds into it, not replacing it

**Secondary — NGO Wij eisen de nacht op:**
- Can share the tool via their channels as a concrete, practical resource
- Aggregate anonymized usage data could inform advocacy and policy

---

## MVP Features (prioritized)

1. **Route input** — enter start address, destination, and departure time (defaults to right now)
2. **Mode selection** — choose between cycling or walking
3. **Safest route** — single route optimized for safety, showing estimated travel time for the selected mode
4. **Safety score** — route scored on lighting coverage, incident history, and foot traffic for the selected time
5. **"Open in Google Maps"** — one tap to launch the route in Google Maps
6. **Time-aware scoring** — safety score adjusts based on departure time (darker = less safe at night, busier = safer during rush hour)

---

## User Stories

- As a woman about to cycle home, I open NachtRoute, enter my start and destination, and instantly see the safest route with an estimated travel time so I can leave feeling confident.
- As a woman planning ahead, I set a future departure time and see how the safety score changes compared to cycling right now.
- As a user, I tap "Open in Google Maps" and my safest route launches immediately so I don't have to retype anything.

---

## Technical Requirements

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 (Vercel) |
| Backend | FastAPI + Python (Railway) |
| Database | Supabase (PostgreSQL) — stores processed safety data |
| Routing | Google Maps Directions API (cycling mode) |
| Map display | Google Maps JavaScript API |
| Street lighting data | maps.amsterdam.nl/lichtpunten/ (open dataset) |
| Incident data | onderzoek.amsterdam.nl — Openbare Orde en Veiligheid dataset |
| Foot traffic | Approximated from time of day + area density (simulated for demo) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/routes?from={address}&to={address}&time={datetime}&mode={cycling\|walking}` | Returns safest route with safety score and travel time |
| GET | `/safety?lat={lat}&lng={lng}&radius={m}&time={datetime}` | Returns safety score for a location at a given time |

---

## Database Schema

### `lighting_points`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| lat | float | Latitude |
| lng | float | Longitude |
| type | text | Street light type from Amsterdam dataset |
| imported_at | timestamp | |

### `incidents`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| lat | float | Latitude |
| lng | float | Longitude |
| category | text | Type of incident (from Amsterdam dataset) |
| occurred_at | timestamp | Date/time of incident |
| imported_at | timestamp | |

### `safety_grid`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| grid_x | int | Grid cell X (Amsterdam divided into ~100m cells) |
| grid_y | int | Grid cell Y |
| lat | float | Cell center latitude |
| lng | float | Cell center longitude |
| lighting_score | float | 0.0 – 1.0 based on nearby light points |
| incident_score | float | 0.0 – 1.0 based on incident density (inverted) |
| traffic_score | float | 0.0 – 1.0 based on time-of-day foot/cycle traffic model |
| updated_at | timestamp | |

---

## Safety Scoring Model

```
safety_score = (
  0.40 * lighting_score +
  0.40 * incident_score +
  0.20 * traffic_score
)
```

Route safety score = average safety score across all grid cells the route passes through, adjusted for departure time (lighting weight increases after sunset).

---

## Out of Scope

- User accounts or login
- Live incident reporting by users
- Real-time foot traffic data (approximated for demo)
- Safe haven / shelter mapping
- Push notifications or alerts mid-journey
- iOS/Android native app
- Languages other than Dutch/English

---

## Success Criteria

At the demo:
1. Enter a start + destination in Amsterdam → see the safest route with travel time in under 5 seconds
2. Safety score is clearly visible and explained
3. Changing departure time from midday to midnight changes the safety score
4. "Open in Google Maps" launches the correct cycling route instantly
5. A non-technical person understands the product in under 30 seconds

---

*Version: 1.0 — 2026-04-20*
*NGO partner: Wij eisen de nacht op (wijeisendenachtop.nl)*
