# Stripe Price ID 設定クイックガイド

## ENTERPRISE プランの Price ID 設定

**Price ID:** `price_1SUPIgLi6CKW3pRawbELPocW`（¥30,000/月）

### 最も簡単な方法: Cloud SQL Proxy を使用

1. **Cloud SQL Proxy をダウンロード・起動**（別ターミナル）

```bash
# macOS (Apple Silicon)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432

# macOS (Intel)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432

# Linux
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432
```

2. **別ターミナルで SQL を実行**

**方法 A: インタラクティブスクリプトを使用（推奨）**

```bash
# スクリプトを実行（パスワードを入力）
./scripts/set-price-id-interactive.sh
```

**方法 B: 手動で SQL を実行**

```bash
# データベースパスワードを入力
export PGPASSWORD="YOUR_DATABASE_PASSWORD"

# Price ID を設定
psql -h localhost -p 5432 -U app_user -d creative_flow_studio <<'SQL'
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

SELECT id, name, "stripePriceId", "monthlyPrice", "updatedAt"
FROM "plans"
WHERE name = 'ENTERPRISE';
SQL

unset PGPASSWORD
```

**データベースパスワードの取得方法:**

```bash
# Terraform output から取得（Terraform state がある場合）
cd infra/envs/dev
terraform output -json cloud_sql | jq -r '.database_password'

# または、Cloud SQL のパスワードをリセット
gcloud sql users set-password app_user \
  --instance=creative-flow-studio-sql \
  --project=dataanalyticsclinic \
  --prompt-for-password
```

### 確認

```bash
export PGPASSWORD="YOUR_DATABASE_PASSWORD"
psql -h localhost -p 5432 -U app_user -d creative_flow_studio \
  -c "SELECT id, name, \"stripePriceId\", \"monthlyPrice\" FROM plans ORDER BY name;"
unset PGPASSWORD
```

**期待される結果:**
```
ENTERPRISE | price_1SUPIgLi6CKW3pRawbELPocW | 5000
```

---

## PRO プランの Price ID 設定

PRO プラン用の Price ID を Stripe Dashboard で作成後、同様に設定してください：

```sql
UPDATE "plans"
SET "stripePriceId" = 'price_test_YOUR_PRO_PRICE_ID',
    "updatedAt" = NOW()
WHERE name = 'PRO';
```

---

## 次のステップ

Price ID 設定後、実働テストを実施してください：

1. **Stripe Webhook エンドポイントを登録**
   - URL: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/stripe/webhook`
   - [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks) で登録

2. **実働テストを実施**
   - `docs/testing-manual-dev.md` の手順に従ってテスト
   - アプリ URL: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`

