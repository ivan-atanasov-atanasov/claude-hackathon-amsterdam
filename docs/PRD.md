# Product Requirements Document

## Product Name

**Amsterdam Climate Risk Dashboard** (working title: *KlimaatKaart*)

---

## Overview

An integrated climate risk dashboard for Amsterdam city planners that combines heat stress, flood risk, drought vulnerability, and vulnerable population data into a single map-based interface. The tool enables data-driven prioritization of climate adaptation investments by neighborhood.

Built for the **Whale x Anthropic: Claude Code Hackathon — Amsterdam** (April 25–26, 2026).

---

## Problem Statement

### The Pain

Amsterdam city planners need to prioritize climate adaptation investments across 100+ neighborhoods, but critical data is fragmented across multiple systems:

- **Heat stress maps** — Klimaateffectatlas (image tiles, no neighborhood aggregation)
- **Flood/drought risk** — maps.amsterdam.nl (separate GeoJSON layers)
- **Vulnerable population data** — GGD/CBS (separate demographic databases)
- **Municipal heat response** — Amsterdams Hitteplan (PDF protocols, manual coordination)

**Result**: Planners cannot easily answer: *"Which 10 neighborhoods should we prioritize for intervention, considering compound climate AND social vulnerability risk?"*

### The Context

According to KNMI'14 climate scenarios, by 2050 Amsterdam will face:

| Climate Variable | Projected Change | Impact |
|------------------|------------------|--------|
| Summer temperature | +1 to +2.3°C | More frequent/intense heat waves |
| Winter precipitation | +3 to +17% | Sewer system overload |
| Sea level rise | +15 to +40 cm | Flood risk from North Sea & River Lek |
| Extreme rainfall | More intense | Flash flooding, urban water overflow |
| Summer drought | Longer dry periods | Ground subsidence, infrastructure stress |

The urban heat island effect means Amsterdam stays **significantly warmer at night** than surrounding rural areas, preventing vulnerable residents from recovering from daytime heat exposure.

### Health Consequences

Heat stress causes:
- Reduced labor productivity
- Health damage (dehydration, heat exhaustion)
- **Mortality** — particularly among elderly, chronically ill, and homeless populations

The Amsterdams Hitteplan 2024 identifies these **vulnerable groups**:
- Elderly (65+), especially those living alone
- Chronically ill
- Young children
- Homeless (dak- en thuislozen)
- Outdoor workers
- People in poverty (fewer resources for cooling)
- People with small social networks

---

## Target Users

### Primary User: Municipal Climate Adaptation Planner

**Role**: Works at Gemeente Amsterdam in the climate adaptation or spatial planning department

**Responsibilities**:
- Allocate budget for green infrastructure (trees, parks, green roofs)
- Prioritize neighborhoods for heat/flood interventions
- Coordinate with GGD, housing corporations, district councils
- Report to city council on climate adaptation progress

**Current workflow**:
1. Opens multiple browser tabs (maps.amsterdam.nl, klimaateffectatlas, CBS data)
2. Manually cross-references heat maps with demographic data
3. Creates PowerPoint slides to communicate priorities
4. Struggles to justify prioritization decisions with integrated data

**Key need**: *"Show me which neighborhoods have the highest COMPOUND risk (heat + flood + vulnerable population) so I can defend my budget allocation."*

### Secondary Users (future scope)
- GGD health officials (heat wave response coordination)
- Housing corporation planners (building retrofit prioritization)
- District council members (understanding local risk)

---

## MVP Features (Prioritized)

### P0 — Must Have for Demo

1. **Interactive Map with Toggleable Layers**
   - Base map of Amsterdam with neighborhood (buurt) boundaries
   - Toggle layers: Heat stress | Flood risk | Drought | Vulnerable population density
   - Visual overlay showing compound risk intensity
   - Data source: WMS tiles from Klimaateffectatlas + Amsterdam GeoJSON

2. **Neighborhood Risk Ranking Table**
   - Sortable list of all neighborhoods
   - Columns: Neighborhood name | Heat score | Flood score | Vulnerability score | **Combined risk score**
   - Click row to zoom to neighborhood on map
   - Combined score = weighted formula (configurable)

3. **Neighborhood Detail Panel**
   - Click neighborhood on map → side panel shows:
     - Individual risk scores (heat, flood, drought, population vulnerability)
     - Key statistics (population, % elderly, housing age)
     - Risk trend indicator (if 2050 projection available)

4. **Simple Scenario Toggle**
   - Switch between "Current" and "2050 Projection"
   - Shows how risk scores change under KNMI climate scenarios
   - Visual indication of neighborhoods that will become critical

### P1 — Nice to Have

5. **Risk Threshold Alerts**
   - Highlight neighborhoods exceeding configurable risk thresholds
   - "Show me all neighborhoods where combined risk > 7"

