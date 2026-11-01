-- Production Records has been retired from AgriLink. Remove only data and
-- history owned by that feature, then remove its standalone table.
DELETE FROM notifications
WHERE target = '/farmer/production'
   OR title = 'Production record updated';

DELETE FROM audit_logs
WHERE entity_type = 'production_record'
   OR action LIKE 'production.%';

DROP TABLE IF EXISTS production_records;
