# クラウド開発環境 実働テスト設定ガイド

**最終更新:** 2025-11-13  
**対象環境:** Cloud Run (dev)  
**目的:** クラウド開発環境で Stripe/Gemini の実働テストを実施するための設定手順

---

## 設定完了状況

### ✅ Secret Manager へのシークレット登録

以下のシークレットが Secret Manager に登録・更新されました：

| Secret Manager キー | 環境変数名 | 状態 |
|---------------------|-----------|------|
| `stripe-secret-key` | `STRIPE_SECRET_KEY` | ✅ 更新済み（テストキー） |
| `stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` | ✅ 更新済み（テストキー） |
| `stripe-publishable-key` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ 更新済み（テストキー） |
| `gemini-api-key` | `GEMINI_API_KEY` | ✅ 更新済み |

### ✅ Cloud Run サービスの設定

**サービス名:** `creative-flow-studio-dev`  
**リージョン:** `asia-northeast1`  
**URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`

**最新リビジョン:** `creative-flow-studio-dev-00019-pq7`  
**状態:** 最新のシークレットバージョンを参照中

---

## Stripe Webhook エンドポイント設定

### Webhook URL

```
https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/stripe/webhook
```

### Stripe Dashboard での登録手順

1. [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks) にログイン（**テストモード**）
2. **Developers** → **Webhooks** に移動
3. **「Add endpoint」** をクリック
4. **Endpoint URL** に上記の URL を入力
5. **Events to send** で以下を選択：
   - ✅ `checkout.session.completed`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
6. **「Add endpoint」** をクリック
7. 作成後、**Signing secret** をコピー（`whsec_...` 形式）

**重要:** この Signing secret は既に Secret Manager に登録済みです。  
もし異なる場合は、以下で更新してください：

```bash
echo -n "whsec_YOUR_NEW_SECRET" | gcloud secrets versions add stripe-webhook-secret \
  --project=dataanalyticsclinic \
  --data-file=-

# Cloud Run サービスを更新
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets=STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest
```

---

## 実働テスト手順

### 1. Stripe Price ID の設定

データベースに Stripe Price ID を設定します：

#### 方法 A: Cloud SQL Proxy を使用（推奨）

1. **Cloud SQL Proxy を起動**（別ターミナル）

```bash
# Cloud SQL Proxy をダウンロード（初回のみ）
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Cloud SQL Proxy を起動
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432
```

2. **別ターミナルで SQL を実行**

```bash
# データベースパスワードを取得（Terraform で生成されたパスワード）
# または、Secret Manager から DATABASE_URL 全体を取得
DATABASE_URL=$(gcloud secrets versions access latest --secret=database-url --project=dataanalyticsclinic)

# ENTERPRISE プランの Price ID を設定
psql "$DATABASE_URL" <<EOF
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

SELECT id, name, "stripePriceId", "monthlyPrice" FROM "plans" ORDER BY name;
EOF
```

#### 方法 B: gcloud コマンドで直接接続

```bash
# Cloud SQL に接続（パスワード入力が必要）
gcloud sql connect creative-flow-studio-sql \
  --project=dataanalyticsclinic \
  --user=app_user \
  --database=creative_flow_studio
```

接続後、SQL を実行：

```sql
UPDATE "plans"
SET "stripePriceId" = 'price_1SUPIgLi6CKW3pRawbELPocW',
    "updatedAt" = NOW()
WHERE name = 'ENTERPRISE';

SELECT id, name, "stripePriceId", "monthlyPrice" FROM "plans" ORDER BY name;
```

**注意:** ENTERPRISE プランの Price ID は `price_1SUPIgLi6CKW3pRawbELPocW`（¥30,000/月）に設定済みです。  
PRO プラン用の Price ID は Stripe Dashboard で作成後、同様に設定してください。

### 2. Admin ユーザーの権限付与

```bash
# SQL スクリプトで Admin 権限を付与
psql $DATABASE_URL -f scripts/grant-admin-role.sql
```

### 3. 実働テストの実施

`docs/testing-manual-dev.md` の手順に従ってテストを実施してください。

**注意:** ローカル環境ではなく、Cloud Run の URL を使用します：
- **アプリ URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`
- **Webhook URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/stripe/webhook`

### 4. テスト結果の確認

#### Stripe Webhook の動作確認

1. Stripe Dashboard → **Developers** → **Webhooks** → エンドポイントを選択
2. **「Send test webhook」** をクリック
3. イベントタイプを選択（例: `checkout.session.completed`）
4. **「Send test webhook」** をクリック
5. Cloud Run のログで Webhook が受信されたことを確認：

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
  --project=dataanalyticsclinic \
  --limit=50 \
  --format="table(timestamp,textPayload)" \
  --filter='textPayload:"stripe" OR textPayload:"webhook"'
```

#### データベースの確認

```sql
-- Subscription レコードの確認
SELECT u.email, p.name AS plan_name, s.status, s."stripeSubscriptionId", s."currentPeriodEnd"
FROM "users" u
JOIN "subscriptions" s ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
ORDER BY s."createdAt" DESC
LIMIT 10;

-- PaymentEvent の確認
SELECT pe.type, pe.status, pe.amount, pe."createdAt"
FROM "payment_events" pe
ORDER BY pe."createdAt" DESC
LIMIT 10;
```

---

## トラブルシューティング

### Webhook が受信されない

**原因:** Webhook secret が一致していない、またはエンドポイント URL が正しくない

**解決策:**
1. Stripe Dashboard でエンドポイントの Signing secret を確認
2. Secret Manager の値と一致しているか確認：
   ```bash
   gcloud secrets versions access latest --secret=stripe-webhook-secret --project=dataanalyticsclinic
   ```
3. Cloud Run のログでエラーを確認：
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
     --project=dataanalyticsclinic \
     --limit=20 \
     --format="table(timestamp,textPayload)"
   ```

### シークレットが反映されない

**原因:** Cloud Run サービスが古いシークレットバージョンを参照している

**解決策:**
```bash
# すべてのシークレットを最新バージョンに更新
gcloud run services update creative-flow-studio-dev \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --update-secrets=STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=stripe-publishable-key:latest,GEMINI_API_KEY=gemini-api-key:latest
```

### Cloud Run サービスが起動しない

**原因:** 環境変数やシークレットの設定エラー

**解決策:**
1. Cloud Run サービスの設定を確認：
   ```bash
   gcloud run services describe creative-flow-studio-dev \
     --region=asia-northeast1 \
     --project=dataanalyticsclinic \
     --format="yaml(spec.template.spec.containers[0].env)"
   ```
2. ログでエラーを確認：
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
     --project=dataanalyticsclinic \
     --limit=50 \
     --format="table(timestamp,severity,textPayload)"
   ```

---

## 関連ドキュメント

- `docs/testing-manual-dev.md` - 詳細なテスト手順
- `docs/stripe-price-id-setup.md` - Stripe Price ID 設定手順
- `docs/terraform-production-setup.md` - Terraform 本番環境セットアップ

