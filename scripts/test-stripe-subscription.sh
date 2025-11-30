#!/bin/bash
# Stripeサブスクリプションの契約・切り替えをテストするスクリプト
# Usage: ./scripts/test-stripe-subscription.sh <user_email> <plan_name>
# plan_name: FREE, PRO, ENTERPRISE
# Requirements: stripe CLI, jq, psql, gcloud

set -e

# 依存関係チェック
if ! command -v stripe &> /dev/null; then
    echo "❌ エラー: Stripe CLIがインストールされていません"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ エラー: jqがインストールされていません"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ エラー: psqlがインストールされていません"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo "❌ エラー: gcloudがインストールされていません"
    exit 1
fi

PROJECT_ID="dataanalyticsclinic"
REGION="asia-northeast1"
INSTANCE_NAME="creative-flow-studio-sql"
DB_NAME="creative_flow_studio"
DB_USER="app_user"

if [ $# -lt 2 ]; then
    echo "❌ エラー: 引数が不足しています"
    echo "Usage: ./scripts/test-stripe-subscription.sh <user_email> <plan_name>"
    echo "  plan_name: FREE, PRO, ENTERPRISE"
    echo ""
    echo "例:"
    echo "  ./scripts/test-stripe-subscription.sh test@example.com PRO"
    exit 1
fi

USER_EMAIL=$1
PLAN_NAME=$2

if [[ ! "$PLAN_NAME" =~ ^(FREE|PRO|ENTERPRISE)$ ]]; then
    echo "❌ エラー: プラン名は FREE, PRO, ENTERPRISE のいずれかである必要があります"
    exit 1
fi

echo "🚀 Stripeサブスクリプションテストスクリプト"
echo "================================"
echo "ユーザー: $USER_EMAIL"
echo "プラン: $PLAN_NAME"
echo ""

# データベースからユーザーIDとプランIDを取得
echo "📖 データベースから情報を取得中..."

SQL_FILE=$(mktemp)
cat > "$SQL_FILE" <<EOF
-- ユーザーIDを取得
SELECT id FROM "users" WHERE email = '$USER_EMAIL';
EOF

# Cloud SQL Proxyが起動しているか確認
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "⚠️  Cloud SQL Proxyが起動していません。"
    echo "別ターミナルで以下を実行してください:"
    echo "  ./cloud-sql-proxy $PROJECT_ID:$REGION:$INSTANCE_NAME --port=5432"
    exit 1
fi

# データベースパスワードを取得
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret=database-url \
  --project=$PROJECT_ID | grep -oP 'postgresql://[^:]+:\K[^@]+' || echo "")

