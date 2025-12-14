#!/bin/bash
# データベースにStripe Price IDを設定するスクリプト
# Usage: ./scripts/set-stripe-price-ids.sh <PRO_PRICE_ID> <ENTERPRISE_PRICE_ID>
# または: PRO_PRICE_ID=price_xxx ENTERPRISE_PRICE_ID=price_yyy ./scripts/set-stripe-price-ids.sh

set -e

PROJECT_ID="dataanalyticsclinic"
REGION="asia-northeast1"
INSTANCE_NAME="creative-flow-studio-sql"
DB_NAME="creative_flow_studio"
DB_USER="app_user"

# Price IDを引数または環境変数から取得
if [ $# -eq 2 ]; then
    PRO_PRICE_ID=$1
    ENTERPRISE_PRICE_ID=$2
elif [ -n "$PRO_PRICE_ID" ] && [ -n "$ENTERPRISE_PRICE_ID" ]; then
    # 環境変数から取得
    :
else
    echo "❌ エラー: Price IDを指定してください"
    echo "Usage: ./scripts/set-stripe-price-ids.sh <PRO_PRICE_ID> <ENTERPRISE_PRICE_ID>"
    echo "または: PRO_PRICE_ID=price_xxx ENTERPRISE_PRICE_ID=price_yyy ./scripts/set-stripe-price-ids.sh"
    exit 1
fi

echo "🚀 Stripe Price ID設定スクリプト"
echo "================================"
echo "PRO Price ID: $PRO_PRICE_ID"
echo "ENTERPRISE Price ID: $ENTERPRISE_PRICE_ID"
echo ""

# データベースURLを取得
echo "🔐 データベースURLを取得中..."
DATABASE_URL=$(gcloud secrets versions access latest \
  --secret=database-url \
  --project=$PROJECT_ID 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Secret ManagerからDATABASE_URLを取得できませんでした。"
    echo "   Cloud SQL Proxyを使用する場合は、別ターミナルで起動してください。"
    echo "   ./cloud-sql-proxy $PROJECT_ID:$REGION:$INSTANCE_NAME --port=5432"
    echo ""
    echo "   または、DATABASE_URLを直接入力してください:"
    read -p "DATABASE_URL: " DATABASE_URL
    echo ""
fi

# データベースに接続
echo "🔌 データベースに接続中..."

# 一時的なSQLファイルを作成
SQL_FILE=$(mktemp)
cat > "$SQL_FILE" <<EOF
-- PROプランのPrice IDを更新
UPDATE "plans"
SET "stripePriceId" = '$PRO_PRICE_ID',
    "updatedAt" = NOW()
WHERE name = 'PRO';

-- ENTERPRISEプランのPrice IDを更新
UPDATE "plans"
SET "stripePriceId" = '$ENTERPRISE_PRICE_ID',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

-- 確認
SELECT id, name, "stripePriceId", "monthlyPrice", "updatedAt"
FROM "plans"
WHERE name IN ('PRO', 'ENTERPRISE')
ORDER BY name;
EOF

# Cloud SQL Proxyを常に起動（既存のプロセスがあれば使用）
PROXY_PID=""
PROXY_PORT=5433  # デフォルトで5433を使用（DockerのPostgreSQLが5432を使用している可能性があるため）

# 既存のCloud SQL Proxyプロセスを確認
if ps aux | grep -v grep | grep -q "cloud-sql-proxy.*creative-flow-studio-sql"; then
    EXISTING_PROXY_PID=$(ps aux | grep -v grep | grep "cloud-sql-proxy.*creative-flow-studio-sql" | awk '{print $2}' | head -1)
    # 既存のプロキシが使用しているポートを確認
    EXISTING_PORT=$(lsof -p $EXISTING_PROXY_PID 2>/dev/null | grep LISTEN | grep -oE ':[0-9]+' | head -1 | tr -d ':')
    if [ -n "$EXISTING_PORT" ]; then
        PROXY_PORT=$EXISTING_PORT
        PROXY_PID=$EXISTING_PROXY_PID
        echo "📝 既存のCloud SQL Proxyを使用中（ポート$PROXY_PORT）..."
    fi
fi

# Cloud SQL Proxyが起動していない場合は起動
if [ -z "$PROXY_PID" ]; then
    echo "📝 Cloud SQL Proxyを起動中..."
    
    # Cloud SQL Proxyをダウンロード（存在しない場合）
    if [ ! -f "./cloud-sql-proxy" ]; then
        echo "  📥 Cloud SQL Proxyをダウンロード中..."
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
        chmod +x cloud-sql-proxy
    fi
    
    # 使用可能なポートを探す（5432が使用中の場合は5433を使用）
    PROXY_PORT=5432
    if lsof -i :5432 > /dev/null 2>&1; then
        PROXY_PORT=5433
        echo "  ⚠️  ポート5432は使用中のため、ポート$PROXY_PORTを使用します"
    fi
    
    # Cloud SQL Proxyをバックグラウンドで起動
    ./cloud-sql-proxy $PROJECT_ID:$REGION:$INSTANCE_NAME --port=$PROXY_PORT > /tmp/cloud-sql-proxy.log 2>&1 &
    PROXY_PID=$!
    
    # Proxyが起動するまで待機
    echo "  ⏳ Cloud SQL Proxyの起動を待機中（ポート$PROXY_PORT）..."
    for i in {1..10}; do
        if pg_isready -h localhost -p $PROXY_PORT > /dev/null 2>&1; then
            echo "  ✅ Cloud SQL Proxyが起動しました（ポート$PROXY_PORT）"
            break
        fi
        sleep 1
    done
    
    # Proxyが正常に起動したか確認
    if ! pg_isready -h localhost -p $PROXY_PORT > /dev/null 2>&1; then
        echo "  ❌ Cloud SQL Proxyの起動に失敗しました"
        cat /tmp/cloud-sql-proxy.log
        kill $PROXY_PID 2>/dev/null || true
        rm -f "$SQL_FILE"
        exit 1
    fi
    
    # DATABASE_URLからパスワードを抽出
    # DATABASE_URL形式: postgresql://user:password@host/database または postgresql://user:password@/database?host=/cloudsql/...
    DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|' || echo "")
    
    # URLデコード（必要に応じて）
    if [ -n "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(printf '%b\n' "${DB_PASSWORD//%/\\x}")
    fi
    
    if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "$DATABASE_URL" ]; then
        echo "  ⚠️  DATABASE_URLからパスワードを取得できませんでした"
        echo "  手動でパスワードを入力してください:"
        read -sp "Database password: " DB_PASSWORD
        echo ""
    fi
    
    # psqlで接続
    export PGPASSWORD="$DB_PASSWORD"
    echo "  📝 データベースを更新中..."
    psql -h localhost -p $PROXY_PORT -U $DB_USER -d $DB_NAME -f "$SQL_FILE"
    unset PGPASSWORD
    
    # Proxyを停止
    if [ -n "$PROXY_PID" ]; then
        echo "  🛑 Cloud SQL Proxyを停止中..."
        kill $PROXY_PID 2>/dev/null || true
        wait $PROXY_PID 2>/dev/null || true
    fi
fi

rm -f "$SQL_FILE"

echo ""
echo "✅ Price IDの設定が完了しました！"
echo ""
echo "確認:"
echo "  PRO: $PRO_PRICE_ID"
echo "  ENTERPRISE: $ENTERPRISE_PRICE_ID"




