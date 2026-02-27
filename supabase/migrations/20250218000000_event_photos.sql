-- =============================================================================
-- Event photos (album for event detail / admin)
-- =============================================================================

CREATE TABLE event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_event_photos_event ON event_photos(event_id);

COMMENT ON TABLE event_photos IS 'Photos displayed in the event photo album. Order by display_order.';

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

-- Event photos: public read
CREATE POLICY "Event photos are viewable by everyone"
  ON event_photos FOR SELECT
  TO public
  USING (true);

-- Event managers (host group organizer or admins) can insert/update/delete
CREATE POLICY "Event managers can insert event photos"
  ON event_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE e.id = event_photos.event_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

CREATE POLICY "Event managers can delete event photos"
  ON event_photos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE e.id = event_photos.event_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

CREATE POLICY "Event managers can update event photos"
  ON event_photos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE e.id = event_photos.event_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

-- =============================================================================
-- Event attendees: allow event managers to remove any attendee
-- =============================================================================

CREATE POLICY "Event managers can remove attendees"
  ON event_attendees FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE e.id = event_attendees.event_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );
