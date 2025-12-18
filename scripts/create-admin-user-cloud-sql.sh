#!/bin/bash
# Adminユーザー作成スクリプト（Cloud SQL直接接続版）
# kotaro.uchiho@gmail.comをメール&PWでadmin登録

set -euo pipefail

PROJECT_ID="dataanalyticsclinic"
INSTANCE="creative-flow-studio-sql"
DATABASE="creative_flow_studio"
USER="app_user"
EMAIL="kotaro.uchiho@gmail.com"
PASSWORD="test12345"
ROLE="ADMIN"

echo "🔍 Cloud SQL Proxyを起動しています..."

# DATABASE_URLを取得
DB_URL=$(gcloud secrets versions access latest --secret=database-url --project=${PROJECT_ID} 2>&1)

if [ -z "$DB_URL" ]; then
    echo "❌ DATABASE_URLの取得に失敗しました"
    exit 1
fi

# パスワードを抽出
DB_PASSWORD=$(echo "$DB_URL" | sed -n 's|.*://app_user:\([^@]*\)@.*|\1|p')

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ パスワードの抽出に失敗しました"
    exit 1
fi

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

# Node.jsスクリプトを実行してパスワードをハッシュ化
echo "🔐 パスワードをハッシュ化しています..."
HASHED_PASSWORD=$(node -e "
const crypto = require('crypto');
const password = process.argv[1];
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
console.log(salt + ':' + hash);
" "$PASSWORD")

if [ -z "$HASHED_PASSWORD" ]; then
    echo "❌ パスワードのハッシュ化に失敗しました"
    kill $PROXY_PID 2>/dev/null || true
    exit 1
fi

echo "🔄 ユーザーを作成/更新しています..."

# SQLを実行
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p 5433 -U "$USER" -d "$DATABASE" <<SQL
-- ユーザーが存在するか確認して作成/更新
DO \$\$
DECLARE
    user_exists BOOLEAN;
    user_id TEXT;
BEGIN
    -- ユーザーの存在確認
    SELECT EXISTS(SELECT 1 FROM "users" WHERE email = '$EMAIL') INTO user_exists;
    
    IF user_exists THEN
        -- 既存ユーザーを更新
        UPDATE "users"
        SET 
            "password" = '$HASHED_PASSWORD',
            role = '$ROLE',
            "updatedAt" = NOW()
        WHERE email = '$EMAIL'
        RETURNING id INTO user_id;
        
        RAISE NOTICE 'ユーザーを更新しました: $EMAIL (role: $ROLE, id: %', user_id;
    ELSE
        -- 新規ユーザーを作成
        INSERT INTO "users" (id, email, "password", name, role, "createdAt", "updatedAt")
        VALUES (
            gen_random_uuid()::text,
            '$EMAIL',
            '$HASHED_PASSWORD',
            'Kotaro Uchiho',
            '$ROLE',
            NOW(),
            NOW()
        )
        RETURNING id INTO user_id;
        
        RAISE NOTICE 'ユーザーを作成しました: $EMAIL (role: $ROLE, id: %', user_id;
        
        -- デフォルトのFREEプランサブスクリプションを作成（既に存在しない場合のみ）
        IF NOT EXISTS (SELECT 1 FROM "subscriptions" WHERE "userId" = user_id) THEN
            INSERT INTO "subscriptions" (id, "userId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
            SELECT 
                gen_random_uuid()::text,
                user_id,
                p.id,
                'ACTIVE',
                NOW(),
                NOW() + INTERVAL '1 month',
                NOW(),
                NOW()
            FROM "plans" p
            WHERE p.name = 'FREE'
            LIMIT 1;
            
            RAISE NOTICE 'デフォルトサブスクリプションを作成しました';
        ELSE
            RAISE NOTICE 'サブスクリプションは既に存在します';
        END IF;
    END IF;
END \$\$;

-- 確認
SELECT id, email, name, role, "createdAt", "updatedAt"
FROM "users"
WHERE email = '$EMAIL';
SQL

MIGRATION_RESULT=$?

# Proxyを停止
echo "🛑 Cloud SQL Proxyを停止しています..."
kill $PROXY_PID 2>/dev/null || true
wait $PROXY_PID 2>/dev/null || true

if [ $MIGRATION_RESULT -eq 0 ]; then
    echo ""
    echo "✅ Adminユーザーの作成/更新が正常に完了しました"
    echo ""
    echo "📧 ログイン情報:"
    echo "   メールアドレス: $EMAIL"
    echo "   パスワード: $PASSWORD"
    echo "   ロール: $ROLE"
    echo ""
    exit 0
else
    echo "❌ Adminユーザーの作成/更新に失敗しました"
    exit 1
fi
