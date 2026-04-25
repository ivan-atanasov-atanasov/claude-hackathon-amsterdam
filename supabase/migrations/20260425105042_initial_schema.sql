-- Enable PostGIS for geospatial support
create extension if not exists postgis;

-- Street lighting points from Amsterdam Data API
create table lighting_points (
  id          uuid primary key default gen_random_uuid(),
  lat         float not null,
  lng         float not null,
  type        text,
  imported_at timestamp with time zone default now()
);

create index lighting_points_lat_lng on lighting_points (lat, lng);

-- Citizen incident reports (SIA meldingen)
create table incidents (
  id          uuid primary key default gen_random_uuid(),
  lat         float not null,
  lng         float not null,
  category    text not null,
  occurred_at timestamp with time zone,
  imported_at timestamp with time zone default now()
);

create index incidents_lat_lng on incidents (lat, lng);
create index incidents_occurred_at on incidents (occurred_at);

-- Nuisance and camera zones (overlastgebieden)
create table overlast_zones (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,
  geometry       jsonb not null,
  validity_days  text[],
  validity_hours text,
  polarity       text not null
);

-- Survey-seeded unsafe areas
create table unsafe_areas (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  kind     text not null,
  source   text not null,
  geometry jsonb not null
);

-- Neighborhood safety baseline (Veiligheidsindex 2025-3)
create table buurt_baseline (
  buurt_code       text primary key,
  veiligheidsindex float not null check (veiligheidsindex >= 0 and veiligheidsindex <= 1),
  updated_at       timestamp with time zone default now()
);

-- Pre-computed safety grid (~100m cells covering Amsterdam)
create table safety_grid (
  id                     uuid primary key default gen_random_uuid(),
  grid_x                 int not null,
  grid_y                 int not null,
  lat                    float not null,
  lng                    float not null,
  buurt_code             text references buurt_baseline (buurt_code),
  lighting_score         float check (lighting_score >= 0 and lighting_score <= 1),
  incident_score         float check (incident_score >= 0 and incident_score <= 1),
  building_density_score float check (building_density_score >= 0 and building_density_score <= 1),
  overview_score         float check (overview_score >= 0 and overview_score <= 1),
  camera_bonus           float check (camera_bonus >= 0 and camera_bonus <= 0.2),
  overlast_penalty       float check (overlast_penalty >= 0 and overlast_penalty <= 0.3),
  hotspot_penalty        float check (hotspot_penalty >= 0 and hotspot_penalty <= 0.2),
  updated_at             timestamp with time zone default now()
);

create unique index safety_grid_cell on safety_grid (grid_x, grid_y);
create index safety_grid_lat_lng on safety_grid (lat, lng);
create index safety_grid_buurt_code on safety_grid (buurt_code);
