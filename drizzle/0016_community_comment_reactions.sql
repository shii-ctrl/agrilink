-- Each user can save one Like or Dislike on a Community comment.
CREATE TABLE IF NOT EXISTS community_comment_reactions (
  id VARCHAR(36) PRIMARY KEY,
  comment_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  reaction ENUM('like', 'dislike') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_comment_reaction_comment
    FOREIGN KEY (comment_id) REFERENCES community_comments(id),
  CONSTRAINT fk_community_comment_reaction_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY community_comment_reactions_comment_user_unique (comment_id, user_id),
  KEY community_comment_reactions_comment_idx (comment_id),
  KEY community_comment_reactions_user_idx (user_id)
);
