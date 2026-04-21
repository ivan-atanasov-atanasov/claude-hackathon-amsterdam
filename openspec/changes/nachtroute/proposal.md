# Proposal — NachtRoute

## What
Build NachtRoute: a safe cycling and walking route planner for women in Amsterdam. Users enter a start, destination, departure time, and travel mode — and get the safest route based on real Amsterdam open data (street lighting, incident history, foot traffic). One tap opens it in Google Maps.

## Why
Women in Amsterdam avoid cycling or walking at night because they don't know which route is safe. Google Maps optimizes for speed — not safety. No tool currently routes women through well-lit, low-incident streets. NachtRoute closes that gap using data the municipality already publishes.

## NGO Partner
**Wij eisen de nacht op** (wijeisendenachtop.nl) — campaign for women's right to move freely through public spaces at any time.

## Value
- Immediate, practical safety tool women can use tonight
- Built on open Amsterdam data — no proprietary dependencies
- Lightweight enough to share via WhatsApp, GP letters, Red Cross

## Scope
Full-stack feature across frontend and backend:
- New pages: home (route input) + results
- New backend: routing API + safety scoring engine
- Data pipeline: import and process Amsterdam open datasets
- Google Maps integration for display and navigation handoff
