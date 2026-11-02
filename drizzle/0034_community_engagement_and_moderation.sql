ALTER TABLE community_messages
  ADD COLUMN question_status ENUM('open', 'answered', 'resolved') NOT NULL DEFAULT 'open' AFTER pinned_by_id,
  ADD COLUMN helpful_comment_id VARCHAR(36) NULL AFTER question_status,
  ADD COLUMN moderation_status ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible' AFTER helpful_comment_id,
  ADD COLUMN moderated_at DATETIME NULL AFTER moderation_status,
  ADD COLUMN moderated_by_id VARCHAR(36) NULL AFTER moderated_at,
  ADD COLUMN moderation_reason VARCHAR(500) NULL AFTER moderated_by_id;

CREATE TABLE community_attachments (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  image_url MEDIUMTEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX community_attachments_message_position_idx (message_id, position)
);

CREATE TABLE community_bookmarks (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX community_bookmarks_message_user_unique (message_id, user_id),
  INDEX community_bookmarks_user_created_idx (user_id, created_at)
);

CREATE TABLE community_reports (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  reporter_id VARCHAR(36) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending', 'reviewed', 'dismissed', 'removed') NOT NULL DEFAULT 'pending',
  reviewed_by_id VARCHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX community_reports_message_reporter_unique (message_id, reporter_id),
  INDEX community_reports_status_created_idx (status, created_at)
);
