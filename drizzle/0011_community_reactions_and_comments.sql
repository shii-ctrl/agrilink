-- Facebook-style community interactions. A user can hold one reaction per post
-- and can add saved comments to any post they are permitted to read.
CREATE TABLE IF NOT EXISTS community_reactions (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  reaction ENUM('like', 'dislike') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_reaction_message FOREIGN KEY (message_id) REFERENCES community_messages(id),
  CONSTRAINT fk_community_reaction_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY community_reactions_message_user_unique (message_id, user_id),
  KEY community_reactions_message_idx (message_id),
  KEY community_reactions_user_idx (user_id)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id VARCHAR(36) PRIMARY KEY,
  message_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_community_comment_message FOREIGN KEY (message_id) REFERENCES community_messages(id),
  CONSTRAINT fk_community_comment_author FOREIGN KEY (author_id) REFERENCES users(id),
  KEY community_comments_message_created_idx (message_id, created_at),
  KEY community_comments_author_idx (author_id)
);
