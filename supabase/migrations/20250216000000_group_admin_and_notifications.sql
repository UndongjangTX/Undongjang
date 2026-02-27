-- =============================================================================
-- Group admins (owner + assigned admins), join requests, transfer/admin invites, notifications
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Group admins (assigned by owner; owner is groups.organizer_id)
-- -----------------------------------------------------------------------------
CREATE TABLE group_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_admins_group ON group_admins(group_id);
CREATE INDEX idx_group_admins_user ON group_admins(user_id);

COMMENT ON TABLE group_admins IS 'Users assigned as admins by the group owner (organizer). Owner is not in this table.';

-- -----------------------------------------------------------------------------
-- Group join requests (for private groups: user requests to join, owner/admin accepts)
-- -----------------------------------------------------------------------------
CREATE TABLE group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_join_requests_group ON group_join_requests(group_id);
CREATE INDEX idx_group_join_requests_user ON group_join_requests(user_id);

COMMENT ON TABLE group_join_requests IS 'Join requests for private groups; owner/admin accept or reject.';

-- -----------------------------------------------------------------------------
-- Ownership transfer: current owner requests transfer to another user; they must accept
-- -----------------------------------------------------------------------------
CREATE TABLE group_ownership_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id)
);

CREATE INDEX idx_ownership_transfer_group ON group_ownership_transfer_requests(group_id);
CREATE INDEX idx_ownership_transfer_to ON group_ownership_transfer_requests(to_user_id);

COMMENT ON TABLE group_ownership_transfer_requests IS 'Pending ownership transfer; to_user_id must accept.';

-- -----------------------------------------------------------------------------
-- Admin invites: owner invites user to become admin; they must accept
-- -----------------------------------------------------------------------------
CREATE TABLE group_admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_admin_invites_group ON group_admin_invites(group_id);
CREATE INDEX idx_group_admin_invites_user ON group_admin_invites(user_id);

COMMENT ON TABLE group_admin_invites IS 'Pending admin assignment; user must accept to become admin.';

-- -----------------------------------------------------------------------------
-- Notifications (popup on login: new member request, ownership transfer, admin invite)
-- -----------------------------------------------------------------------------
CREATE TYPE notification_type AS ENUM (
  'new_member_request',
  'ownership_transfer_request',
  'admin_invite'
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

COMMENT ON TABLE notifications IS 'In-app notifications for owners/admins (member request, transfer, admin invite).';

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE group_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_ownership_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Group admins: readable by group members; insert/delete by owner only
CREATE POLICY "Group admins readable by group members"
  ON group_admins FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = group_admins.group_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Group owner can manage admins"
  ON group_admins FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_admins.group_id AND g.organizer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_admins.group_id AND g.organizer_id = auth.uid())
  );

-- Join requests: readable by owner/admins; insert by user (request to join); update by owner/admin (accept/reject)
CREATE POLICY "Join requests readable by owner and admins"
  ON group_join_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_join_requests.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can request to join (insert)"
  ON group_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner and admins can update join requests"
  ON group_join_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_join_requests.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

-- Ownership transfer: readable by from/to; insert by owner; update/delete by owner or to_user
CREATE POLICY "Ownership transfer readable by parties"
  ON group_ownership_transfer_requests FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Owner can create transfer request"
  ON group_ownership_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.organizer_id = auth.uid())
    AND from_user_id = auth.uid()
  );

CREATE POLICY "Owner or to_user can update transfer request"
  ON group_ownership_transfer_requests FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Owner or to_user can delete transfer request"
  ON group_ownership_transfer_requests FOR DELETE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Admin invites: readable by invitee and owner; insert by owner; update/delete by owner or invitee
CREATE POLICY "Admin invites readable by invitee and owner"
  ON group_admin_invites FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_admin_invites.group_id AND g.organizer_id = auth.uid())
  );

CREATE POLICY "Owner can create admin invite"
  ON group_admin_invites FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.organizer_id = auth.uid())
    AND invited_by = auth.uid()
  );

CREATE POLICY "Owner or invitee can update admin invite"
  ON group_admin_invites FOR UPDATE TO authenticated
  USING (invited_by = auth.uid() OR user_id = auth.uid())
  WITH CHECK (invited_by = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Owner or invitee can delete admin invite"
  ON group_admin_invites FOR DELETE TO authenticated
  USING (invited_by = auth.uid() OR user_id = auth.uid());

-- Notifications: own only
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications (mark read)"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications: only owner/admins can insert (for transfer and admin invite); join-request notifications via trigger
CREATE POLICY "Owner and admins can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = notifications.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

-- Trigger: when a join request is created, notify group owner and all admins
CREATE OR REPLACE FUNCTION notify_group_admins_new_join_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT g.organizer_id AS uid FROM groups g WHERE g.id = NEW.group_id AND g.organizer_id IS NOT NULL
    UNION
    SELECT a.user_id AS uid FROM group_admins a WHERE a.group_id = NEW.group_id
  LOOP
    INSERT INTO notifications (user_id, type, group_id, related_id)
    VALUES (rec.uid, 'new_member_request', NEW.group_id, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_join_request_created
  AFTER INSERT ON group_join_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_group_admins_new_join_request();

-- Trigger: when ownership transfer is created, notify to_user
CREATE OR REPLACE FUNCTION notify_ownership_transfer_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, group_id, related_id)
  VALUES (NEW.to_user_id, 'ownership_transfer_request', NEW.group_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ownership_transfer_created
  AFTER INSERT ON group_ownership_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_ownership_transfer_target();

-- Trigger: when admin invite is created, notify invitee
CREATE OR REPLACE FUNCTION notify_admin_invite_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, group_id, related_id)
  VALUES (NEW.user_id, 'admin_invite', NEW.group_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_admin_invite_created
  AFTER INSERT ON group_admin_invites
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_invite_target();

-- Group photos: allow owner and admins to insert/delete
-- Owner and admins can add members (invite by email)
-- Events: allow group admins (not just organizer) to update events of their group
DROP POLICY IF EXISTS "Authenticated users can update events of their groups" ON events;
CREATE POLICY "Owner and admins can update group events"
  ON events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = events.host_group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

CREATE POLICY "Group owner and admins can add members"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_members.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

-- Owner and admins can remove members (kick)
CREATE POLICY "Group owner and admins can remove members"
  ON group_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_members.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

CREATE POLICY "Group owner and admins can insert group photos"
  ON group_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_photos.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

CREATE POLICY "Group owner and admins can delete group photos"
  ON group_photos FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_photos.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );

CREATE POLICY "Group owner and admins can update group photos"
  ON group_photos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = auth.uid()
      WHERE g.id = group_photos.group_id AND (g.organizer_id = auth.uid() OR a.id IS NOT NULL)
    )
  );
