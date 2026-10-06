-- Profile images are optional external URLs. AgriLink never stores uploaded image files itself.
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER contact;
