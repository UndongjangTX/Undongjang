-- =============================================================================
-- Messenger: conversations (member <-> group/event organizers) and messages
-- =============================================================================
-- Conversations are created when a user clicks "Message organizer" on a group
-- or event. One conversation per (group, member) or (event, member).
-- Organizers (group owner + admins, or event admins + host group owner) can
-- view and reply; they cannot start new chats (only reply to incoming).
-- =============================================================================

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT conversations_entity_check CHECK (
    (group_id IS NOT NULL AND event_id IS NULL) OR (group_id IS NULL AND event_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_conversations_group_member
  ON conversations (group_id, member_user_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX idx_conversations_event_member
  ON conversations (event_id, member_user_id) WHERE event_id IS NOT NULL;

CREATE INDEX idx_conversations_group ON conversations(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_conversations_event ON conversations(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_conversations_member ON conversations(member_user_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

COMMENT ON TABLE conversations IS 'Chat thread between a member and group/event organizers. Created via "Message organizer" on group/event page.';

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(conversation_id, created_at);

COMMENT ON TABLE messages IS 'Messages in a conversation. Sender is either the member or an organizer.';

-- Update conversation.updated_at when a message is inserted
CREATE OR REPLACE FUNCTION conversations_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION conversations_touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Helper: user is organizer for a group (owner or group_admin)
CREATE OR REPLACE FUNCTION is_group_organizer(gid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups g
    LEFT JOIN group_admins a ON a.group_id = g.id AND a.user_id = is_group_organizer.uid
    WHERE g.id = is_group_organizer.gid AND (g.organizer_id = is_group_organizer.uid OR a.id IS NOT NULL)
  );
$$;

-- Helper: user is organizer for an event (event_admin or host group owner/admin)
CREATE OR REPLACE FUNCTION is_event_organizer(eid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_admins ea WHERE ea.event_id = is_event_organizer.eid AND ea.user_id = is_event_organizer.uid
  )
  OR EXISTS (
    SELECT 1 FROM events e
    JOIN groups g ON g.id = e.host_group_id
    LEFT JOIN group_admins ga ON ga.group_id = g.id AND ga.user_id = is_event_organizer.uid
    WHERE e.id = is_event_organizer.eid AND (g.organizer_id = is_event_organizer.uid OR ga.id IS NOT NULL)
  );
$$;

-- Conversations: member can see own; organizers can see conversations for their group/event
CREATE POLICY "Conversations visible to member or organizers"
  ON conversations FOR SELECT TO authenticated
  USING (
    member_user_id = auth.uid()
    OR (group_id IS NOT NULL AND is_group_organizer(group_id, auth.uid()))
    OR (event_id IS NOT NULL AND is_event_organizer(event_id, auth.uid()))
  );

-- Only the member can create a conversation (via "Message organizer")
CREATE POLICY "Member can create conversation"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (member_user_id = auth.uid());

-- No update/delete of conversations for now (optional later)

-- Messages: same visibility as conversation
CREATE POLICY "Messages visible to conversation participants"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.member_user_id = auth.uid()
        OR (c.group_id IS NOT NULL AND is_group_organizer(c.group_id, auth.uid()))
        OR (c.event_id IS NOT NULL AND is_event_organizer(c.event_id, auth.uid()))
      )
    )
  );

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.member_user_id = auth.uid()
        OR (c.group_id IS NOT NULL AND is_group_organizer(c.group_id, auth.uid()))
        OR (c.event_id IS NOT NULL AND is_event_organizer(c.event_id, auth.uid()))
      )
    )
  );
