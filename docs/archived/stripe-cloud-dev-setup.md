# Stripe クラウド開発環境セットアップガイド

**最終更新:** 2025-12-01  
**対象環境:** Cloud Run (dev) + Stripe テスト環境  
**目的:** Stripe CLIとgcloudコマンドを使って、クラウド開発環境でFREE/PRO/ENTERPRISEプランの契約・切り替えをテストできるようにする

---

## 📋 前提条件

- Stripe CLIがインストール済み（`stripe --version`で確認）
- Stripe CLIで`blunaai.com`サンドボックスにログイン済み
- `.env.local`にStripeキーが設定済み
- gcloud CLIがインストール済み
- GCPプロジェクト`dataanalyticsclinic`へのアクセス権限

---

## 🚀 セットアップ手順

### ステップ1: Stripeプランを作成

Stripe CLIでPRO（¥3,000/月）とENTERPRISE（¥30,000/月）のプランを作成します。

```bash
./scripts/setup-stripe-plans.sh
```

**出力例:**
```
✅ PRO Price ID: price_xxxxx
✅ ENTERPRISE Price ID: price_yyyyy
```

**重要:** 出力されたPrice IDをメモしてください。次のステップで使用します。

---

### ステップ2: データベースにPrice IDを設定

作成したPrice IDをデータベースに設定します。

#### 方法A: スクリプトを使用（推奨）

```bash
# Price IDを環境変数に設定
export PRO_PRICE_ID="price_xxxxx"  # ステップ1で取得したPRO Price ID
export ENTERPRISE_PRICE_ID="price_yyyyy"  # ステップ1で取得したENTERPRISE Price ID

# データベースに設定
./scripts/set-stripe-price-ids.sh $PRO_PRICE_ID $ENTERPRISE_PRICE_ID
```

#### 方法B: 引数で直接指定

```bash
./scripts/set-stripe-price-ids.sh price_xxxxx price_yyyyy
```

**注意:** Cloud SQL Proxyが起動していない場合は、別ターミナルで起動してください：

```bash
# Cloud SQL Proxyをダウンロード（初回のみ）
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Cloud SQL Proxyを起動
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432
```

---

### ステップ3: Secret ManagerにStripeキーを設定

`.env.local`からStripeキーを読み込んでSecret Managerに設定します。

```bash
./scripts/setup-stripe-secrets.sh
```

このスクリプトは以下を実行します：
- `STRIPE_SECRET_KEY` → `stripe-secret-key`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `stripe-publishable-key`
- `STRIPE_WEBHOOK_SECRET` → `stripe-webhook-secret`

---

### ステップ4: Cloud Runサービスを更新

Secret Managerの最新バージョンを参照するようにCloud Runサービスを更新します。

```bash
./scripts/update-cloud-run-stripe.sh
```

このスクリプトは以下を実行します：
- `STRIPE_SECRET_KEY=stripe-secret-key:latest`
- `STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=stripe-publishable-key:latest`

---

### ステップ5: プランの契約・切り替えをテスト

テストユーザーでプランの契約・切り替えをテストします。

```bash
# PROプランに契約
./scripts/test-stripe-subscription.sh test@example.com PRO

# ENTERPRISEプランに切り替え
./scripts/test-stripe-subscription.sh test@example.com ENTERPRISE

# FREEプランに戻す
./scripts/test-stripe-subscription.sh test@example.com FREE
```

**注意:** 
- テストユーザーは事前にデータベースに登録されている必要があります
- PRO/ENTERPRISEプランの場合は、Stripe CLIでテストカード（4242 4242 4242 4242）を使用してサブスクリプションを作成します
- Webhookが処理されるまで5秒待機します

---

## 🔍 確認方法

### 1. データベースの確認

```bash
# Cloud SQL Proxyを起動（別ターミナル）
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432

# データベースに接続
DATABASE_URL=$(gcloud secrets versions access latest --secret=database-url --project=dataanalyticsclinic)
psql "$DATABASE_URL" -c "SELECT id, name, \"stripePriceId\", \"monthlyPrice\" FROM \"plans\" ORDER BY name;"
```

### 2. サブスクリプションの確認

```sql
SELECT 
    u.email,
    p.name AS plan_name,
    s.status,
    s."stripeSubscriptionId",
    s."currentPeriodEnd"
FROM "users" u
JOIN "subscriptions" s ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
ORDER BY s."createdAt" DESC
LIMIT 10;
```

### 3. Stripe Dashboardで確認

- [Stripe Dashboard - Subscriptions](https://dashboard.stripe.com/test/subscriptions)
- [Stripe Dashboard - Products](https://dashboard.stripe.com/test/products)

### 4. アプリで確認

- アプリにログイン: https://blunaai.com
- ダッシュボードでプランが正しく表示されているか確認
- `/pricing`ページでプラン変更ができるか確認

---

## 🛠️ トラブルシューティング

### Cloud SQL Proxyが起動しない

```bash
# Cloud SQL Proxyを再起動
pkill cloud-sql-proxy
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432
```

### Secret Managerへのアクセス権限エラー

```bash
# 現在のプロジェクトを確認
gcloud config get-value project

# プロジェクトを設定
gcloud config set project dataanalyticsclinic

# 認証を確認
gcloud auth list
```

### Stripe CLIが動作しない

```bash
# Stripe CLIのログイン状態を確認
stripe config --list

# 再ログイン
stripe login
```

### Webhookが処理されない

1. Stripe DashboardでWebhookエンドポイントを確認：
   - https://dashboard.stripe.com/test/webhooks
   - エンドポイントURL: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/stripe/webhook`
   - または: `https://blunaai.com/api/stripe/webhook`

2. Cloud Runのログを確認：
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
     --project=dataanalyticsclinic \
     --limit=50 \
     --format="table(timestamp,textPayload)" \
     --filter='textPayload:"stripe" OR textPayload:"webhook"'
   ```

3. Webhook Secretが正しいか確認：
   ```bash
   gcloud secrets versions access latest --secret=stripe-webhook-secret --project=dataanalyticsclinic
   ```

---

## 📝 スクリプト一覧

| スクリプト                         | 説明                              |
|-------------------------------|-----------------------------------|
| `setup-stripe-plans.sh`       | Stripe CLIでPRO/ENTERPRISEプランを作成 |
| `set-stripe-price-ids.sh`     | データベースにPrice IDを設定              |
| `setup-stripe-secrets.sh`     | Secret ManagerにStripeキーを設定      |
| `update-cloud-run-stripe.sh`  | Cloud Runサービスを更新                |
| `test-stripe-subscription.sh` | プランの契約・切り替えをテスト               |

---

## 🎯 次のステップ

1. **本番環境への移行**
   - Stripe本番モードでプランを作成
   - 本番環境のSecret Managerに設定
   - 本番環境のCloud Runサービスを更新

2. **Webhookエンドポイントの設定**
   - 本番環境のWebhookエンドポイントを設定
   - 本番環境のWebhook SecretをSecret Managerに設定

3. **監視とアラート**
   - Stripe Webhookの失敗を監視
   - サブスクリプションの状態変更を監視

---

## 📚 関連ドキュメント

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)




