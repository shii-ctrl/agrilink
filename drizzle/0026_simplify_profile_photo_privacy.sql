UPDATE users
SET avatar_visibility = 'everyone'
WHERE avatar_visibility NOT IN ('everyone', 'hidden');
