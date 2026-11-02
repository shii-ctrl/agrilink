ALTER TABLE community_messages
  ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE AFTER category,
  ADD COLUMN pinned_at DATETIME NULL AFTER is_pinned,
  ADD COLUMN pinned_by_id VARCHAR(36) NULL AFTER pinned_at;

CREATE INDEX community_messages_pinned_created_idx
  ON community_messages (is_pinned, pinned_at, created_at);
