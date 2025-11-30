BEGIN;

-- Clean existing data
DELETE FROM "usage_logs";
DELETE FROM "audit_logs";
DELETE FROM "payment_events";
DELETE FROM "messages";
DELETE FROM "conversations";
DELETE FROM "sessions";
DELETE FROM "accounts";
DELETE FROM "subscriptions";
DELETE FROM "users";
DELETE FROM "plans";
DELETE FROM "verification_tokens";

-- Plans
-- Features JSON structure matches PlanFeaturesSchema in lib/validators.ts
-- IMPORTANT: Replace stripePriceId with actual Stripe Price IDs from your Stripe Dashboard
-- For production: Use live mode Price IDs (e.g., 'price_xxxxx')
-- For testing: Use test mode Price IDs (e.g., 'price_test_xxxxx')
-- See docs/stripe-integration-plan.md for setup instructions
INSERT INTO "plans" (id, name, "stripePriceId", "monthlyPrice", features, "maxRequestsPerMonth", "maxFileSize", "createdAt", "updatedAt")
VALUES
    ('plan_free', 'FREE', NULL, 0, 
     '{"allowProMode":false,"allowImageGeneration":false,"allowVideoGeneration":false,"allowSearchMode":true,"maxRequestsPerMonth":100,"maxFileSize":5242880,"maxConcurrentRequests":3,"prioritySupport":false,"customBranding":false}'::jsonb, 
     100, 5242880, NOW(), NOW()),
    ('plan_pro', 'PRO', 'price_CHANGE_ME_PRO', 2000, 
     '{"allowProMode":true,"allowImageGeneration":true,"allowVideoGeneration":false,"allowSearchMode":true,"maxRequestsPerMonth":1000,"maxFileSize":52428800,"maxConcurrentRequests":5,"prioritySupport":false,"customBranding":false}'::jsonb, 
     1000, 52428800, NOW(), NOW()),
    ('plan_enterprise', 'ENTERPRISE', 'price_CHANGE_ME_ENTERPRISE', 5000, 
     '{"allowProMode":true,"allowImageGeneration":true,"allowVideoGeneration":true,"allowSearchMode":true,"maxRequestsPerMonth":null,"maxFileSize":104857600,"maxConcurrentRequests":10,"prioritySupport":true,"customBranding":true}'::jsonb, 
     NULL, 104857600, NOW(), NOW());

-- Users
INSERT INTO "users" (id, email, name, role, "createdAt", "updatedAt")
VALUES
    ('user_admin', 'admin@test.example', 'Admin User', 'ADMIN', NOW(), NOW()),
    ('user_free', 'free@test.example', 'Free User', 'USER', NOW(), NOW()),
    ('user_pro', 'pro@test.example', 'Pro User', 'PRO', NOW(), NOW()),
    ('user_enterprise', 'enterprise@test.example', 'Enterprise User', 'ENTERPRISE', NOW(), NOW());

-- Subscriptions
INSERT INTO "subscriptions" (id, "userId", "planId", "stripeCustomerId", "stripeSubscriptionId", status, "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "createdAt", "updatedAt")
VALUES
    ('sub_admin', 'user_admin', 'plan_enterprise', 'cus_admin', 'sub_admin', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', false, NOW(), NOW()),
    ('sub_free', 'user_free', 'plan_free', 'cus_free', 'sub_free', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', false, NOW(), NOW()),
    ('sub_pro', 'user_pro', 'plan_pro', 'cus_pro', 'sub_pro', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', false, NOW(), NOW()),
    ('sub_enterprise', 'user_enterprise', 'plan_enterprise', 'cus_enterprise', 'sub_enterprise', 'ACTIVE', NOW(), NOW() + INTERVAL '30 days', false, NOW(), NOW());

-- Sessions (stable tokens for manual testing)
INSERT INTO "sessions" (id, "sessionToken", "userId", expires)
VALUES
    ('sess_admin', 'session-token-admin', 'user_admin', NOW() + INTERVAL '30 days'),
    ('sess_free', 'session-token-free', 'user_free', NOW() + INTERVAL '30 days'),
    ('sess_pro', 'session-token-pro', 'user_pro', NOW() + INTERVAL '30 days'),
    ('sess_enterprise', 'session-token-enterprise', 'user_enterprise', NOW() + INTERVAL '30 days');

-- Usage logs to simulate activity
INSERT INTO "usage_logs" (id, "userId", action, "resourceType", metadata, "createdAt")
VALUES
    ('usage_free_1', 'user_free', 'chat', 'gemini-2.5-flash', '{"prompt":"Hello"}'::jsonb, NOW() - INTERVAL '5 days'),
    ('usage_free_2', 'user_free', 'chat', 'gemini-2.5-flash', '{"prompt":"Another"}'::jsonb, NOW() - INTERVAL '2 days'),
    ('usage_pro_1', 'user_pro', 'image_generation', 'imagen-4.0', '{"prompt":"Landscape"}'::jsonb, NOW() - INTERVAL '3 days'),
    ('usage_enterprise_1', 'user_enterprise', 'video_generation', 'veo-3.1-fast', '{"prompt":"Product demo"}'::jsonb, NOW() - INTERVAL '1 day');

COMMIT;
