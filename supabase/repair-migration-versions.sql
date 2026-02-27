-- =============================================================================
-- One-time repair: Supabase CLI expects "version" to be the 14-digit timestamp
-- only (e.g. 20250211000000), not the full filename (20250211000000_initial_schema.sql).
-- Run this in the Supabase Dashboard SQL Editor if db push says "Remote migration
-- versions not found in local migrations directory" after you inserted full filenames.
-- =============================================================================

-- Add rows with timestamp-only version, then remove rows with full-filename version.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
SELECT
  substring(version FROM '^([0-9]{14})') AS version,
  name,
  statements
FROM supabase_migrations.schema_migrations
WHERE version ~ '^[0-9]{14}_.*\.sql$'
ON CONFLICT (version) DO NOTHING;

DELETE FROM supabase_migrations.schema_migrations
WHERE version ~ '^[0-9]{14}_.*\.sql$';
