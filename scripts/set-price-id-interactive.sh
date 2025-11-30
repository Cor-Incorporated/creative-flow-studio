#!/bin/bash
# Interactive script to set ENTERPRISE plan Price ID
# Usage: ./scripts/set-price-id-interactive.sh

set -e

echo "🔍 Checking Cloud SQL Proxy status..."

# Check if Cloud SQL Proxy is running
PROXY_RUNNING=false
if lsof -i :5432 2>/dev/null | grep -q cloud-sql-proxy; then
    PROXY_RUNNING=true
elif ps aux | grep -v grep | grep -q "cloud-sql-proxy.*creative-flow-studio-sql"; then
    PROXY_RUNNING=true
fi

if [ "$PROXY_RUNNING" = false ]; then
    echo "❌ Cloud SQL Proxy is not running on port 5432."
    echo ""
    echo "Please start Cloud SQL Proxy in another terminal:"
    echo "  ./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432"
    exit 1
fi

echo "✅ Cloud SQL Proxy is running"
echo ""

# Database connection info
DB_USER="app_user"
DB_NAME="creative_flow_studio"
DB_HOST="localhost"
DB_PORT="5432"

echo "📝 Please enter the database password for user 'app_user':"
echo "   (You can get it from Terraform output or Secret Manager)"
read -s DB_PASSWORD
echo ""

export PGPASSWORD="$DB_PASSWORD"

echo "🔄 Updating ENTERPRISE plan Price ID to: price_1SUPIgLi6CKW3pRawbELPocW"
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

SELECT id, name, "stripePriceId", "monthlyPrice", "updatedAt"
FROM "plans"
WHERE name = 'ENTERPRISE';
SQL

unset PGPASSWORD

echo ""
echo "✅ Price ID update completed!"
