-- =============================================================================
-- Remove interested_sports if it was added; use interested_categories (existing)
-- =============================================================================

ALTER TABLE users DROP COLUMN IF EXISTS interested_sports;
