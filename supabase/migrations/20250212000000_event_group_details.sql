-- =============================================================================
-- Event and group details + relationships
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Groups: cover image, organizer
-- -----------------------------------------------------------------------------
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_groups_organizer ON groups(organizer_id);

COMMENT ON COLUMN groups.cover_image_url IS 'URL for the group cover/hero image (e.g. Supabase Storage or external)';
COMMENT ON COLUMN groups.organizer_id IS 'User who created or primarily manages the group (for Admin profile card)';

-- -----------------------------------------------------------------------------
-- Events: description, location, banner image
-- -----------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS banner_image_url text;

COMMENT ON COLUMN events.description IS 'Full event description / details (markdown or plain text)';
COMMENT ON COLUMN events.location_name IS 'Venue or place name (e.g. WeWork Gangnam)';
COMMENT ON COLUMN events.address IS 'Full address for map and display';
COMMENT ON COLUMN events.banner_image_url IS 'URL for the event banner/hero image';

-- -----------------------------------------------------------------------------
-- Event hosts (who is hosting this event — "Hosted by X, Y and 2 others")
-- -----------------------------------------------------------------------------
CREATE TABLE event_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_hosts_event ON event_hosts(event_id);
CREATE INDEX idx_event_hosts_user ON event_hosts(user_id);

COMMENT ON TABLE event_hosts IS 'Users who host an event (shown as "Hosted by X, Y"). Order by display_order.';

-- -----------------------------------------------------------------------------
-- Group photos (grid of photos for group detail page)
-- -----------------------------------------------------------------------------
CREATE TABLE group_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_group_photos_group ON group_photos(group_id);

COMMENT ON TABLE group_photos IS 'Photos displayed in the group detail page (e.g. 4x2 grid). Order by display_order.';

-- =============================================================================
-- RLS for new tables
-- =============================================================================

ALTER TABLE event_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_photos ENABLE ROW LEVEL SECURITY;

-- Event hosts: public read (so anyone can see who is hosting)
CREATE POLICY "Event hosts are viewable by everyone"
  ON event_hosts FOR SELECT
  TO public
  USING (true);

-- Only host group organizer or admins should manage event_hosts (optional; restrict later)
-- For now no INSERT/UPDATE/DELETE policy = only service role / backend can modify

-- Group photos: public read
CREATE POLICY "Group photos are viewable by everyone"
  ON group_photos FOR SELECT
  TO public
  USING (true);

-- Only group organizer or admins should manage group_photos (optional; restrict later)
