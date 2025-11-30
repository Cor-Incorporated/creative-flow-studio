-- Delete all users except company@cor-jp.com and kotaro.uchiho@gmail.com
-- CASCADE will also delete related sessions, conversations, messages, subscriptions, etc.

BEGIN;

-- Get list of users to delete (for logging)
SELECT email FROM "users" 
WHERE email NOT IN ('company@cor-jp.com', 'kotaro.uchiho@gmail.com');

-- Delete users (cascade will handle related records)
DELETE FROM "users" 
WHERE email NOT IN ('company@cor-jp.com', 'kotaro.uchiho@gmail.com');

COMMIT;
