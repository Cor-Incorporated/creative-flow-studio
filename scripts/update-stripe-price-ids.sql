-- Update Stripe Price IDs in Plan table
-- Usage: 
--   1. Replace 'price_test_xxxxx' with actual Stripe Price IDs from Stripe Dashboard
--   2. psql $DATABASE_URL -f scripts/update-stripe-price-ids.sql

-- 1. Check current Price IDs
SELECT id, name, "stripePriceId", "monthlyPrice"
FROM "plans"
ORDER BY name;

-- 2. Update PRO plan Price ID
-- TODO: Stripe Dashboard で PRO プラン用の Price ID を作成後、ここに設定してください
-- UPDATE "plans"
-- SET "stripePriceId" = 'price_test_YOUR_PRO_PRICE_ID',
--     "updatedAt" = NOW()
-- WHERE name = 'PRO';

-- 3. Update ENTERPRISE plan Price ID
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

-- 4. Verify updates
SELECT id, name, "stripePriceId", "monthlyPrice", "updatedAt"
FROM "plans"
WHERE name IN ('PRO', 'ENTERPRISE')
ORDER BY name;

-- Expected result:
-- PRO: stripePriceId should be your test Price ID (e.g., 'price_test_xxxxx')
-- ENTERPRISE: stripePriceId should be your test Price ID (e.g., 'price_test_yyyyy')

