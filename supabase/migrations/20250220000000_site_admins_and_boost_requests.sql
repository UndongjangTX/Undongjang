-- =============================================================================
-- Site admins (who can access the site admin dashboard)
-- =============================================================================

CREATE TABLE site_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_site_admins_user ON site_admins(user_id);

COMMENT ON TABLE site_admins IS 'Users who can access the site admin dashboard. Add user_id to grant access.';

ALTER TABLE site_admins ENABLE ROW LEVEL SECURITY;

-- Only existing site admins can read the list (for "am I admin?" check via service or trusted path)
CREATE POLICY "Site admins can read site_admins"
  ON site_admins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/DELETE for authenticated by default; use service role or a secure backend to manage.

-- =============================================================================
-- Boost requests (group/event admins request boosting; site admins approve)
-- =============================================================================

CREATE TYPE boost_request_type AS ENUM ('group', 'event');
CREATE TYPE boost_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE boost_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type boost_request_type NOT NULL,
  entity_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boost_end_date date,
  status boost_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_boost_requests_status ON boost_requests(status);
CREATE INDEX idx_boost_requests_created ON boost_requests(created_at DESC);

COMMENT ON TABLE boost_requests IS 'Requests from group/event admins to boost their group or event. Site admins approve or reject.';
COMMENT ON COLUMN boost_requests.boost_end_date IS 'Requested end date for the boost (optional).';

ALTER TABLE boost_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can insert their own (and read own); site admins will read via API with service or admin check
CREATE POLICY "Users can create boost requests"
  ON boost_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Users can read own boost requests"
  ON boost_requests FOR SELECT TO authenticated
  USING (auth.uid() = requested_by);

-- Site admins can read all boost requests and update status
CREATE POLICY "Site admins can read all boost requests"
  ON boost_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid())
  );

CREATE POLICY "Site admins can update boost requests"
  ON boost_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid())
  );

-- =============================================================================
-- Site admins: allow boost and delete for groups and events
-- =============================================================================

CREATE POLICY "Site admins can update groups (boost)"
  ON groups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Site admins can delete groups"
  ON groups FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Site admins can update events (boost)"
  ON events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Site admins can delete events"
  ON events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Site admins can insert events (special events)"
  ON events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

-- Site admins can read all users (for user management list)
CREATE POLICY "Site admins can read all users"
  ON users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));
