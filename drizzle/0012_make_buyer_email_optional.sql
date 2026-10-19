-- Buyer accounts use a unique username and may be created without personal contact details.
-- Existing internal accounts retain their email addresses and the unique email index.
ALTER TABLE users MODIFY email VARCHAR(255) NULL;
