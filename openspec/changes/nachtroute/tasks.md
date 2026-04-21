# Tasks — NachtRoute

## Implementation Order

---

### T1 — Database schema + seed data
**Complexity:** Low | **Est:** 1.5h

- Create Supabase migration for `lighting_points`, `incidents`, `hotspots`, `safety_grid`
- Seed script: import Amsterdam street lighting GeoJSON (`maps.amsterdam.nl/lichtpunten/`)
- Seed script: import incident CSV from `onderzoek.amsterdam.nl`
- Seed script: curated hotspot polygons (parks, entertainment squares, stations) from Amsterdam open geodata
- Pre-compute `safety_grid` (100m cells): `lighting_score`, `incident_score`, `hotspot_penalty`
- Note: `traffic_score` is computed per request, not stored

**Files:**
- `backend/migrations/001_nachtroute_schema.sql`
- `backend/scripts/seed_lighting.py`
- `backend/scripts/seed_incidents.py`
- `backend/scripts/seed_hotspots.py`
- `backend/scripts/compute_safety_grid.py`

---

### T2 — Safety scoring engine (backend)
**Complexity:** Medium | **Est:** 2h

- `safety_grid` lookup by coordinate
- Time-of-day weights: day / evening / late-night buckets
- Hotspot penalty applied per cell, scaled by time bucket
- Route scorer: samples grid cells along polyline, returns mean score + subscores + hotspots intersected
- Unit tests

**Files:**
- `backend/services/safety.py`
- `backend/tests/test_safety.py`

---

### T3 — Routing API endpoint (backend)
**Complexity:** Medium | **Est:** 2h

- Integrate Google Maps Directions API (cycling + walking alternatives)
- Request up to 3 alternatives, score each, return highest-scoring with subscores and hotspots passed
- Implement `GET /routes`, `GET /safety`
- Add `GOOGLE_MAPS_API_KEY` to backend env

**Files:**
- `backend/services/routing.py`
- `backend/routers/routes.py`
- `backend/main.py` (register router)
- `backend/.env.example`

---

### T4 — AI narration + tips service (backend)
**Complexity:** Medium | **Est:** 2h

- Anthropic SDK integration using `claude-sonnet-4-6` with prompt caching on the system prompt
- Build compact summary (subscores, hotspots passed, time window, mode, route shape) as Claude input — no PII
- Single JSON response with `explanation` (2–3 sentences) + `tips` (3–5 items)
- Hard 2s timeout; on error return `ai_status: "fallback"` and static fallback tips
- Expose `GET /tips` for client-side regeneration when user tweaks time/mode
- Unit tests covering success, timeout, and fallback paths

**Files:**
- `backend/services/narration.py`
- `backend/services/fallback_tips.py`
- `backend/routers/tips.py`
- `backend/tests/test_narration.py`
- `backend/.env.example` (add `ANTHROPIC_API_KEY`)

---

### T5 — Route input page (frontend)
**Complexity:** Low | **Est:** 1.5h

- `/` page: start + destination (Google Places autocomplete), departure time picker (default now), cycling/walking toggle
- Grounding stat above the form ("78% of young women…") citing *Gemeente Amsterdam, 2025*
- Submit → call `GET /routes` → navigate to `/results`
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

**Files:**
- `frontend/app/page.tsx`
- `frontend/lib/api.ts` (`getRoute()`)
- `frontend/.env.local.example`

---

### T6 — Results page (frontend)
**Complexity:** Medium | **Est:** 2.5h

- `/results` page with:
  - Safety score badge + subscore breakdown (lighting / incidents / traffic)
  - Travel time + distance
  - Google Map embed with polyline
  - "Why this route" AI explanation block
  - "Safety tips" list (3–5 items)
  - "Open in Google Maps" deep-link button
  - `ai_status: "fallback"` indicator when AI unavailable
  - Loading and error states

**Files:**
- `frontend/app/results/page.tsx`
- `frontend/components/SafetyScore.tsx`
- `frontend/components/RouteMap.tsx`
- `frontend/components/RouteExplanation.tsx`
- `frontend/components/SafetyTips.tsx`

---

### T7 — Integration + end-to-end test
**Complexity:** Low | **Est:** 1h

- Verify `NEXT_PUBLIC_API_URL` → Railway backend
- Test full flow on real Amsterdam addresses (e.g. Mercatorplein → Centraal Station) at midday and midnight
- Confirm tips change with time and mode
- Confirm AI-fallback path renders cleanly when `ANTHROPIC_API_KEY` unset
- Add Vercel production URL to backend CORS

**Files:**
- `backend/main.py` (CORS origins)

---

### T8 — Polish + demo prep
**Complexity:** Low | **Est:** 1h

- Mobile-friendly layout pass
- NachtRoute branding + tagline on home page
- "Powered by open Amsterdam data" footer with source links
- Smoke test the demo script end-to-end

---

## Summary

| Task | Owner | Est | Priority |
|------|-------|-----|----------|
| T1 Database + seed (incl. hotspots) | Backend | 1.5h | P0 |
| T2 Safety scoring (+ hotspot penalty) | Backend | 2h | P0 |
| T3 Routing API | Backend | 2h | P0 |
| T4 AI narration + tips + fallback | Backend | 2h | P0 |
| T5 Input page (+ grounding stat) | Frontend | 1.5h | P0 |
| T6 Results page (+ explanation + tips) | Frontend | 2.5h | P0 |
| T7 Integration | Both | 1h | P0 |
| T8 Polish | Both | 1h | P1 |

**Total estimate: ~13.5 hours**