if [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  Secret Managerからパスワードを取得できませんでした。手動で入力してください。"
    read -sp "Database password: " DB_PASSWORD
    echo ""
fi

export PGPASSWORD="$DB_PASSWORD"
USER_ID=$(psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -t -c "SELECT id FROM \"users\" WHERE email = '$USER_EMAIL';" | xargs)

if [ -z "$USER_ID" ]; then
    echo "❌ エラー: ユーザー '$USER_EMAIL' が見つかりません"
    unset PGPASSWORD
    rm -f "$SQL_FILE"
    exit 1
fi

echo "✅ ユーザーID: $USER_ID"

# プランIDを取得
PLAN_ID=$(psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -t -c "SELECT id FROM \"plans\" WHERE name = '$PLAN_NAME';" | xargs)

if [ -z "$PLAN_ID" ]; then
    echo "❌ エラー: プラン '$PLAN_NAME' が見つかりません"
    unset PGPASSWORD
    rm -f "$SQL_FILE"
    exit 1
fi

echo "✅ プランID: $PLAN_ID"

# Stripe Price IDを取得
if [ "$PLAN_NAME" != "FREE" ]; then
    STRIPE_PRICE_ID=$(psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -t -c "SELECT \"stripePriceId\" FROM \"plans\" WHERE name = '$PLAN_NAME';" | xargs)
    
    if [ -z "$STRIPE_PRICE_ID" ]; then
        echo "❌ エラー: プラン '$PLAN_NAME' にStripe Price IDが設定されていません"
        echo "   先に ./scripts/set-stripe-price-ids.sh を実行してください"
        unset PGPASSWORD
        rm -f "$SQL_FILE"
        exit 1
    fi
    
    echo "✅ Stripe Price ID: $STRIPE_PRICE_ID"
fi

unset PGPASSWORD
rm -f "$SQL_FILE"

# FREEプランの場合は、サブスクリプションを削除または無効化
if [ "$PLAN_NAME" == "FREE" ]; then
    echo ""
    echo "🔄 FREEプランに切り替え中..."
    
    SQL_FILE=$(mktemp)
    cat > "$SQL_FILE" <<EOF
-- サブスクリプションを無効化
UPDATE "subscriptions"
SET status = 'INACTIVE',
    "updatedAt" = NOW()
WHERE "userId" = '$USER_ID';

-- FREEプランに設定
INSERT INTO "subscriptions" (id, "userId", "planId", status, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '$USER_ID', '$PLAN_ID', 'ACTIVE', NOW(), NOW())
ON CONFLICT ("userId") DO UPDATE
SET "planId" = '$PLAN_ID',
    status = 'ACTIVE',
    "updatedAt" = NOW();
EOF
    
    export PGPASSWORD="$DB_PASSWORD"
    psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -f "$SQL_FILE"
    unset PGPASSWORD
    rm -f "$SQL_FILE"
    
    echo "✅ FREEプランに切り替えました"
    
else
    # PRO/ENTERPRISEプランの場合は、Stripe CLIでサブスクリプションを作成
    echo ""
    echo "🔄 $PLAN_NAMEプランのサブスクリプションを作成中..."
    
    # 既存のStripe Customer IDを取得
    SQL_FILE=$(mktemp)
    cat > "$SQL_FILE" <<EOF
SELECT "stripeCustomerId" FROM "subscriptions" WHERE "userId" = '$USER_ID';
EOF
    
    export PGPASSWORD="$DB_PASSWORD"
    STRIPE_CUSTOMER_ID=$(psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -t -c "SELECT \"stripeCustomerId\" FROM \"subscriptions\" WHERE \"userId\" = '$USER_ID';" | xargs)
    unset PGPASSWORD
    rm -f "$SQL_FILE"
    
    # Stripe Customerが存在しない場合は作成
    if [ -z "$STRIPE_CUSTOMER_ID" ]; then
        echo "  📝 Stripe Customerを作成中..."
        CUSTOMER=$(stripe customers create \
          --email "$USER_EMAIL" \
          -d "metadata[userId]=$USER_ID")
        
        STRIPE_CUSTOMER_ID=$(echo "$CUSTOMER" | jq -r '.id')
        echo "  ✅ Stripe Customer ID: $STRIPE_CUSTOMER_ID"
    else
        echo "  ✅ 既存のStripe Customer ID: $STRIPE_CUSTOMER_ID"
    fi
    
    # テストカードでサブスクリプションを作成
    echo "  💳 テストカードでサブスクリプションを作成中..."
    
    # まず、テストカードのPayment Methodを作成
    PAYMENT_METHOD=$(stripe payment_methods create \
      --type card \
      -d "card[number]=4242424242424242" \
      -d "card[exp_month]=12" \
      -d "card[exp_year]=2025" \
      -d "card[cvc]=123")
    
    PM_ID=$(echo "$PAYMENT_METHOD" | jq -r '.id')
    echo "  ✅ Payment Method ID: $PM_ID"
    
    # Payment MethodをCustomerにアタッチ
    stripe payment_methods attach "$PM_ID" \
      --customer "$STRIPE_CUSTOMER_ID" > /dev/null
    
    # CustomerのデフォルトPayment Methodを設定
    stripe customers update "$STRIPE_CUSTOMER_ID" \
      -d "invoice_settings[default_payment_method]=$PM_ID" > /dev/null
    
    # サブスクリプションを作成
    SUBSCRIPTION=$(stripe subscriptions create \
      --customer "$STRIPE_CUSTOMER_ID" \
      -d "items[0][price]=$STRIPE_PRICE_ID")
    
    STRIPE_SUBSCRIPTION_ID=$(echo "$SUBSCRIPTION" | jq -r '.id')
    echo "  ✅ Stripe Subscription ID: $STRIPE_SUBSCRIPTION_ID"
    
    echo "  ✅ サブスクリプションが作成されました（テストカードで自動支払い）"
    
    # データベースを更新（Webhookが処理するまで待機）
    echo "  ⏳ Webhookの処理を待機中（5秒）..."
    sleep 5
    
    # データベースの状態を確認
    SQL_FILE=$(mktemp)
    cat > "$SQL_FILE" <<EOF
SELECT 
    u.email,
    p.name AS plan_name,
    s.status,
    s."stripeSubscriptionId",
    s."currentPeriodEnd"
FROM "users" u
JOIN "subscriptions" s ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
WHERE u.id = '$USER_ID';
EOF
    
    export PGPASSWORD="$DB_PASSWORD"
    echo ""
    echo "📊 現在のサブスクリプション状態:"
    psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -f "$SQL_FILE"
    unset PGPASSWORD
    rm -f "$SQL_FILE"
fi

echo ""
echo "✅ テストが完了しました！"
echo ""
echo "確認方法:"
echo "  1. アプリにログイン: https://blunaai.com"
echo "  2. ダッシュボードでプランが正しく表示されているか確認"
echo "  3. Stripe Dashboardでサブスクリプションを確認: https://dashboard.stripe.com/test/subscriptions"
