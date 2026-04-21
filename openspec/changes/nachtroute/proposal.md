# Proposal — NachtRoute

## What
Build NachtRoute: a safe cycling and walking route planner for women in Amsterdam. Users enter a start, destination, departure time, and travel mode — and get the single safest route based on real Amsterdam open data (street lighting, incident history, hotspot polygons, time-of-day foot traffic). The results page also shows an AI-generated "why this route" explanation and 3–5 contextual safety tips tailored to mode, time, and hotspots along the path. One tap opens the route in Google Maps.

Route selection is fully deterministic. Claude is used only to narrate the chosen route and generate tips — never to pick the route.

## Why
Gemeente Amsterdam's *Sociale veiligheid op de fiets 2025* survey found that **78% of young women have been afraid on the bike**, **47%** of all adult cyclists fear harassment, and **~50%** already avoid certain routes. Women's top-requested fixes are better lighting and safer routes. Google Maps optimizes for speed. No tool currently routes women through well-lit, low-incident streets. NachtRoute closes that gap using data the municipality already publishes.

## NGO Partner
**Wij eisen de nacht op** (wijeisendenachtop.nl) — campaign for women's right to move freely through public spaces at any time.

## Value
- Immediate, practical safety tool women can use tonight
- Grounded in a published 2025 Amsterdam survey, not speculation
- Built on open Amsterdam data — no proprietary dependencies
- Lightweight enough to share via WhatsApp, GP letters, Red Cross
- Clear AI boundary: deterministic routing keeps the tool reviewable and reliable; Claude adds the explanation + tips layer

## Scope
Full-stack feature across frontend and backend:
- New pages: home (route input) + results (route, score, explanation, tips)
- New backend: routing API + deterministic safety scoring engine + Claude narration + static fallback tips
- Data pipeline: import and process Amsterdam open datasets (lighting, incidents) plus curated hotspot polygons (parks, squares, stations)
- Google Maps integration for display and navigation handoff

## Non-goals
- User accounts, saved routes, live user-submitted incidents
- Mid-journey notifications, native mobile apps
- Claude making routing decisions
