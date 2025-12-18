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
-- Pricing based on Google Gemini API costs (2024-2025):
-- - Gemini 2.5 Flash: $0.30/1M input, $2.50/1M output tokens
-- - Gemini 2.5 Pro: $1.25/1M input, $10/1M output tokens
-- - Imagen 4 Standard: $0.04/image
-- - Veo 3.1 Fast: $0.15/second (~$1.20 for 8s video)
-- - Google Search Grounding: $35/1,000 prompts
INSERT INTO "plans" (id, name, "stripePriceId", "monthlyPrice", features, "maxRequestsPerMonth", "maxFileSize", "createdAt", "updatedAt")
VALUES
    ('plan_free', 'FREE', NULL, 0,
     '{"allowProMode":false,"allowImageGeneration":false,"allowVideoGeneration":false,"allowSearchMode":true,"maxRequestsPerMonth":50,"maxFileSize":5242880,"maxConcurrentRequests":1,"prioritySupport":false,"customBranding":false,"maxVideoGenerationsPerMonth":0}'::jsonb,
     50, 5242880, NOW(), NOW()),
    ('plan_pro', 'PRO', 'price_CHANGE_ME_PRO', 300000,
     '{"allowProMode":true,"allowImageGeneration":true,"allowVideoGeneration":false,"allowSearchMode":true,"maxRequestsPerMonth":500,"maxFileSize":52428800,"maxConcurrentRequests":5,"prioritySupport":true,"customBranding":false,"maxVideoGenerationsPerMonth":0}'::jsonb,
     500, 52428800, NOW(), NOW()),
    ('plan_enterprise', 'ENTERPRISE', 'price_CHANGE_ME_ENTERPRISE', 3000000,
     '{"allowProMode":true,"allowImageGeneration":true,"allowVideoGeneration":true,"allowSearchMode":true,"maxRequestsPerMonth":3000,"maxFileSize":524288000,"maxConcurrentRequests":10,"prioritySupport":true,"customBranding":true,"maxVideoGenerationsPerMonth":50}'::jsonb,
     3000, 524288000, NOW(), NOW());

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
