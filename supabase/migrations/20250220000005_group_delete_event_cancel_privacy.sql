-- =============================================================================
-- Group soft delete (7-day restore), event cancel, event privacy
-- =============================================================================

-- Groups: soft delete (owner can restore within 7 days)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
COMMENT ON COLUMN groups.deleted_at IS 'When set, group is hidden from listings. Owner can restore within 7 days; then permanent delete.';

CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at) WHERE deleted_at IS NOT NULL;

-- Events: cancelled (stays visible with banner)
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
COMMENT ON COLUMN events.cancelled_at IS 'When set, event shows as cancelled; boosted status cleared.';

-- Event privacy: public, private (visible, invite/accept required), exclusive (only group members see)
ALTER TABLE events ADD COLUMN IF NOT EXISTS privacy text DEFAULT 'public';
COMMENT ON COLUMN events.privacy IS 'public = everyone; private = visible but requires invite/accept; exclusive = only host group members see.';

UPDATE events SET privacy = 'public' WHERE privacy IS NULL;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_privacy_check;
ALTER TABLE events ADD CONSTRAINT events_privacy_check CHECK (privacy IN ('public', 'private', 'exclusive'));
