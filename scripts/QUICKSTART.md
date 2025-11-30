# Stripe クラウド開発環境 クイックスタート

このガイドでは、Stripe CLIとgcloudコマンドを使って、クラウド開発環境でFREE/PRO/ENTERPRISEプランの契約・切り替えをテストできるようにする手順を説明します。

## 🚀 5分でセットアップ

### 1. Stripeプランを作成

```bash
./scripts/setup-stripe-plans.sh
```

**出力されたPrice IDをメモ:**
- PRO Price ID: `price_xxxxx`
- ENTERPRISE Price ID: `price_yyyyy`

### 2. データベースにPrice IDを設定

```bash
# Price IDを環境変数に設定
export PRO_PRICE_ID="price_xxxxx"      # ステップ1で取得したPRO Price ID
export ENTERPRISE_PRICE_ID="price_yyyyy"  # ステップ1で取得したENTERPRISE Price ID

# データベースに設定（Cloud SQL Proxyが必要）
./scripts/set-stripe-price-ids.sh $PRO_PRICE_ID $ENTERPRISE_PRICE_ID
```

**注意:** Cloud SQL Proxyが起動していない場合は、別ターミナルで起動：

```bash
./cloud-sql-proxy dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql --port=5432
```

### 3. Secret ManagerにStripeキーを設定

```bash
./scripts/setup-stripe-secrets.sh
```

このスクリプトは`.env.local`からStripeキーを読み込んでSecret Managerに設定します。

### 4. Cloud Runサービスを更新

```bash
./scripts/update-cloud-run-stripe.sh
```

### 5. プランの契約・切り替えをテスト

```bash
# テストユーザーのメールアドレスを指定
USER_EMAIL="test@example.com"

# PROプランに契約
./scripts/test-stripe-subscription.sh $USER_EMAIL PRO

# ENTERPRISEプランに切り替え
./scripts/test-stripe-subscription.sh $USER_EMAIL ENTERPRISE

# FREEプランに戻す
./scripts/test-stripe-subscription.sh $USER_EMAIL FREE
```

## ✅ 確認

1. **アプリで確認**
   - https://blunaai.com にログイン
   - ダッシュボードでプランが正しく表示されているか確認

2. **Stripe Dashboardで確認**
   - https://dashboard.stripe.com/test/subscriptions
   - サブスクリプションが作成されているか確認

3. **データベースで確認**
   ```sql
   SELECT u.email, p.name, s.status, s."stripeSubscriptionId"
   FROM "users" u
   JOIN "subscriptions" s ON s."userId" = u.id
   JOIN "plans" p ON s."planId" = p.id
   ORDER BY s."createdAt" DESC;
   ```

## 📚 詳細ドキュメント

詳細な手順とトラブルシューティングは以下を参照：
- [Stripe クラウド開発環境セットアップガイド](../docs/stripe-cloud-dev-setup.md)
