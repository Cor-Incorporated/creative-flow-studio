#!/bin/bash
# Set ENTERPRISE plan Price ID in Cloud SQL
# Usage: ./scripts/set-enterprise-price-id.sh

set -e

# Get DATABASE_URL from Secret Manager
DATABASE_URL=$(gcloud secrets versions access latest --secret=database-url --project=dataanalyticsclinic)

# Update ENTERPRISE plan Price ID
psql "$DATABASE_URL" <<EOF
-- Update ENTERPRISE plan Price ID
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

-- Verify update
SELECT id, name, "stripePriceId", "monthlyPrice", "updatedAt"
FROM "plans"
WHERE name = 'ENTERPRISE';
EOF

echo "✅ ENTERPRISE plan Price ID has been updated to: price_1SUPIgLi6CKW3pRawbELPocW"

