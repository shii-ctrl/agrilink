-- Private role-based conversations. The application restricts who can start a
-- conversation; these foreign keys preserve the user records behind every message.
CREATE TABLE IF NOT EXISTS direct_messages (
  id VARCHAR(36) PRIMARY KEY,
  sender_id VARCHAR(36) NOT NULL,
  recipient_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_direct_message_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  CONSTRAINT fk_direct_message_recipient FOREIGN KEY (recipient_id) REFERENCES users(id),
  KEY direct_messages_sender_recipient_created_idx (sender_id, recipient_id, created_at),
  KEY direct_messages_recipient_read_idx (recipient_id, read_at)
);
