# Manual Testing Procedure - Stripe & Usage Limits

このドキュメントは、Claude Code が作成した **Phase 4: Stripe Webhook** と **Phase 5: Usage Limit** の手動 QA 実施手順書です。Cursor または開発者が実際のテストを実行し、結果を `docs/handoff-2025-11-13.md` に記録するために使用します。

**基準ドキュメント:**
- `docs/testing-plan.md` Phase 4 (633-692行目) & Phase 5 (695-1033行目)
- `docs/handoff-2025-11-13.md` 手動 QA 支援フロー (200-236行目)

**実施環境:**
- **ローカル開発**: `npm run dev` (http://localhost:3000)
- **Cloud Run 環境**: https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app

**担当:**
- **Cursor**: Cloud Run 環境での実施、GCP ログ取得、Terraform 管理
- **開発者**: ローカル環境での検証、ブラウザ操作

---

## ⚠️ データベースツールに関する重要事項

**Prisma Studio を使用する場合:**
- SQL 内のテーブル名はモデル名をそのまま使用できます (例: `FROM "User"`, `FROM "Subscription"`)

**psql を直接使用する場合:**
- SQL 内のテーブル名は `@@map` で指定された名前に変更してください:

| モデル名 (Prisma Studio) | テーブル名 (psql) |
| --- | --- |
| `"User"` | `"users"` |
| `"Subscription"` | `"subscriptions"` |
| `"Plan"` | `"plans"` |
| `"PaymentEvent"` | `"payment_events"` |
| `"UsageLog"` | `"usage_logs"` |
| `"AuditLog"` | `"audit_logs"` |

**推奨:** 特に理由がない限り、**Prisma Studio** (`npx prisma studio`) の使用を推奨します。モデル名をそのまま使用でき、SQL の書き換えが不要です。

---

## 目次

1. [Phase 4: Stripe Webhook Manual Validation](#phase-4-stripe-webhook-manual-validation)
   - [4.1 事前準備](#41-事前準備)
   - [4.2 Stripe CLI セットアップ](#42-stripe-cli-セットアップ)
   - [4.3 Webhook フォワーディング設定](#43-webhook-フォワーディング設定)
   - [4.4 イベントトリガーと検証](#44-イベントトリガーと検証)
   - [4.5 トラブルシューティング](#45-トラブルシューティング)

2. [Phase 5: Usage Limit Manual Validation](#phase-5-usage-limit-manual-validation)
   - [5.1 事前準備 (テストユーザー作成)](#51-事前準備-テストユーザー作成)
   - [5.2 NextAuth Session Token 取得](#52-nextauth-session-token-取得)
   - [5.3 認証テスト (401 Unauthorized)](#53-認証テスト-401-unauthorized)
   - [5.4 FREE Plan 制限テスト (403 Forbidden)](#54-free-plan-制限テスト-403-forbidden)
   - [5.5 PRO Plan 制限テスト (403 Forbidden)](#55-pro-plan-制限テスト-403-forbidden)
   - [5.6 月間制限超過テスト (429 Too Many Requests)](#56-月間制限超過テスト-429-too-many-requests)
   - [5.7 正常な使用量記録テスト (200 OK)](#57-正常な使用量記録テスト-200-ok)
   - [5.8 Dashboard 使用量表示確認](#58-dashboard-使用量表示確認)

3. [ログ記録テンプレート](#ログ記録テンプレート)

---

## Phase 4: Stripe Webhook Manual Validation

### 4.1 事前準備

**必要なツール:**
- Stripe CLI (インストール手順は 4.2 を参照)
- Stripe アカウント (テストモード有効)
- PostgreSQL クライアント (Prisma Studio または psql)
- Node.js 20+ (npm run dev 用)

**環境変数確認:**
```bash
# .env.local に以下が設定されていることを確認
cat .env.local | grep STRIPE

# 必須:
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_WEBHOOK_SECRET=(stripe listen 実行後に設定)
```

**開発サーバー起動:**
```bash
npm run dev
# → http://localhost:3000 が起動していることを確認
```

---

### 4.2 Stripe CLI セットアップ

#### macOS

```bash
# Homebrew でインストール
brew install stripe/stripe-cli/stripe

# バージョン確認
stripe --version
```

#### Linux

```bash
# 最新版をダウンロード
curl -L https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz | tar -xz

# PATH に追加
sudo mv stripe /usr/local/bin/

# バージョン確認
stripe --version
```

#### Windows

```powershell
# Scoop を使用 (事前に Scoop をインストール)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# バージョン確認
stripe --version
```

#### Stripe アカウント認証

```bash
# Stripe アカウントにログイン
stripe login

# ブラウザが開くので、Stripe Dashboard で認証を許可
# → "Done! The Stripe CLI is configured for <account> with account id acct_xxxxx"
```

**確認:**
```bash
# 認証状態確認
stripe config --list
# → default_account = acct_xxxxx
```

---

### 4.3 Webhook フォワーディング設定

#### ローカル環境への転送

```bash
# Webhook イベントを localhost:3000/api/stripe/webhook に転送
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 出力例:
# > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
# > 2025-11-14 14:23:01   --> webhook.endpoint_created [evt_1abcd...]
```

**重要:** 出力された `whsec_...` をコピーし、`.env.local` に追加:

```bash
# .env.local に追記
echo 'STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' >> .env.local

# 開発サーバーを再起動 (環境変数を再読み込み)
# Ctrl+C で停止 → npm run dev で再起動
```

#### Cloud Run 環境への転送 (Cursor 担当)

```bash
# Cloud Run URL に転送
stripe listen --forward-to https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app/api/stripe/webhook

# → 出力された whsec_... を Secret Manager に登録
gcloud secrets create stripe-webhook-secret \
  --data-file=- \
  --project=dataanalyticsclinic \
  --replication-policy=automatic

# Cloud Run 環境変数に反映 (Terraform または手動)
gcloud run services update creative-flow-studio-dev \
  --update-secrets=STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic
```

---

### 4.4 イベントトリガーと検証

#### 4.4.1 Subscription Created (checkout.session.completed)

**目的:** チェックアウト完了時にサブスクリプションと PaymentEvent が作成されることを確認。

**実行手順:**

1. **イベントトリガー:**
   ```bash
   # 別ターミナルで実行 (stripe listen を起動したまま)
   stripe trigger checkout.session.completed
   ```

2. **stripe listen の出力確認:**
   ```
   2025-11-14 14:25:30   --> checkout.session.completed [evt_1abc...]
   2025-11-14 14:25:31  <--  [200] POST http://localhost:3000/api/stripe/webhook [evt_1abc...]
   ```

3. **アプリケーションログ確認:**
   ```bash
   # npm run dev のターミナルで以下のログを確認
   # Received Stripe webhook: checkout.session.completed (ID: evt_1abc...)
   # Creating new subscription for user: user_xxxxx
   # Subscription created: sub_xxxxx (Plan: PRO, Status: ACTIVE)
   ```

4. **データベース検証:**
   ```sql
   -- Prisma Studio または psql で実行

   -- 1. Subscription レコード確認
   SELECT id, "userId", "planId", status, "stripeSubscriptionId", "createdAt"
   FROM "Subscription"
   ORDER BY "createdAt" DESC
   LIMIT 1;

   -- 期待値:
   -- status = 'ACTIVE' または 'TRIALING'
   -- stripeSubscriptionId が設定されている

   -- 2. User の stripeCustomerId 確認
   SELECT id, email, "stripeCustomerId"
   FROM "User"
   WHERE id = '<userId>';

   -- 期待値:
   -- stripeCustomerId = 'cus_xxxxx' (設定されている)

   -- 3. PaymentEvent レコード確認
   SELECT id, "subscriptionId", type, amount, status, "stripeEventId", "createdAt"
   FROM "PaymentEvent"
   WHERE "stripeEventId" = 'evt_1abc...'
   LIMIT 1;

   -- 期待値:
   -- type = 'payment_succeeded'
   -- status = 'succeeded'
   -- subscriptionId が設定されている
   ```

5. **Cloud Run ログ確認 (Cursor 担当):**
   ```bash
   # GCP ログを取得 (過去 1 時間)
   gcloud run services logs read creative-flow-studio-dev \
     --limit=200 \
     --region=asia-northeast1 \
     --project=dataanalyticsclinic \
     --format="table(timestamp,severity,textPayload)"

   # 検索:
   # - "Received Stripe webhook: checkout.session.completed"
   # - "Subscription created: sub_xxxxx"
   ```

**期待結果:**
- ✅ stripe listen が 200 OK を返す
- ✅ Subscription レコードが作成される (status: ACTIVE または TRIALING)
- ✅ User.stripeCustomerId が設定される
- ✅ PaymentEvent レコードが作成される
- ✅ アプリケーションログに成功メッセージ

---

#### 4.4.2 Payment Failed (invoice.payment_failed)

**目的:** 支払い失敗時にサブスクリプションが PAST_DUE に更新されることを確認。

**実行手順:**

1. **イベントトリガー:**
   ```bash
   stripe trigger invoice.payment_failed
   ```

2. **stripe listen の出力確認:**
   ```
   2025-11-14 14:30:00   --> invoice.payment_failed [evt_2xyz...]
   2025-11-14 14:30:01  <--  [200] POST http://localhost:3000/api/stripe/webhook [evt_2xyz...]
   ```

3. **データベース検証:**
   ```sql
   -- Subscription ステータス更新確認
   SELECT id, "userId", status, "updatedAt"
   FROM "Subscription"
   WHERE "stripeSubscriptionId" = '<sub_id_from_previous_test>'
   ORDER BY "updatedAt" DESC
   LIMIT 1;

   -- 期待値:
   -- status = 'PAST_DUE'
   ```

4. **PaymentEvent 確認:**
   ```sql
   SELECT id, type, status, "stripeEventId", "createdAt"
   FROM "PaymentEvent"
   WHERE "stripeEventId" = 'evt_2xyz...'
   LIMIT 1;

   -- 期待値:
   -- type = 'payment_failed'
   -- status = 'failed'
   ```

**期待結果:**
- ✅ Subscription.status が PAST_DUE に更新される
- ✅ PaymentEvent (payment_failed) が作成される

---

#### 4.4.3 Subscription Canceled (customer.subscription.deleted)

**目的:** サブスクリプションキャンセル時に CANCELED ステータスになり、UsageLog が保持されることを確認。

**実行手順:**

1. **イベントトリガー:**
   ```bash
   stripe trigger customer.subscription.deleted
   ```

2. **データベース検証:**
   ```sql
   -- Subscription ステータス確認
   SELECT id, status, "updatedAt"
   FROM "Subscription"
   WHERE "stripeSubscriptionId" = '<sub_id>'
   ORDER BY "updatedAt" DESC
   LIMIT 1;

   -- 期待値:
   -- status = 'CANCELED'

   -- UsageLog 保持確認
   SELECT COUNT(*) AS usage_log_count
   FROM "UsageLog"
   WHERE "userId" = '<userId>';

   -- 期待値:
   -- usage_log_count > 0 (削除されていない)
   ```

**期待結果:**
- ✅ Subscription.status が CANCELED に更新される
- ✅ UsageLog レコードは削除されない (CASCADE 制約なし)

---

#### 4.4.4 Invoice Paid (invoice.paid)

**目的:** 請求書支払い時にサブスクリプション期間が更新されることを確認。

**実行手順:**

1. **イベントトリガー:**
   ```bash
   stripe trigger invoice.paid
   ```

2. **データベース検証:**
   ```sql
   SELECT id, status, "currentPeriodStart", "currentPeriodEnd", "updatedAt"
   FROM "Subscription"
   WHERE "stripeSubscriptionId" = '<sub_id>'
   ORDER BY "updatedAt" DESC
   LIMIT 1;

   -- 期待値:
   -- status = 'ACTIVE'
   -- currentPeriodStart と currentPeriodEnd が更新されている
   ```

**期待結果:**
- ✅ Subscription.status が ACTIVE
- ✅ currentPeriodStart と currentPeriodEnd が更新される

---

#### 4.4.5 Subscription Updated (customer.subscription.updated)

**目的:** サブスクリプション変更時に DB が同期されることを確認。

**実行手順:**

1. **イベントトリガー:**
   ```bash
   stripe trigger customer.subscription.updated
   ```

2. **データベース検証:**
   ```sql
   SELECT id, status, "planId", "updatedAt"
   FROM "Subscription"
   WHERE "stripeSubscriptionId" = '<sub_id>'
   ORDER BY "updatedAt" DESC
   LIMIT 1;

   -- 期待値:
   -- updatedAt が最新のタイムスタンプ
   -- status や planId が Stripe イベントと一致
   ```

**期待結果:**
- ✅ Subscription レコードが Stripe イベントと同期される

---

### 4.5 トラブルシューティング

#### 問題 1: stripe listen が 400 Bad Request を返す

**原因:** STRIPE_WEBHOOK_SECRET が正しく設定されていない

**解決策:**
```bash
# stripe listen の出力から whsec_... をコピー
# .env.local を更新
echo 'STRIPE_WEBHOOK_SECRET=whsec_新しいシークレット' >> .env.local

# npm run dev を再起動
```

#### 問題 2: "Webhook signature verification failed" エラー

**原因:** 署名検証が失敗している

**確認:**
```typescript
// app/api/stripe/webhook/route.ts:58-68 を確認
event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

// ログ確認:
// console.error('Webhook signature verification failed:', err.message);
```

**解決策:**
- stripe listen を再起動して新しい whsec_... を取得
- .env.local を更新して npm run dev を再起動

#### 問題 3: Subscription が作成されない

**原因:** Stripe イベントに userId が含まれていない

**確認:**
```bash
# stripe trigger のイベントペイロードを確認
stripe events list --limit=1
```

**解決策:**
- テストモードで実際の Checkout Session を作成してテスト
- または、Stripe Dashboard で手動で Subscription を作成

---

## Phase 5: Usage Limit Manual Validation

### 5.1 事前準備 (テストユーザー作成)

**目的:** 各プラン (FREE/PRO/ENTERPRISE) のテストユーザーを作成し、サブスクリプションを設定する。

**⚠️ 重要:** Subscription.planId は Plan.id (cuid) を参照します。Plan.name ではありません。

**データベース操作:**

```sql
-- Prisma Studio または psql で実行
-- ⚠️ psql 使用時はテーブル名を @@map で指定された名前に変更してください
--    例: "User" → "users", "Subscription" → "subscriptions", "Plan" → "plans"

-- 0. Plan レコードの ID を取得 (事前確認)
SELECT id, name, "maxRequestsPerMonth"
FROM "plans"  -- psql 使用時
-- FROM "Plan"  -- Prisma Studio 使用時はこちら
WHERE name IN ('FREE', 'PRO', 'ENTERPRISE')
ORDER BY name;

-- 期待結果 (例):
-- clxxxxxx1 | FREE       | 100
-- clxxxxxx2 | PRO        | 1000
-- clxxxxxx3 | ENTERPRISE | NULL

-- 上記の Plan.id をメモしておく (以下の INSERT で使用)

-- 1. FREE プランユーザー作成
INSERT INTO "User" (id, email, name, "emailVerified", image)
VALUES ('user_free_test', 'free@example.com', 'Free User', NOW(), NULL);

-- FREE プラン Subscription 作成
-- ⚠️ planId には Plan レコードの id (cuid) を指定すること
INSERT INTO "Subscription" (id, "userId", "planId", status, "stripeCustomerId", "stripeSubscriptionId", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd")
VALUES (
  'sub_free_test',
  'user_free_test',
  'clxxxxxx1',  -- ← 上記で取得した FREE Plan の id に置き換える
  'ACTIVE',
  'cus_free_test',
  'sub_stripe_free_test',
  NOW(),
  NOW() + INTERVAL '1 month',
  false
);

-- 2. PRO プランユーザー作成
INSERT INTO "User" (id, email, name, "emailVerified", image)
VALUES ('user_pro_test', 'pro@example.com', 'Pro User', NOW(), NULL);

INSERT INTO "Subscription" (id, "userId", "planId", status, "stripeCustomerId", "stripeSubscriptionId", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd")
VALUES (
  'sub_pro_test',
  'user_pro_test',
  'clxxxxxx2',  -- ← 上記で取得した PRO Plan の id に置き換える
  'ACTIVE',
  'cus_pro_test',
  'sub_stripe_pro_test',
  NOW(),
  NOW() + INTERVAL '1 month',
  false
);

-- 3. ENTERPRISE プランユーザー作成
INSERT INTO "User" (id, email, name, "emailVerified", image)
VALUES ('user_enterprise_test', 'enterprise@example.com', 'Enterprise User', NOW(), NULL);

INSERT INTO "Subscription" (id, "userId", "planId", status, "stripeCustomerId", "stripeSubscriptionId", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd")
VALUES (
  'sub_enterprise_test',
  'user_enterprise_test',
  'clxxxxxx3',  -- ← 上記で取得した ENTERPRISE Plan の id に置き換える
  'ACTIVE',
  'cus_enterprise_test',
  'sub_stripe_enterprise_test',
  NOW(),
  NOW() + INTERVAL '1 month',
  false
);

-- 確認
SELECT u.id, u.email, s."planId", s.status, p.name AS plan_name, p."maxRequestsPerMonth"
FROM "User" u
LEFT JOIN "Subscription" s ON s."userId" = u.id
LEFT JOIN "Plan" p ON p.id = s."planId"
WHERE u.email IN ('free@example.com', 'pro@example.com', 'enterprise@example.com');
```

**期待結果 (planId は cuid 形式):**
```
user_free_test       | free@example.com       | clxxxxxx1 | ACTIVE | FREE       | 100
user_pro_test        | pro@example.com        | clxxxxxx2 | ACTIVE | PRO        | 1000
user_enterprise_test | enterprise@example.com | clxxxxxx3 | ACTIVE | ENTERPRISE | NULL (unlimited)
```

**Plan レコードが存在しない場合:**

Prisma seed または初期マイグレーションで Plan レコードが作成されていない場合は、以下の SQL で作成:

```sql
-- Plan レコード作成 (存在しない場合のみ)
INSERT INTO "Plan" (id, name, "monthlyPrice", features, "maxRequestsPerMonth", "maxFileSize", "stripePriceId")
VALUES
  (gen_random_uuid(), 'FREE', 0, '{"allowProMode": false, "allowImageGeneration": false, "allowVideoGeneration": false}'::jsonb, 100, 5242880, NULL),
  (gen_random_uuid(), 'PRO', 1500, '{"allowProMode": true, "allowImageGeneration": true, "allowVideoGeneration": false}'::jsonb, 1000, 52428800, 'price_pro_test'),
  (gen_random_uuid(), 'ENTERPRISE', 5000, '{"allowProMode": true, "allowImageGeneration": true, "allowVideoGeneration": true}'::jsonb, NULL, 104857600, 'price_enterprise_test')
ON CONFLICT (name) DO NOTHING;

-- 作成後、再度 ID を取得
SELECT id, name FROM "Plan" ORDER BY name;
```

---

### 5.2 NextAuth Session Token 取得

**目的:** 各テストユーザーの NextAuth session token を取得し、curl コマンドで使用する。

**手順 (ブラウザ操作):**

1. **開発サーバー起動:**
   ```bash
   npm run dev
   # → http://localhost:3000
   ```

2. **Google OAuth ログイン:**
   - ブラウザで http://localhost:3000 を開く
   - 「ログイン」ボタンをクリック
   - Google アカウントでログイン (テストユーザーのメールアドレスを使用)
     - **注意:** NextAuth は Google OAuth を使用しているため、テストユーザーのメールアドレスが Google アカウントと一致している必要があります。
     - または、`app/api/auth/[...nextauth]/route.ts` で Credentials Provider を一時的に追加してテスト用ログインを可能にする。

3. **Session Token 取得:**
   - ブラウザで **DevTools を開く** (F12 または Cmd+Option+I)
   - **Application** タブ → **Cookies** → `http://localhost:3000`
   - **next-auth.session-token** の **Value** をコピー

4. **Cookie ヘッダー作成:**
   ```bash
   # コピーしたトークンを使用
   export FREE_USER_COOKIE="next-auth.session-token=<コピーしたトークン>"
   export PRO_USER_COOKIE="next-auth.session-token=<コピーしたトークン>"
   export ENTERPRISE_USER_COOKIE="next-auth.session-token=<コピーしたトークン>"
   ```

**代替手段 (Credentials Provider 追加):**

開発環境でのテストを簡単にするため、一時的に Credentials Provider を追加:

```typescript
// app/api/auth/[...nextauth]/route.ts (一時的な変更)
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // 開発環境のみ有効
    ...(process.env.NODE_ENV === 'development'
      ? [
          CredentialsProvider({
            name: 'Credentials',
            credentials: {
              email: { label: "Email", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;

              // テストユーザーのみ許可
              const testEmails = ['free@example.com', 'pro@example.com', 'enterprise@example.com'];
              if (!testEmails.includes(credentials.email)) return null;

              const user = await prisma.user.findUnique({
                where: { email: credentials.email },
              });

              return user ? { id: user.id, email: user.email, name: user.name } : null;
            },
          }),
        ]
      : []),
  ],
  // ... rest of config
};
```

これにより、ログイン画面で Email だけで認証できるようになります。

---

### 5.3 認証テスト (401 Unauthorized)

**目的:** NextAuth session なしでリクエストすると 401 が返ることを確認。

**実行手順:**

1. **Chat API テスト:**
   ```bash
   curl -i -X POST http://localhost:3000/api/gemini/chat \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "Test without auth",
       "mode": "chat",
       "history": []
     }'
   ```

2. **期待レスポンス:**
   ```
   HTTP/1.1 401 Unauthorized
   Content-Type: application/json

   {"error":"Unauthorized"}
   ```

3. **Image API テスト:**
   ```bash
   curl -i -X POST http://localhost:3000/api/gemini/image \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Test image"}'
   ```

4. **期待レスポンス:**
   ```
   HTTP/1.1 401 Unauthorized

   {"error":"Unauthorized"}
   ```

5. **Video API テスト:**
   ```bash
   curl -i -X POST http://localhost:3000/api/gemini/video \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Test video"}'
   ```

6. **期待レスポンス:**
   ```
   HTTP/1.1 401 Unauthorized

   {"error":"Unauthorized"}
   ```

7. **UsageLog 確認:**
   ```sql
   -- UsageLog が作成されていないことを確認
   SELECT COUNT(*) FROM "UsageLog"
   WHERE "createdAt" > NOW() - INTERVAL '5 minutes';

   -- 期待値: 0 (認証失敗時は記録しない)
   ```

**期待結果:**
- ✅ 全ての API が 401 Unauthorized を返す
- ✅ UsageLog に記録されない

---

### 5.4 FREE Plan 制限テスト (403 Forbidden)

**目的:** FREE プランで制限されている機能 (Pro Mode, Image, Video) を使用すると 403 が返ることを確認。

#### 5.4.1 Pro Mode 制限

```bash
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: $FREE_USER_COOKIE" \
  -d '{
    "prompt": "Analyze this problem",
    "mode": "pro",
    "history": []
  }'
```

**期待レスポンス:**
```
HTTP/1.1 403 Forbidden

{"error":"Pro Mode not available in current plan"}
```

#### 5.4.2 Image Generation 制限

```bash
curl -i -X POST http://localhost:3000/api/gemini/image \
  -H "Content-Type: application/json" \
  -H "Cookie: $FREE_USER_COOKIE" \
  -d '{
    "prompt": "A beautiful sunset",
    "aspectRatio": "16:9"
  }'
```

**期待レスポンス:**
```
HTTP/1.1 403 Forbidden

{"error":"Image generation not available in current plan"}
```

#### 5.4.3 Video Generation 制限

```bash
curl -i -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -H "Cookie: $FREE_USER_COOKIE" \
  -d '{
    "prompt": "A cat playing piano",
    "aspectRatio": "16:9"
  }'
```

**期待レスポンス:**
```
HTTP/1.1 403 Forbidden

{"error":"Video generation not available in current plan"}
```

**UsageLog 確認:**
```sql
-- 403 エラー時は UsageLog が作成されないことを確認
SELECT * FROM "UsageLog"
WHERE "userId" = 'user_free_test'
  AND "createdAt" > NOW() - INTERVAL '5 minutes';

-- 期待値: 0 件 (制限エラー時は記録しない)
```

**期待結果:**
- ✅ Pro Mode: 403 Forbidden
- ✅ Image Generation: 403 Forbidden
- ✅ Video Generation: 403 Forbidden
- ✅ UsageLog に記録されない

---

### 5.5 PRO Plan 制限テスト (403 Forbidden)

**目的:** PRO プランでは Video Generation が制限されることを確認 (ENTERPRISE のみ)。

#### 5.5.1 Video Generation 制限 (PRO → ENTERPRISE Only)

```bash
curl -i -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -H "Cookie: $PRO_USER_COOKIE" \
  -d '{
    "prompt": "A cat playing piano",
    "aspectRatio": "16:9"
  }'
```

**期待レスポンス:**
```
HTTP/1.1 403 Forbidden

{"error":"Video generation not available in current plan"}
```

#### 5.5.2 Pro Mode / Image Generation は許可される

```bash
# Pro Mode (PRO プランで許可)
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: $PRO_USER_COOKIE" \
  -d '{
    "prompt": "Analyze this problem",
    "mode": "pro",
    "history": []
  }'

# 期待: 200 OK (実際に Gemini API を呼び出すため GEMINI_API_KEY が必要)

# Image Generation (PRO プランで許可)
curl -i -X POST http://localhost:3000/api/gemini/image \
  -H "Content-Type: application/json" \
  -H "Cookie: $PRO_USER_COOKIE" \
  -d '{
    "prompt": "A beautiful sunset",
    "aspectRatio": "16:9"
  }'

# 期待: 200 OK (実際に Gemini API を呼び出すため GEMINI_API_KEY が必要)
```

**期待結果:**
- ✅ Video Generation: 403 Forbidden (ENTERPRISE のみ)
- ✅ Pro Mode / Image Generation: 200 OK (PRO で許可)

---

### 5.6 月間制限超過テスト (429 Too Many Requests)

**目的:** 月間リクエスト上限を超えると 429 が返り、Retry-After ヘッダーが設定されることを確認。

#### 5.6.1 FREE Plan (100 req/month) 制限超過

**事前準備: UsageLog に 100 件挿入**

```sql
-- FREE ユーザーの今月の UsageLog を 100 件作成
INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
SELECT
  gen_random_uuid(),
  'user_free_test',
  'chat',
  '{"resourceType": "gemini-2.5-flash", "mode": "chat"}'::jsonb,
  NOW()
FROM generate_series(1, 100);

-- 確認
SELECT COUNT(*) FROM "UsageLog"
WHERE "userId" = 'user_free_test'
  AND "createdAt" >= date_trunc('month', NOW());

-- 期待値: 100
```

**101 回目のリクエスト:**

```bash
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: $FREE_USER_COOKIE" \
  -d '{
    "prompt": "101st request",
    "mode": "chat",
    "history": []
  }'
```

**期待レスポンス:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 86400
Content-Type: application/json

{"error":"Monthly request limit exceeded"}
```

**UsageLog 確認:**
```sql
-- 101 回目のリクエストは記録されないことを確認
SELECT COUNT(*) FROM "UsageLog"
WHERE "userId" = 'user_free_test'
  AND "createdAt" >= date_trunc('month', NOW());

-- 期待値: 100 (429 エラー時は記録しない)
```

#### 5.6.2 PRO Plan (1000 req/month) 制限超過

**事前準備: UsageLog に 1000 件挿入**

```sql
-- PRO ユーザーの今月の UsageLog を 1000 件作成
INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
SELECT
  gen_random_uuid(),
  'user_pro_test',
  'image_generation',
  '{"resourceType": "imagen-4.0", "aspectRatio": "1:1"}'::jsonb,
  NOW()
FROM generate_series(1, 1000);

-- 確認
SELECT COUNT(*) FROM "UsageLog"
WHERE "userId" = 'user_pro_test'
  AND "createdAt" >= date_trunc('month', NOW());

-- 期待値: 1000
```

**1001 回目のリクエスト:**

```bash
curl -i -X POST http://localhost:3000/api/gemini/image \
  -H "Content-Type: application/json" \
  -H "Cookie: $PRO_USER_COOKIE" \
  -d '{
    "prompt": "1001st request",
    "aspectRatio": "1:1"
  }'
```

**期待レスポンス:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 86400

{"error":"Monthly request limit exceeded"}
```

**期待結果:**
- ✅ HTTP Status: 429 Too Many Requests
- ✅ Response Headers: Retry-After: 86400 (24 hours)
- ✅ UsageLog に記録されない (上限超過時)

---

### 5.7 正常な使用量記録テスト (200 OK)

**目的:** 上限内のリクエストが正常に処理され、UsageLog が記録されることを確認。

**事前準備: UsageLog をクリア**

```sql
-- テストユーザーの UsageLog を削除 (今月分のみ)
DELETE FROM "UsageLog"
WHERE "userId" IN ('user_free_test', 'user_pro_test', 'user_enterprise_test')
  AND "createdAt" >= date_trunc('month', NOW());
```

#### 5.7.1 FREE Plan - Chat Mode (許可)

```bash
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: $FREE_USER_COOKIE" \
  -d '{
    "prompt": "Hello AI",
    "mode": "chat",
    "history": []
  }'
```

**期待レスポンス:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "result": {
    "text": "<Gemini からの応答>",
    "role": "model"
  }
}
```

**UsageLog 確認:**
```sql
SELECT id, "userId", action, metadata, "createdAt"
FROM "UsageLog"
WHERE "userId" = 'user_free_test'
ORDER BY "createdAt" DESC
LIMIT 1;

-- 期待値:
-- action = 'chat'
-- metadata.resourceType = 'gemini-2.5-flash'
-- metadata.mode = 'chat'
```

#### 5.7.2 PRO Plan - Pro Mode (許可)

```bash
curl -i -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: $PRO_USER_COOKIE" \
  -d '{
    "prompt": "Analyze this complex problem",
    "mode": "pro",
    "history": []
  }'
```

**期待レスポンス:**
```
HTTP/1.1 200 OK

{
  "result": {
    "text": "<Gemini Pro からの応答>",
    "role": "model"
  }
}
```

**UsageLog 確認:**
```sql
SELECT id, "userId", action, metadata, "createdAt"
FROM "UsageLog"
WHERE "userId" = 'user_pro_test'
ORDER BY "createdAt" DESC
LIMIT 1;

-- 期待値:
-- action = 'pro_mode'
-- metadata.resourceType = 'gemini-2.5-pro'
-- metadata.mode = 'pro'
```

#### 5.7.3 ENTERPRISE Plan - Video Generation (許可)

```bash
curl -i -X POST http://localhost:3000/api/gemini/video \
  -H "Content-Type: application/json" \
  -H "Cookie: $ENTERPRISE_USER_COOKIE" \
  -d '{
    "prompt": "A cat playing piano",
    "aspectRatio": "16:9"
  }'
```

**期待レスポンス:**
```
HTTP/1.1 200 OK

{
  "result": {
    "operationName": "projects/.../operations/..."
  }
}
```

**UsageLog 確認:**
```sql
SELECT id, "userId", action, metadata, "createdAt"
FROM "UsageLog"
WHERE "userId" = 'user_enterprise_test'
ORDER BY "createdAt" DESC
LIMIT 1;

-- 期待値:
-- action = 'video_generation'
-- metadata.resourceType = 'veo-3.1-fast'
-- metadata.aspectRatio = '16:9'
```

**期待結果:**
- ✅ 全ての API が 200 OK を返す
- ✅ UsageLog が正しく記録される (action, resourceType, mode/aspectRatio)
- ✅ Gemini API から実際のレスポンスが返される

**注意:** 実際に Gemini API を呼び出すため、`.env.local` に `GEMINI_API_KEY` が設定されている必要があります。

---

### 5.8 Dashboard 使用量表示確認

**目的:** `/dashboard` ページで使用量メーターが正しく表示されることを確認。

**手順:**

1. **PRO ユーザーで 500 件の UsageLog を作成:**
   ```sql
   -- PRO ユーザーの UsageLog を 500 件作成
   INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
   SELECT
     gen_random_uuid(),
     'user_pro_test',
     'chat',
     '{"resourceType": "gemini-2.5-flash", "mode": "chat"}'::jsonb,
     NOW()
   FROM generate_series(1, 500);
   ```

2. **ブラウザで `/dashboard` にアクセス:**
   - PRO ユーザーでログイン (Cookie を使用)
   - http://localhost:3000/dashboard を開く

3. **確認項目:**
   - ✅ **Current Plan**: "PRO" と表示される
   - ✅ **Usage Count**: "500 / 1,000" と表示される
   - ✅ **Usage Percentage**: "50%" と表示される
   - ✅ **Progress Bar**: 緑色 (< 80%)
   - ✅ **Billing Period**: 現在の月 (e.g., "2025-11-01 ~ 2025-11-30")
   - ✅ **Next Billing Date**: 翌月 1 日 (e.g., "2025-12-01")

4. **使用量 80% 超過の確認:**
   ```sql
   -- PRO ユーザーの UsageLog を 900 件に増やす (追加 400 件)
   INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
   SELECT
     gen_random_uuid(),
     'user_pro_test',
     'chat',
     '{"resourceType": "gemini-2.5-flash", "mode": "chat"}'::jsonb,
     NOW()
   FROM generate_series(1, 400);
   ```

   - ダッシュボードをリフレッシュ
   - ✅ **Usage Count**: "900 / 1,000"
   - ✅ **Usage Percentage**: "90%"
   - ✅ **Progress Bar**: 黄色 (≥ 80%, < 100%)

5. **使用量 100% の確認:**
   ```sql
   -- PRO ユーザーの UsageLog を 1000 件に増やす (追加 100 件)
   INSERT INTO "UsageLog" (id, "userId", action, metadata, "createdAt")
   SELECT
     gen_random_uuid(),
     'user_pro_test',
     'chat',
     '{"resourceType": "gemini-2.5-flash", "mode": "chat"}'::jsonb,
     NOW()
   FROM generate_series(1, 100);
   ```

   - ダッシュボードをリフレッシュ
   - ✅ **Usage Count**: "1,000 / 1,000"
   - ✅ **Usage Percentage**: "100%"
   - ✅ **Progress Bar**: 赤色 (≥ 100%)
   - ✅ **警告メッセージ**: "月間リクエスト上限に達しました" など

**期待結果:**
- ✅ 使用量が正確に表示される
- ✅ プログレスバーの色が使用率に応じて変化する (緑→黄→赤)
- ✅ 上限到達時に警告が表示される

---

## ログ記録テンプレート

**目的:** 手動 QA の実施結果を `docs/handoff-2025-11-13.md` に追記するためのテンプレート。

### テンプレート 1: Stripe Webhook テスト

```markdown
### Stripe Webhook テスト結果

- **テスト日**: 2025-11-14
  **実施者**: <Cursor または 開発者名>
  **環境**: <ローカル (localhost:3000) または Cloud Run>

#### checkout.session.completed

| 項目 | 記録 |
| --- | --- |
| コマンド | `stripe trigger checkout.session.completed` |
| Stripe CLI ログ | `→ checkout.session.completed [evt_xxx]` (200 OK) |
| アプリケーションログ | "Subscription created: sub_xxx (Plan: PRO, Status: ACTIVE)" |
| DB 確認 (Subscription) | id: sub_xxx, status: ACTIVE, stripeSubscriptionId: sub_stripe_xxx |
| DB 確認 (User) | stripeCustomerId: cus_xxx |
| DB 確認 (PaymentEvent) | type: payment_succeeded, status: succeeded, stripeEventId: evt_xxx |
| Cloud Run ログ | <gcloud コマンド結果 または "N/A (ローカル)"> |
| 結果 | ✅ 成功 / ❌ 失敗 (理由: ...) |

#### invoice.payment_failed

| 項目 | 記録 |
| --- | --- |
| コマンド | `stripe trigger invoice.payment_failed` |
| Subscription status 変更 | ACTIVE → PAST_DUE |
| PaymentEvent 作成 | type: payment_failed, status: failed |
| 結果 | ✅ 成功 / ❌ 失敗 |

#### customer.subscription.deleted

| 項目 | 記録 |
| --- | --- |
| コマンド | `stripe trigger customer.subscription.deleted` |
| Subscription status 変更 | ACTIVE → CANCELED |
| UsageLog 保持確認 | COUNT(*) = <件数> (削除されていない) |
| 結果 | ✅ 成功 / ❌ 失敗 |

#### invoice.paid

| 項目 | 記録 |
| --- | --- |
| コマンド | `stripe trigger invoice.paid` |
| Subscription 期間更新 | currentPeriodStart: <日時>, currentPeriodEnd: <日時> |
| 結果 | ✅ 成功 / ❌ 失敗 |

#### customer.subscription.updated

| 項目 | 記録 |
| --- | --- |
| コマンド | `stripe trigger customer.subscription.updated` |
| Subscription updatedAt | <最新タイムスタンプ> |
| 結果 | ✅ 成功 / ❌ 失敗 |
```

### テンプレート 2: Usage Limit テスト

```markdown
### Usage Limit テスト結果

- **テスト日**: 2025-11-14
  **実施者**: <Cursor または 開発者名>
  **環境**: <ローカル (localhost:3000) または Cloud Run>

#### 401 Unauthorized (認証なし)

| API | HTTP Status | Response Body | UsageLog 記録 | 結果 |
| --- | --- | --- | --- | --- |
| Chat API | 401 | `{"error":"Unauthorized"}` | 0 件 | ✅ 成功 |
| Image API | 401 | `{"error":"Unauthorized"}` | 0 件 | ✅ 成功 |
| Video API | 401 | `{"error":"Unauthorized"}` | 0 件 | ✅ 成功 |

#### 403 Forbidden (FREE Plan 制限)

| 機能 | HTTP Status | Response Body | UsageLog 記録 | 結果 |
| --- | --- | --- | --- | --- |
| Pro Mode | 403 | `{"error":"Pro Mode not available in current plan"}` | 0 件 | ✅ 成功 |
| Image Generation | 403 | `{"error":"Image generation not available in current plan"}` | 0 件 | ✅ 成功 |
| Video Generation | 403 | `{"error":"Video generation not available in current plan"}` | 0 件 | ✅ 成功 |

#### 403 Forbidden (PRO Plan 制限)

| 機能 | HTTP Status | Response Body | UsageLog 記録 | 結果 |
| --- | --- | --- | --- | --- |
| Video Generation | 403 | `{"error":"Video generation not available in current plan"}` | 0 件 | ✅ 成功 |

#### 429 Too Many Requests (月間制限超過)

| プラン | 上限 | 現在の使用量 | HTTP Status | Retry-After | UsageLog 記録 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| FREE | 100 | 100 | 429 | 86400 | 100 件 (変化なし) | ✅ 成功 |
| PRO | 1000 | 1000 | 429 | 86400 | 1000 件 (変化なし) | ✅ 成功 |

#### 200 OK (正常な使用量記録)

| プラン | 機能 | HTTP Status | action | resourceType | UsageLog 件数 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| FREE | Chat Mode | 200 | chat | gemini-2.5-flash | 1 件 | ✅ 成功 |
| PRO | Pro Mode | 200 | pro_mode | gemini-2.5-pro | 1 件 | ✅ 成功 |
| ENTERPRISE | Video Generation | 200 | video_generation | veo-3.1-fast | 1 件 | ✅ 成功 |

#### Dashboard 使用量表示

| プラン | 使用量 | 上限 | 使用率 | プログレスバー色 | 結果 |
| --- | --- | --- | --- | --- | --- |
| PRO | 500 | 1000 | 50% | 緑色 | ✅ 成功 |
| PRO | 900 | 1000 | 90% | 黄色 | ✅ 成功 |
| PRO | 1000 | 1000 | 100% | 赤色 | ✅ 成功 |
```

### テンプレート 3: Cloud Run ログ取得 (Cursor 担当)

```markdown
### Cloud Run ログ

- **取得日時**: 2025-11-14 15:00 JST
  **対象サービス**: creative-flow-studio-dev
  **期間**: 過去 1 時間

```bash
# GCP ログ取得コマンド
gcloud run services logs read creative-flow-studio-dev \
  --limit=200 \
  --region=asia-northeast1 \
  --project=dataanalyticsclinic \
  --format="table(timestamp,severity,textPayload)"

# 出力 (抜粋):
# 2025-11-14 14:50:30  INFO  Received Stripe webhook: checkout.session.completed (ID: evt_xxx)
# 2025-11-14 14:50:31  INFO  Subscription created: sub_xxx (Plan: PRO, Status: ACTIVE)
# 2025-11-14 14:52:15  INFO  Received Stripe webhook: invoice.payment_failed (ID: evt_yyy)
# 2025-11-14 14:52:16  INFO  Subscription status updated to PAST_DUE: sub_xxx
```

### UsageLog 差分

```sql
-- テスト実施前の UsageLog 件数
SELECT "userId", COUNT(*) AS count_before
FROM "usage_logs"  -- psql 使用時
-- FROM "UsageLog"  -- Prisma Studio 使用時はこちら
WHERE "createdAt" >= date_trunc('month', NOW())
GROUP BY "userId";

-- テスト実施後の UsageLog 件数
SELECT "userId", COUNT(*) AS count_after
FROM "usage_logs"  -- psql 使用時
-- FROM "UsageLog"  -- Prisma Studio 使用時はこちら
WHERE "createdAt" >= date_trunc('month', NOW())
GROUP BY "userId";

-- 差分:
-- user_free_test: 0 → 1 (+1)
-- user_pro_test: 0 → 2 (+2)
-- user_enterprise_test: 0 → 1 (+1)
```
```

---

## Cursor 向け事前確認チェックリスト

**Phase 4/5 の QA 実施前に以下を確認してください:**

### ✅ Stripe CLI 準備

- [ ] **Stripe CLI インストール済み**
  ```bash
  stripe --version
  # → Stripe CLI 1.x.x 以降
  ```

- [ ] **Stripe アカウント認証済み**
  ```bash
  stripe config --list
  # → default_account = acct_xxxxx (テストモードアカウント)
  ```

- [ ] **Cloud Run への Webhook フォワーディング可能**
  ```bash
  # テスト実行コマンド (実際に起動はしないこと)
  stripe listen --forward-to https://creative-flow-studio-dev-667780715339.asia-northeast1.run.app/api/stripe/webhook --version
  # → エラーが出ないことを確認
  ```

### ✅ Plan レコード確認

- [ ] **Plan レコードが存在するか確認**
  ```sql
  -- Prisma Studio または psql で実行
  SELECT id, name, "maxRequestsPerMonth" FROM "plans" ORDER BY name;

  -- 期待: FREE, PRO, ENTERPRISE の 3 レコード
  ```

- [ ] **Plan レコードが存在しない場合は作成**
  - 手順: 5.1 の「Plan レコードが存在しない場合」セクション参照

### ✅ Secret Manager 確認

- [ ] **STRIPE_WEBHOOK_SECRET が Secret Manager に登録済み (version 3)**
  ```bash
  gcloud secrets versions list stripe-webhook-secret \
    --project=dataanalyticsclinic \
    --limit=5

  # → version 3 が enabled 状態であることを確認
  ```

- [ ] **Cloud Run が Secret Manager version 3 を参照している**
  ```bash
  gcloud run services describe creative-flow-studio-dev \
    --region=asia-northeast1 \
    --project=dataanalyticsclinic \
    --format="value(spec.template.spec.containers[0].env)"

  # → STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:3 または :latest
  ```

### ✅ GCP ログ取得権限

- [ ] **Cloud Run ログ取得可能**
  ```bash
  gcloud run services logs read creative-flow-studio-dev \
    --region=asia-northeast1 \
    --project=dataanalyticsclinic \
    --limit=5

  # → エラーが出ず、ログが表示されること
  ```

### ✅ データベースアクセス

- [ ] **PostgreSQL への接続可能**
  - Prisma Studio: `npx prisma studio` でアクセス可能か
  - または psql: Cloud SQL Proxy 経由で接続可能か

- [ ] **テストユーザー作成の準備完了**
  - Google OAuth の制約により、Credentials Provider を追加するか確認
  - または、既存ユーザーを使用するか確認

### ✅ 実施タイミング確認

- [ ] **Phase 4/5 QA 実施日**: 2025-11-14 (予定)
- [ ] **Stripe Webhook Secret ローテーション手順の具体化**: 2025-11-15 (予定)
- [ ] **Terraform import 実施**: 2025-11-18 (予定)

**すべてのチェックが完了したら、Phase 4/5 の QA 実施を開始してください。**

---

## まとめ

このドキュメントに従って Phase 4 と Phase 5 の手動 QA を実施し、結果を `docs/handoff-2025-11-13.md` に追記してください。

**Cursor への依頼事項:**
1. Cloud Run 環境で Stripe Webhook テストを実施
2. GCP ログ (`gcloud run services logs read`) を取得し、handoff に記録
3. Stripe Webhook Secret の Secret Manager 運用案を具体化
4. Terraform import 計画を実施し、差分確認結果を handoff に反映

**質問・確認事項:**
- Stripe CLI のインストールや認証で問題が発生した場合は、トラブルシューティングセクションを参照してください。
- テストユーザーの作成で Google OAuth との整合性が取れない場合は、Credentials Provider の追加を検討してください。
- 実際の Gemini API 呼び出しでエラーが発生する場合は、`.env.local` の `GEMINI_API_KEY` を確認してください。

**次のステップ:**
- [ ] Phase 4: Stripe Webhook テスト実施
- [ ] Phase 5: Usage Limit テスト実施
- [ ] テスト結果を `docs/handoff-2025-11-13.md` に追記
- [ ] Stripe Webhook Secret 運用案の具体化
- [ ] Terraform import 計画の実施
