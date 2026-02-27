-- =============================================================================
-- boosted_until: optional end date for boost; auto-unboost when past
-- =============================================================================

ALTER TABLE groups ADD COLUMN IF NOT EXISTS boosted_until date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS boosted_until date;

COMMENT ON COLUMN groups.boosted_until IS 'When boost ends (null = no end). If set and in the past, entity is effectively unboosted.';
COMMENT ON COLUMN events.boosted_until IS 'When boost ends (null = no end). If set and in the past, entity is effectively unboosted.';

-- Expire boosts where boosted_until is in the past (call when listing in admin or on a schedule)
CREATE OR REPLACE FUNCTION public.expire_boosted_entities()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE groups SET is_boosted = false WHERE is_boosted = true AND boosted_until IS NOT NULL AND boosted_until < current_date;
  UPDATE events SET is_boosted = false WHERE is_boosted = true AND boosted_until IS NOT NULL AND boosted_until < current_date;
$$;

COMMENT ON FUNCTION public.expire_boosted_entities IS 'Sets is_boosted = false for groups/events where boosted_until < today. Call from admin list or cron.';

GRANT EXECUTE ON FUNCTION public.expire_boosted_entities() TO authenticated;
