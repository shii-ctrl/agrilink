-- Retire the Farm Consultant workspace and remove its connected records.
-- This migration intentionally preserves Farmers and every non-consultant account.

DROP TEMPORARY TABLE IF EXISTS removed_consultant_users;
CREATE TEMPORARY TABLE removed_consultant_users (
  id VARCHAR(36) PRIMARY KEY
);

INSERT IGNORE INTO removed_consultant_users (id)
SELECT user_roles.user_id
FROM user_roles
INNER JOIN roles ON roles.id = user_roles.role_id
WHERE roles.name IN ('Farm Consultant', 'Consultant');

-- A guidance assignment represents the retired feature, so it is removed as a whole.
DROP TABLE IF EXISTS farmer_consultant_assignments;

-- Remove guidance conversations before dropping their retired table.
DROP TABLE IF EXISTS guidance_messages;

-- Remove Community content and reactions created by retired accounts.
DELETE community_comment_reactions
FROM community_comment_reactions
INNER JOIN community_comments
  ON community_comments.id = community_comment_reactions.comment_id
WHERE community_comments.author_id IN (SELECT id FROM removed_consultant_users)
   OR community_comments.message_id IN (
     SELECT id FROM community_messages WHERE author_id IN (SELECT id FROM removed_consultant_users)
   );

DELETE FROM community_comment_reactions
WHERE user_id IN (SELECT id FROM removed_consultant_users);

DELETE FROM community_comments
WHERE author_id IN (SELECT id FROM removed_consultant_users)
   OR message_id IN (
     SELECT id FROM community_messages WHERE author_id IN (SELECT id FROM removed_consultant_users)
   );

DELETE FROM community_reactions
WHERE user_id IN (SELECT id FROM removed_consultant_users)
   OR message_id IN (
     SELECT id FROM community_messages WHERE author_id IN (SELECT id FROM removed_consultant_users)
   );

DELETE FROM community_messages
WHERE author_id IN (SELECT id FROM removed_consultant_users);

-- Remove private conversations, alerts, access tokens, drafts, and audit records.
DELETE FROM direct_messages
WHERE sender_id IN (SELECT id FROM removed_consultant_users)
   OR recipient_id IN (SELECT id FROM removed_consultant_users);

-- A Consultant cannot normally become a buyer, but remove any legacy cart or
-- order records first so an old mixed-role account cannot block account removal.
DELETE cart_items
FROM cart_items
INNER JOIN carts ON carts.id = cart_items.cart_id
WHERE carts.buyer_id IN (SELECT id FROM removed_consultant_users);

DELETE FROM carts WHERE buyer_id IN (SELECT id FROM removed_consultant_users);

DELETE payments
FROM payments
INNER JOIN orders ON orders.id = payments.order_id
WHERE orders.buyer_id IN (SELECT id FROM removed_consultant_users);

DELETE order_status_history
FROM order_status_history
INNER JOIN orders ON orders.id = order_status_history.order_id
WHERE orders.buyer_id IN (SELECT id FROM removed_consultant_users);

DELETE order_items
FROM order_items
INNER JOIN orders ON orders.id = order_items.order_id
WHERE orders.buyer_id IN (SELECT id FROM removed_consultant_users);

DELETE FROM orders WHERE buyer_id IN (SELECT id FROM removed_consultant_users);

DELETE FROM notifications
WHERE user_id IN (SELECT id FROM removed_consultant_users)
   OR target LIKE '/consultant/%'
   OR title LIKE '%guidance%'
   OR message LIKE '%guidance%';

DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM saved_drafts WHERE user_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM audit_logs
WHERE actor_id IN (SELECT id FROM removed_consultant_users)
   OR (entity_type = 'user' AND entity_id IN (SELECT id FROM removed_consultant_users));

-- These references are normally unavailable to Consultants, but clearing them
-- keeps the account removal safe even if an older record exists.
DELETE FROM inventory_movements WHERE recorded_by_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM order_status_history WHERE changed_by_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM payments WHERE recorded_by_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM daily_prices WHERE created_by_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM production_records WHERE recorded_by_id IN (SELECT id FROM removed_consultant_users);

DELETE receiving_classifications
FROM receiving_classifications
INNER JOIN receiving_records ON receiving_records.id = receiving_classifications.receiving_id
WHERE receiving_records.recorded_by_id IN (SELECT id FROM removed_consultant_users);

DELETE FROM receiving_records WHERE recorded_by_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM removed_consultant_users);
DELETE FROM users WHERE id IN (SELECT id FROM removed_consultant_users);
DELETE FROM roles WHERE name IN ('Farm Consultant', 'Consultant');

DROP TEMPORARY TABLE removed_consultant_users;
