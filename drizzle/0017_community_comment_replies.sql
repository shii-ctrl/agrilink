-- Replies stay attached to their parent Community comment and can be folded in the feed.
ALTER TABLE community_comments
  ADD COLUMN parent_comment_id VARCHAR(36) NULL AFTER message_id,
  ADD CONSTRAINT fk_community_comment_parent
    FOREIGN KEY (parent_comment_id) REFERENCES community_comments(id) ON DELETE SET NULL,
  ADD KEY community_comments_parent_created_idx (parent_comment_id, created_at);
