# Cloud SQL 接続ガイド

## ローカルから Cloud SQL に接続する方法

### 方法 1: Cloud SQL Proxy を使用（推奨）

1. **Cloud SQL Proxy をインストール**

```bash
# macOS
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Linux
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
```

2. **Cloud SQL Proxy を起動**

```bash
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql \
  --port=5432
```

3. **別ターミナルで SQL を実行**

```bash
# DATABASE_URL を設定（Cloud SQL Proxy 経由）
export DATABASE_URL="postgresql://app_user:PASSWORD@127.0.0.1:5432/creative_flow_studio"

# SQL スクリプトを実行
psql "$DATABASE_URL" -f scripts/update-stripe-price-ids.sql
```

**注意:** `PASSWORD` は Cloud SQL インスタンスのパスワードです。Secret Manager から取得するか、Terraform で生成されたパスワードを使用してください。

### 方法 2: gcloud コマンドで直接接続

```bash
gcloud sql connect creative-flow-studio-sql \
  --project=dataanalyticsclinic \
  --user=app_user \
  --database=creative_flow_studio
```

接続後、SQL を直接実行：

```sql
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

SELECT id, name, "stripePriceId", "monthlyPrice" FROM "plans" ORDER BY name;
```

### 方法 3: Prisma Studio を使用

```bash
# DATABASE_URL を Cloud SQL Proxy 経由に設定
export DATABASE_URL="postgresql://app_user:PASSWORD@127.0.0.1:5432/creative_flow_studio"

# Prisma Studio を起動
npx prisma studio
```

ブラウザで `http://localhost:5555` を開き、`Plan` テーブルを編集できます。

---

## Stripe Price ID の設定

### ENTERPRISE プラン（設定済み）

```sql
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';
```

### PRO プラン（未設定）

PRO プラン用の Price ID を Stripe Dashboard で作成後、以下を実行：

```sql
UPDATE "plans"
SET "stripePriceId" = 'price_test_YOUR_PRO_PRICE_ID',
    "updatedAt" = NOW()
WHERE name = 'PRO';
```

---

## 確認クエリ

```sql
-- すべてのプランの Price ID を確認
SELECT id, name, "stripePriceId", "monthlyPrice", "updatedAt"
FROM "plans"
ORDER BY name;
```

