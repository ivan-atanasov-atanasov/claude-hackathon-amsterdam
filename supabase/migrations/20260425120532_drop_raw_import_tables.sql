-- Raw import tables are no longer needed in Supabase.
-- Lighting points and incidents are fetched from the Amsterdam Data API
-- in memory at grid-compute time and never persisted to the database.
-- Only safety_grid (the pre-computed output) lives in Supabase.
drop table if exists lighting_points;
drop table if exists incidents;
