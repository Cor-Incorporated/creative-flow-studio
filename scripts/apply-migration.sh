#!/bin/bash
# Cloud SQLマイグレーション適用スクリプト
# Usage: ./scripts/apply-migration.sh

set -e

PROJECT_ID="dataanalyticsclinic"
INSTANCE="creative-flow-studio-sql"
DATABASE="creative_flow_studio"
USER="app_user"

echo "🔍 Cloud SQL Proxyを起動しています..."

# Cloud SQL Proxyをバックグラウンドで起動
cloud-sql-proxy ${PROJECT_ID}:asia-northeast1:${INSTANCE} --port=5433 > /tmp/cloud-sql-proxy.log 2>&1 &
PROXY_PID=$!

# Proxyが起動するまで待機
sleep 5

# Proxyが正常に起動したか確認
if ! ps -p $PROXY_PID > /dev/null; then
    echo "❌ Cloud SQL Proxyの起動に失敗しました"
    cat /tmp/cloud-sql-proxy.log
    exit 1
fi

echo "✅ Cloud SQL Proxyが起動しました (PID: $PROXY_PID)"

# パスワードを取得
echo "🔑 データベースパスワードを取得しています..."
DB_URL=$(gcloud secrets versions access latest --secret="database-url" --project=${PROJECT_ID} 2>/dev/null)
DB_PASSWORD=$(echo "$DB_URL" | sed -n 's|.*://app_user:\([^@]*\)@.*|\1|p' || echo "")

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ パスワードの取得に失敗しました"
    kill $PROXY_PID 2>/dev/null || true
    exit 1
fi

echo "🔄 マイグレーションを適用しています..."

# マイグレーションSQLを実行
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p 5433 -U "$USER" -d "$DATABASE" <<SQL
-- passwordカラムが存在しない場合のみ追加
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "password" TEXT;
        RAISE NOTICE 'passwordカラムを追加しました';
    ELSE
        RAISE NOTICE 'passwordカラムは既に存在します';
    END IF;
END \$\$;
SQL

MIGRATION_RESULT=$?

# Proxyを停止
echo "🛑 Cloud SQL Proxyを停止しています..."
kill $PROXY_PID 2>/dev/null || true
wait $PROXY_PID 2>/dev/null || true

if [ $MIGRATION_RESULT -eq 0 ]; then
    echo "✅ マイグレーションが正常に完了しました"
    exit 0
else
    echo "❌ マイグレーションの適用に失敗しました"
    exit 1
fi
