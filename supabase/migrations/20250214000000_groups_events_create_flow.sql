-- =============================================================================
-- Groups: privacy; Events: attendee_limit, optional end_time; RLS for create
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Groups: add privacy (private group: invite-only, member list hidden)
-- -----------------------------------------------------------------------------
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS privacy boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN groups.privacy IS 'If true: join by invite or approval only; non-members cannot see member list (only count).';

-- -----------------------------------------------------------------------------
-- Events: optional end_time, attendee_limit
-- -----------------------------------------------------------------------------
-- Allow end_time to be null (optional "End Time")
ALTER TABLE events
  ALTER COLUMN end_time DROP NOT NULL;

-- Drop the check that requires end_time > start_time when end_time can be null
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_end_after_start;

ALTER TABLE events
  ADD CONSTRAINT events_end_after_start
  CHECK (end_time IS NULL OR end_time > start_time);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS attendee_limit int;

COMMENT ON COLUMN events.attendee_limit IS 'Max attendees; NULL means no limit.';

-- -----------------------------------------------------------------------------
-- RLS: allow authenticated users to create groups and events
-- -----------------------------------------------------------------------------
CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update own groups (organizer)"
  ON groups FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update events of their groups"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = events.host_group_id AND g.organizer_id = auth.uid()
    )
  );
