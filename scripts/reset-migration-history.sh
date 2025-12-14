#!/bin/bash
# Cloud SQLのマイグレーション履歴をリセットするスクリプト
# 使用方法: ./scripts/reset-migration-history.sh

set -e

PROJECT_ID="dataanalyticsclinic"
INSTANCE_NAME="creative-flow-studio-sql"
DB_NAME="creative_flow_studio"
DB_USER="app_user"

echo "🔑 Cloud SQL Proxyを起動しています..."
cloud-sql-proxy ${PROJECT_ID}:asia-northeast1:${INSTANCE_NAME} --port=5433 &
PROXY_PID=$!
sleep 3

echo "📊 現在のマイグレーション履歴を確認しています..."
PGPASSWORD=$(gcloud secrets versions access latest --secret=database-url --project=${PROJECT_ID} | grep -oP ':[^:@]+@' | sed 's/://g' | sed 's/@//g')
psql "postgresql://${DB_USER}:${PGPASSWORD}@127.0.0.1:5433/${DB_NAME}" -c "SELECT * FROM \"_prisma_migrations\";"

echo "🗑️  マイグレーション履歴をリセットしています..."
psql "postgresql://${DB_USER}:${PGPASSWORD}@127.0.0.1:5433/${DB_NAME}" -c "TRUNCATE TABLE \"_prisma_migrations\";"

echo "✅ マイグレーション履歴をリセットしました"
echo "📊 確認:"
psql "postgresql://${DB_USER}:${PGPASSWORD}@127.0.0.1:5433/${DB_NAME}" -c "SELECT * FROM \"_prisma_migrations\";"

echo "🛑 Cloud SQL Proxyを停止しています..."
kill $PROXY_PID 2>/dev/null || true
wait $PROXY_PID 2>/dev/null || true

echo "✅ 完了しました"




