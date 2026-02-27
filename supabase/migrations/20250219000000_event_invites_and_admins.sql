-- =============================================================================
-- Event admins and event admin invites (create first so event_invites can reference)
-- =============================================================================

CREATE TABLE event_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_admins_event ON event_admins(event_id);
CREATE INDEX idx_event_admins_user ON event_admins(user_id);

ALTER TABLE event_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event admins are viewable by all authenticated"
  ON event_admins FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Event managers (host group owner/admin) can insert event admins"
  ON event_admins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
      WHERE e.id = event_admins.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
    )
  );

CREATE POLICY "Event managers can delete event admins"
  ON event_admins FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
      WHERE e.id = event_admins.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
    )
  );

-- Event admin invites (pending; user must accept to become event admin)
CREATE TABLE event_admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_admin_invites_event ON event_admin_invites(event_id);
CREATE INDEX idx_event_admin_invites_user ON event_admin_invites(user_id);

ALTER TABLE event_admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event admin invites viewable by invitee or event managers"
  ON event_admin_invites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
      WHERE e.id = event_admin_invites.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
    )
    OR EXISTS (SELECT 1 FROM event_admins ea WHERE ea.event_id = event_admin_invites.event_id AND ea.user_id = auth.uid())
  );

CREATE POLICY "Event managers can insert event admin invites"
  ON event_admin_invites FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM events e
        JOIN groups g ON g.id = e.host_group_id
        LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
        WHERE e.id = event_admin_invites.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
      )
      OR EXISTS (SELECT 1 FROM event_admins ea WHERE ea.event_id = event_admin_invites.event_id AND ea.user_id = auth.uid())
    )
  );

CREATE POLICY "Event managers or invitee can delete event admin invites"
  ON event_admin_invites FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
      WHERE e.id = event_admin_invites.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
    )
    OR EXISTS (SELECT 1 FROM event_admins ea WHERE ea.event_id = event_admin_invites.event_id AND ea.user_id = auth.uid())
  );

-- =============================================================================
-- Event invites (pending invites by email)
-- =============================================================================

CREATE TABLE event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_event_invites_event ON event_invites(event_id);
CREATE INDEX idx_event_invites_email ON event_invites(email);

ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event managers can view event invites"
  ON event_invites FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
      WHERE e.id = event_invites.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
    )
    OR EXISTS (SELECT 1 FROM event_admins ea WHERE ea.event_id = event_invites.event_id AND ea.user_id = auth.uid())
  );

CREATE POLICY "Event managers can insert event invites"
  ON event_invites FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM events e
        JOIN groups g ON g.id = e.host_group_id
        LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
        WHERE e.id = event_invites.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
      )
      OR EXISTS (SELECT 1 FROM event_admins ea WHERE ea.event_id = event_invites.event_id AND ea.user_id = auth.uid())
    )
  );

CREATE POLICY "Event managers can delete event invites"
  ON event_invites FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN groups g ON g.id = e.host_group_id
      LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = auth.uid()
      WHERE e.id = event_invites.event_id AND (g.organizer_id = auth.uid() OR ga.id IS NOT NULL)
    )
    OR EXISTS (SELECT 1 FROM event_admins ea WHERE ea.event_id = event_invites.event_id AND ea.user_id = auth.uid())
  );
