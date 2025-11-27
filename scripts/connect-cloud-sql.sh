#!/bin/bash
# Connect to Cloud SQL and set Price ID
# Usage: ./scripts/connect-cloud-sql.sh

set -e

echo "🔍 Checking Cloud SQL Proxy status..."
if ! pgrep -f "cloud-sql-proxy.*creative-flow-studio-sql" > /dev/null; then
    echo "❌ Cloud SQL Proxy is not running."
    echo "Please start it in another terminal:"
    echo "  ./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432"
    exit 1
fi

echo "✅ Cloud SQL Proxy is running"

# Get database connection info
DB_USER="app_user"
DB_NAME="creative_flow_studio"
DB_HOST="localhost"
DB_PORT="5432"

echo ""
echo "📝 Please enter the database password for user 'app_user':"
read -s DB_PASSWORD

export PGPASSWORD="$DB_PASSWORD"

echo ""
echo "🔄 Updating ENTERPRISE plan Price ID..."

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