6. **Export/Share**
   - Download current view as PDF report
   - Share link to specific neighborhood view

### P2 — Out of Scope for Hackathon

- User accounts / authentication
- Real-time weather data integration
- Mobile-optimized interface
- Multi-language support
- Historical trend analysis
- Integration with municipal workflow systems

---

## User Stories

### US1: View Compound Risk Map
> As a city planner, I want to see heat, flood, and vulnerability data on one map, so that I can quickly identify neighborhoods with multiple overlapping risks.

**Acceptance criteria**:
- [ ] Map loads with Amsterdam neighborhood boundaries
- [ ] Can toggle each layer on/off independently
- [ ] Overlapping risks are visually distinguishable
- [ ] Legend explains color coding

### US2: Rank Neighborhoods by Risk
> As a city planner, I want to sort neighborhoods by combined risk score, so that I can create a prioritized intervention list.

**Acceptance criteria**:
- [ ] Table shows all neighborhoods with risk scores
- [ ] Can sort by any column (ascending/descending)
- [ ] Combined score calculated from individual factors
- [ ] Clicking a row highlights neighborhood on map

### US3: Inspect Neighborhood Details
> As a city planner, I want to click a neighborhood and see detailed risk breakdown, so that I can understand what's driving the risk score.

**Acceptance criteria**:
- [ ] Clicking neighborhood opens detail panel
- [ ] Panel shows all individual risk factors
- [ ] Panel shows relevant demographics
- [ ] Can close panel and select different neighborhood

### US4: Compare Current vs Future Risk
> As a city planner, I want to toggle between current and 2050 projections, so that I can prioritize neighborhoods that will become critical.

**Acceptance criteria**:
- [ ] Toggle switch for "Current" vs "2050"
- [ ] Map colors update to reflect projected risk
- [ ] Table scores update accordingly
- [ ] Visual indicator for neighborhoods with largest increase

---

## Technical Requirements

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│    Supabase     │
│  Next.js 16     │     │    FastAPI      │     │   PostgreSQL    │
│  + Leaflet/Map  │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌─────────────────┐
        └──────────────▶│  External WMS   │
                        │ Klimaateffect-  │
                        │     atlas       │
                        └─────────────────┘
```

### Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 | App Router |
| Map Library | Leaflet + react-leaflet | Or Mapbox GL JS |
| Backend | FastAPI (Python 3.14) | Lightweight API |
| Database | Supabase (PostgreSQL) | Neighborhood data, risk scores |
| External Data | WMS from Klimaateffectatlas | Heat, flood, drought layers |
| Deployment | Vercel (frontend) + Railway (backend) | Existing CI/CD |

### Data Sources

| Data Layer | Source | Format | Integration Method |
|------------|--------|--------|-------------------|
| Heat stress (gevoelstemperatuur) | Klimaateffectatlas | WMS | Leaflet TileLayer.WMS |
| Urban Heat Island (UHI) | Atlas Leefomgeving / RIVM | WMS or GeoTIFF | WMS preferred |
| Flood risk | Klimaateffectatlas | WMS | Leaflet TileLayer.WMS |
| Drought risk | Klimaateffectatlas | WMS | Leaflet TileLayer.WMS |
| Neighborhood boundaries | maps.amsterdam.nl | GeoJSON | Download + store in Supabase |
| Vulnerable population | Mock data (based on CBS patterns) | JSON | Store in Supabase |
| 2050 projections | KNMI'14 multipliers | Calculated | Apply to baseline scores |

### API Endpoints

```
GET  /health                          # Health check
GET  /api/neighborhoods                # List all neighborhoods with risk scores
GET  /api/neighborhoods/:id            # Get single neighborhood details
GET  /api/neighborhoods/:id/risks      # Get risk breakdown for neighborhood
GET  /api/rankings?sort_by=combined    # Get sorted neighborhood list
GET  /api/scenarios                    # Get available scenarios (current, 2050)
POST /api/rankings/calculate           # Recalculate with custom weights
```

### Database Schema

```sql
-- Neighborhoods (buurten)
CREATE TABLE neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,        -- e.g., "A00a"
  name VARCHAR(255) NOT NULL,              -- e.g., "Burgwallen-Oude Zijde"
  district VARCHAR(255),                   -- e.g., "Centrum"
  geometry JSONB,                          -- GeoJSON polygon
  population INTEGER,
  area_km2 DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk Scores (per neighborhood, per scenario)
CREATE TABLE risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID REFERENCES neighborhoods(id),
  scenario VARCHAR(20) NOT NULL,           -- 'current' or '2050'
  heat_score DECIMAL(3,2),                 -- 0.00 - 1.00
  flood_score DECIMAL(3,2),
  drought_score DECIMAL(3,2),
  vulnerability_score DECIMAL(3,2),
  combined_score DECIMAL(3,2),             -- Weighted combination
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(neighborhood_id, scenario)
);

