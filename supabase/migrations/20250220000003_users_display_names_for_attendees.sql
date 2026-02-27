-- Allow reading display names of users who are event attendees (for "Who's going" on event detail page)
CREATE POLICY "Public can read event attendees display names"
  ON users FOR SELECT
  TO public
  USING (
    EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.user_id = users.id)
  );

COMMENT ON POLICY "Public can read event attendees display names" ON users IS 'Enables event detail page to show attendee names; only users who have joined at least one event are visible.';
