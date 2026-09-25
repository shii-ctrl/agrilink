-- Normalize the role name without losing users assigned to the legacy role.
INSERT IGNORE INTO roles (name) VALUES ('Farm Consultant');

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT legacy_user_roles.user_id, target_role.id
FROM user_roles AS legacy_user_roles
INNER JOIN roles AS legacy_role ON legacy_role.id = legacy_user_roles.role_id
INNER JOIN roles AS target_role ON target_role.name = 'Farm Consultant'
WHERE legacy_role.name = 'Consultant';

DELETE legacy_user_roles
FROM user_roles AS legacy_user_roles
INNER JOIN roles AS legacy_role ON legacy_role.id = legacy_user_roles.role_id
INNER JOIN user_roles AS target_user_role
  ON target_user_role.user_id = legacy_user_roles.user_id
INNER JOIN roles AS target_role
  ON target_role.id = target_user_role.role_id AND target_role.name = 'Farm Consultant'
WHERE legacy_role.name = 'Consultant';

DELETE FROM roles WHERE name = 'Consultant';
