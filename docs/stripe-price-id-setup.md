# Stripe Price ID 設定ガイド

## 概要

Creative Flow Studio では、Stripe の Price ID を Plan テーブルの `stripePriceId` カラムに設定することで、Webhook 経由でサブスクリプションを自動的に Plan にマッピングします。

## 設定手順

### 1. Stripe Dashboard で Price ID を取得

1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. **Products** → **Pricing** に移動
3. 各プラン（PRO、ENTERPRISE）の Price ID をコピー
   - テストモード: `price_test_xxxxx` 形式
   - 本番モード: `price_xxxxx` 形式

### 2. データベースに Price ID を設定

#### 方法 A: SQL スクリプトを使用（推奨）

```bash
# 1. scripts/update-stripe-price-ids.sql を編集して Price ID を設定
# 2. スクリプトを実行
psql $DATABASE_URL -f scripts/update-stripe-price-ids.sql
```

または、SQL で直接更新：

```sql
-- PRO プランの Price ID を更新
UPDATE "plans"
SET "stripePriceId" = 'price_YOUR_PRO_PRICE_ID'
WHERE name = 'PRO';

-- ENTERPRISE プランの Price ID を更新
UPDATE "plans"
SET "stripePriceId" = 'price_YOUR_ENTERPRISE_PRICE_ID'
WHERE name = 'ENTERPRISE';

-- 確認
SELECT id, name, "stripePriceId" FROM "plans" ORDER BY name;
```

#### 方法 B: seed.sql を更新して再実行

`prisma/seed.sql` の `stripePriceId` プレースホルダーを実際の Price ID に置き換えてから実行：

```bash
psql $DATABASE_URL -f prisma/seed.sql
```

### 3. 動作確認

`getPlanIdFromStripeSubscription` 関数は、Stripe Subscription から Price ID を取得し、Plan テーブルで検索します。

**確認方法:**

1. Stripe Dashboard でテスト Checkout セッションを作成
2. Webhook イベント `checkout.session.completed` を受信
3. データベースで Subscription レコードが正しい `planId` で作成されているか確認

```sql
SELECT 
    u.email,
    p.name AS plan_name,
    p."stripePriceId",
    s."stripeSubscriptionId",
    s.status
FROM "subscriptions" s
JOIN "users" u ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
ORDER BY s."createdAt" DESC
LIMIT 10;
```

## トラブルシューティング

### Price ID が見つからないエラー

```
Error: Plan not found for Stripe Price ID: price_xxxxx
```

**原因:** Plan テーブルに該当する `stripePriceId` が設定されていない

**解決策:**
1. Stripe Dashboard で Price ID を確認
2. データベースの Plan レコードを更新
3. Webhook を再送信（Stripe Dashboard → Events → Retry）

### 複数の Price ID が存在する場合

Stripe では同じ Product に対して複数の Price（月額/年額、異なる通貨など）を作成できます。

**推奨:** 各 Plan に対して1つの Price ID のみを設定し、Checkout セッション作成時にその Price ID を使用します。

## 関連ドキュメント

- [Stripe Products and Prices](https://docs.stripe.com/products-prices/overview)
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- `docs/stripe-integration-plan.md` - Stripe 統合の全体設計
- `lib/stripe.ts` - `getPlanIdFromStripeSubscription` 実装

