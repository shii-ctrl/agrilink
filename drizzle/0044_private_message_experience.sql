-- Delivery/read feedback and short-lived typing presence for role-protected private chat.
-- Existing messages remain intact and are treated as sent until the recipient opens chat.
ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS delivered_at DATETIME NULL AFTER message;

CREATE INDEX IF NOT EXISTS direct_messages_recipient_delivered_idx
  ON direct_messages (recipient_id, delivered_at, created_at);

CREATE TABLE IF NOT EXISTS direct_message_typing (
  user_id VARCHAR(36) NOT NULL,
  participant_id VARCHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, participant_id),
  KEY direct_message_typing_participant_expiry_idx (participant_id, expires_at),
  CONSTRAINT fk_direct_message_typing_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_direct_message_typing_participant
    FOREIGN KEY (participant_id) REFERENCES users(id) ON DELETE CASCADE
);