-- Vulnerability Factors (demographics)
CREATE TABLE vulnerability_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID REFERENCES neighborhoods(id),
  elderly_pct DECIMAL(5,2),                -- % population 65+
  low_income_pct DECIMAL(5,2),             -- % below poverty line
  single_person_households_pct DECIMAL(5,2),
  poor_housing_pct DECIMAL(5,2),           -- % pre-1970 housing
  green_space_m2_per_capita DECIMAL(10,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Out of Scope

Explicitly **NOT building** for the hackathon:

- Real-time weather alerts or RIVM hitteplan integration
- User authentication or saved preferences
- Mobile-responsive design (desktop-first)
- Multi-city support (Amsterdam only)
- Historical data analysis or trends
- Integration with municipal planning software
- Automated report generation
- Public-facing citizen portal
- Dutch language localization (English UI for demo)

---

## Success Criteria

### Demo "Wow Moments"

1. **"Finally, one map"** — Stakeholder sees heat + flood + vulnerability on single view for the first time
2. **"I can rank neighborhoods"** — Sorted table instantly shows top 10 priority areas
3. **"2050 is scary"** — Toggle to future scenario shows dramatic risk increase in specific areas
4. **"Click and understand"** — Neighborhood detail panel explains WHY an area is high risk

### Quantitative Success

- [ ] Map loads in < 3 seconds
- [ ] All 100+ Amsterdam neighborhoods displayed with risk scores
- [ ] 4 data layers toggleable without page reload
- [ ] Current vs 2050 scenario toggle functional
- [ ] At least 3 judges say "I would use this"

### Technical Success

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Railway
- [ ] No critical bugs during demo
- [ ] WMS layers render correctly
- [ ] Mobile doesn't completely break (even if not optimized)

---

## Open Questions (To Resolve)

1. **Risk weighting formula** — How should we weight heat vs flood vs vulnerability in combined score? Equal weights? Or should heat be weighted higher given the Hitteplan focus?

2. **Neighborhood granularity** — Use buurten (neighborhoods, ~400) or wijken (districts, ~100)? Buurten gives more precision but more data.

3. **2050 projection method** — Apply KNMI multipliers uniformly, or vary by neighborhood characteristics?

4. **Map library choice** — Leaflet (simpler, open source) or Mapbox (prettier, has free tier)?

5. **Demo data coverage** — Full Amsterdam or focus on 2-3 high-risk districts for demo polish?

---

## References

### Data Sources
- [Klimaateffectatlas](https://www.klimaateffectatlas.nl/nl/kaartviewer) — Heat stress, flood, drought WMS layers
- [Atlas Leefomgeving - UHI](https://www.atlasleefomgeving.nl/stedelijk-hitte-eiland-effect-uhi) — Urban Heat Island data
- [maps.amsterdam.nl](https://maps.amsterdam.nl/klimaatadaptatie/) — Amsterdam climate adaptation maps
- [maps.amsterdam.nl Open Geodata](https://maps.amsterdam.nl/open_geodata/) — GeoJSON downloads
- [KNMI'14 Scenarios](https://www.knmi.nl/nederland-nu/KNMI14_klimaatscenarios/kerncijfers) — Climate projections

### Policy Documents
- Amsterdams Hitteplan 2024 (PDF) — Municipal heat response plan
- Strategie Klimaatadaptatie Amsterdam 2020 — City climate adaptation strategy

### Technical
- [Leaflet WMS Documentation](https://leafletjs.com/reference.html#tilelayer-wms)
- [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/) — Data license for Klimaateffectatlas

---

## Appendix: Risk Factor Details

### Heat Risk Indicators (from Hitteplan)

The municipality uses these factors for heat risk assessment:
- Gevoelstemperatuur (perceived temperature)
- Urban Heat Island intensity
- Percentage paved surface (verharding)
- Green space coverage
- Building density
- Night-time temperature retention

### Vulnerable Population Indicators

From the Hitteplan, vulnerability is determined by:
- Age distribution (especially 65+ and under 5)
- Chronic illness prevalence
- Social isolation (single-person households)
- Income level (ability to afford cooling)
- Housing quality (insulation, ventilation)
- Access to cooling spaces (parks, public buildings)

### Compound Risk Formula (Proposed)

```
combined_score = (
  w_heat * heat_score +
  w_flood * flood_score +
  w_drought * drought_score +
  w_vulnerability * vulnerability_score
) / (w_heat + w_flood + w_drought + w_vulnerability)

# Suggested weights for Amsterdam (heat-focused):
w_heat = 0.35
w_flood = 0.25
w_drought = 0.15
w_vulnerability = 0.25
```

---

*Document version: DRAFT 0.1*
*Last updated: 2026-04-20*
*Status: Awaiting user flow confirmation and technical decisions*
