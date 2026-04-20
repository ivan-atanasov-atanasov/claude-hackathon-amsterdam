# PRD — Amsterdam Heat Refuge Finder

## Overview

A dead-simple public web tool that lets anyone in Amsterdam enter their postcode and instantly see the 3 nearest open cool refuges, with live capacity derived from crowd density. Built for the Amsterdam Municipality to help vulnerable residents find safety during Code Red heat events.

Built for the **Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26, 2026).

---

## Problem Statement

Vulnerable Amsterdam residents (elderly, low-income, health-dependent) are disproportionately harmed during extreme heat events. The refuges exist. The risk maps exist. The gap is the **last mile**: residents don't know which refuge is open, where it is, or whether it has room. No trusted, low-barrier tool exists to answer that question in real time.

> *"Vulnerable Amsterdam residents struggle to reach cool refuges during Code Red heat events because they have no simple, real-time way to know which refuge nearby is open and has space."*

---

## Target Users

**Primary — any Amsterdam resident during a Code Red event:**
- Elderly, low-income, or health-dependent residents in high-heat neighborhoods (focus: Mercatorplein area)
- Reached via existing channels: GP letters, Red Cross, WhatsApp, municipality comms
- Needs: zero friction, works on any smartphone, no account required

**Secondary — municipality coordinator / gebiedsmakelaar:**
- Manages refuge status during a heat event
- Needs: simple admin view to manually override open/full/closed status

---

## MVP Features (prioritized)

1. **Postcode search** — resident enters postcode, sees 3 nearest open refuges
2. **Live capacity status** — open / full / closed, with number of spots remaining
3. **Crowd-based capacity** — capacity derived from simulated phone GPS density in refuge area
4. **Refuge map view** — show the 3 results on a Google Map with walking distance
5. **Coordinator admin** — simple shared page to manually override a refuge's status (no login for MVP)

---

## User Stories

- As a resident, I enter my postcode and within 10 seconds I see the 3 nearest cool refuges that are currently open, so I know exactly where to go.
- As a resident, I can see how full each refuge is so I choose the one with the most space.
- As a coordinator, I can mark a refuge as closed or full when on the ground, so residents aren't directed to a location that can't receive them.
- As a coordinator, I can see all refuges in the Mercatorplein area and their current status at a glance.

---

## Technical Requirements

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 (Vercel) |
| Backend | FastAPI + Python (Railway) |
| Database | Supabase (PostgreSQL) |
| Maps | Google Maps API (display, distance, walking directions) |
| Crowd density | Simulated — mock GPS density data per refuge, refreshed periodically |
| Auth | None (public page + shared admin URL) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/refuges?postcode={postcode}` | Returns 3 nearest open refuges with capacity |
| GET | `/refuges` | Returns all refuges with current status (admin) |
| PATCH | `/refuges/{id}/status` | Coordinator overrides status (open/full/closed) |

---

## Database Schema

### `refuges`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | e.g. "OBA Bibliotheek Bos en Lommer" |
| address | text | Full street address |
| postcode | text | Amsterdam postcode |
| lat | float | Latitude |
| lng | float | Longitude |
| type | text | library / supermarket / community_center |
| total_capacity | int | Max number of people |
| status_override | text | null / open / full / closed (coordinator sets this) |
| created_at | timestamp | |
| updated_at | timestamp | |

### `crowd_snapshots`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| refuge_id | uuid | FK → refuges |
| crowd_count | int | Simulated current occupancy |
| recorded_at | timestamp | |

---

## Seed Data — Mercatorplein Area

Real Amsterdam locations to seed for the demo:

| Name | Type | Notes |
|------|------|-------|
| OBA Bibliotheek Bos en Lommer | library | AC, public |
| Jumbo Supermarkt Mercatorplein | supermarket | AC |
| Albert Heijn Jan van Galenstraat | supermarket | AC |
| Bibliotheek Lelylaan | library | AC, public |
| Buurthuis de Meevaart | community_center | Cool space |

---

## Out of Scope

- SMS / push notification outreach (municipality uses existing channels)
- User accounts or authentication
- Multi-city support
- Resident registration or Stadspas integration
- Real telecom GPS data (simulated for demo)
- Multilingual support
- Native mobile app
- Historical heat data or analytics

---

## Success Criteria

At the demo:
1. Resident enters a Mercatorplein postcode → sees 3 nearest open refuges in under 10 seconds
2. Each refuge shows live capacity (e.g. "18 spots remaining")
3. Results appear on a Google Map with walking distance
4. Coordinator flips a refuge to "full" in the admin view → it disappears from resident results in real time
5. Full flow explainable in under 60 seconds to a non-technical audience

---

*Version: 1.0 — 2026-04-20*
