ALTER TABLE users
  ADD COLUMN avatar_visibility VARCHAR(32) NOT NULL DEFAULT 'everyone' AFTER avatar_url;
