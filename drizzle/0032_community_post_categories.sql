ALTER TABLE community_messages
  ADD COLUMN category ENUM(
    'announcement',
    'question',
    'farming_tip',
    'marketplace_update',
    'general_discussion'
  ) NOT NULL DEFAULT 'general_discussion' AFTER author_id;

CREATE INDEX community_messages_category_created_idx
  ON community_messages (category, created_at);
