-- =============================================================================
-- Track when a user last read a conversation (for unread badges)
-- =============================================================================

CREATE TABLE conversation_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

CREATE INDEX idx_conversation_reads_user ON conversation_reads(user_id);

COMMENT ON TABLE conversation_reads IS 'When a user last read a conversation; used for unread message badges.';

ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversation_reads"
  ON conversation_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversation_reads"
  ON conversation_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversation_reads"
  ON conversation_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
