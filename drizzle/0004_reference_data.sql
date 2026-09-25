-- Required reference data only. These values contain no accounts or business activity.
INSERT IGNORE INTO roles (name) VALUES
  ('Management'),
  ('Marketer'),
  ('Accounting'),
  ('Buyer'),
  ('Farmer'),
  ('Farm Consultant');

INSERT IGNORE INTO classifications (name) VALUES ('Good'), ('Semi'), ('Reject');
