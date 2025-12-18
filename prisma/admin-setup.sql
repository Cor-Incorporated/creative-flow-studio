-- Admin User Setup Script
-- This script sets company@cor-jp.com as ADMIN user
-- Run this with: psql $DATABASE_URL -f prisma/admin-setup.sql

-- Update company@cor-jp.com to ADMIN role
UPDATE "users"
SET role = 'ADMIN', "updatedAt" = NOW()
WHERE email = 'company@cor-jp.com';

-- Verify the update
SELECT id, email, name, role, "createdAt", "updatedAt"
FROM "users"
WHERE email = 'company@cor-jp.com';





