-- Grant ADMIN role to a user
-- Usage: psql $DATABASE_URL -f scripts/grant-admin-role.sql
-- Or: Replace 'your-admin-user@example.com' with actual email and run

-- 1. Check current role
SELECT id, email, role, "createdAt"
FROM "users"
WHERE email = 'your-admin-user@example.com';

-- 2. Update role to ADMIN
UPDATE "users"
SET role = 'ADMIN',
    "updatedAt" = NOW()
WHERE email = 'your-admin-user@example.com';

-- 3. Verify update
SELECT id, email, role, "updatedAt"
FROM "users"
WHERE email = 'your-admin-user@example.com';

-- Expected result:
-- role should be 'ADMIN'


