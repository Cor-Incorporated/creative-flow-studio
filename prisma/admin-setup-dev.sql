-- Admin User Setup Script for Dev Environment
-- This script sets company@cor-jp.com and kotaro.uchiho@gmail.com as ADMIN users
-- Run this with: psql $DATABASE_URL -f prisma/admin-setup-dev.sql

-- Update company@cor-jp.com to ADMIN role
UPDATE "users"
SET role = 'ADMIN', "updatedAt" = NOW()
WHERE email = 'company@cor-jp.com';

-- Update kotaro.uchiho@gmail.com to ADMIN role
UPDATE "users"
SET role = 'ADMIN', "updatedAt" = NOW()
WHERE email = 'kotaro.uchiho@gmail.com';

-- Verify the updates
SELECT id, email, name, role, "createdAt", "updatedAt"
FROM "users"
WHERE email IN ('company@cor-jp.com', 'kotaro.uchiho@gmail.com')
ORDER BY email;
