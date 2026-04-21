# Tasks — NachtRoute

## Implementation Order

---

### T1 — Database schema + seed data
**Complexity:** Low | **Est:** 1h

- Create Supabase migration for `lighting_points`, `incidents`, `safety_grid` tables
- Write seed script to import Amsterdam street lighting GeoJSON (`maps.amsterdam.nl/lichtpunten/`)
- Write seed script to import incident CSV from `onderzoek.amsterdam.nl`
- Pre-compute `safety_grid` (100m cells, lighting + incident scores)

**Files:**
- `backend/migrations/001_nachtroute_schema.sql`
- `backend/scripts/seed_lighting.py`
- `backend/scripts/seed_incidents.py`
- `backend/scripts/compute_safety_grid.py`

---

### T2 — Safety scoring engine (backend)
**Complexity:** Medium | **Est:** 2h

- Implement `safety_grid` lookup by coordinate
- Implement time-of-day weight adjustment (day vs. night)
- Implement route safety scorer: takes a polyline, samples grid cells, returns average score
- Unit tests for scoring logic

**Files:**
- `backend/services/safety.py`
- `backend/tests/test_safety.py`

---

### T3 — Routing API endpoint (backend)
**Complexity:** Medium | **Est:** 2h

- Integrate Google Maps Directions API (cycling + walking modes)
- Request 3 route alternatives, score each, return highest-scoring
- Implement `GET /routes` endpoint
- Implement `GET /safety` endpoint
- Add `GOOGLE_MAPS_API_KEY` to backend env vars

**Files:**
- `backend/services/routing.py`
- `backend/routers/routes.py`
- `backend/main.py` (register router)
- `backend/.env` (add `GOOGLE_MAPS_API_KEY`)

---

### T4 — Route input page (frontend)
**Complexity:** Low | **Est:** 1.5h

- Build `/` page with start + destination address inputs
- Add Google Places Autocomplete for address inputs
- Add departure time picker (default: now)
- Add Cycling / Walking mode toggle
- On submit, call `GET /routes` and navigate to `/results`
- Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to frontend env vars

**Files:**
- `frontend/app/page.tsx`
- `frontend/lib/api.ts` (add `getRoute()`)
- `frontend/.env.local` (add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)

---

### T5 — Results page (frontend)
**Complexity:** Medium | **Est:** 2h

- Build `/results` page
- Display safety score badge (score out of 10, color-coded)
- Display estimated travel time
- Embed Google Map showing the route polyline
- "Open in Google Maps" deep link button
- "Search again" link back to home
- Handle loading and error states

**Files:**
- `frontend/app/results/page.tsx`
- `frontend/components/SafetyScore.tsx`
- `frontend/components/RouteMap.tsx`

---

### T6 — Connect frontend to backend + end-to-end test
**Complexity:** Low | **Est:** 1h

- Verify `NEXT_PUBLIC_API_URL` correctly points to Railway backend
- Test full flow: enter addresses → get route → open in Google Maps
- Fix any CORS issues (add Vercel production URL to backend CORS config)

**Files:**
- `backend/main.py` (CORS origins)

---

### T7 — Polish + demo prep
**Complexity:** Low | **Est:** 1h

- Mobile-friendly layout check
- Add NachtRoute branding (name + tagline on home page)
- Add "Powered by open Amsterdam data" footer
- Smoke test on real Amsterdam addresses (e.g. Mercatorplein → Centraal Station)

---

## Summary

| Task | Owner | Est | Priority |
|------|-------|-----|----------|
| T1 Database + seed | Backend | 1h | P0 |
| T2 Safety scoring | Backend | 2h | P0 |
| T3 Routing API | Backend | 2h | P0 |
| T4 Input page | Frontend | 1.5h | P0 |
| T5 Results page | Frontend | 2h | P0 |
| T6 Integration | Both | 1h | P0 |
| T7 Polish | Both | 1h | P1 |

**Total estimate: ~10.5 hours**
