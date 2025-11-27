# Dev環境 実働テスト手順書

**最終更新:** 2025-11-13  
**対象環境:** ローカル開発環境（`npm run dev`）  
**目的:** Admin・Enterprise ユーザー向けの実働テストを実施し、本番デプロイ前に動作確認を行う

---

## 前提条件

### 0. 環境情報（dev）

- 開発環境 URL: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/`
- 管理画面 URL: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/admin`
- テスト用アカウント（例／実際のID・PWはチームで共有されたものをセット）
  - 管理者: `admin@example.com` / `*****`
  - エンタープライズユーザー: `enterprise@example.com` / `*****`
  - ※ Google OAuth ログイン用のテストアカウントを用意し、認証後に `scripts/grant-admin-role.sql` で ADMIN 権限を付与してください。パスワード等のシークレットはリポジトリに記載しないこと。

### 1. 環境変数の設定

`.env.local` に以下のテスト用キーを設定：

```bash
# Google OAuth (テスト用)
GOOGLE_CLIENT_ID="your-test-client-id"
GOOGLE_CLIENT_SECRET="your-test-client-secret"

# Stripe (テストモード)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # stripe listen 実行後に取得
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# その他
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."  # openssl rand -base64 32
GEMINI_API_KEY="..."
```

### 2. Stripe Price ID の設定

1. [Stripe Dashboard](https://dashboard.stripe.com/test/products) にログイン（テストモード）
2. **Products** → **Pricing** で以下を作成：
   - **PRO Plan**: 月額 ¥1,980 の Price を作成 → Price ID をコピー（例: `price_test_xxxxx`）
   - **ENTERPRISE Plan**: 月額 ¥9,800 の Price を作成 → Price ID をコピー（例: `price_test_yyyyy`）

3. `prisma/seed.sql` の Price ID プレースホルダーを置き換え：

```sql
-- prisma/seed.sql を編集
UPDATE "plans" SET "stripePriceId" = 'price_test_YOUR_PRO_ID' WHERE name = 'PRO';
UPDATE "plans" SET "stripePriceId" = 'price_test_YOUR_ENTERPRISE_ID' WHERE name = 'ENTERPRISE';
```

または、seed.sql を直接編集してから再実行：

```bash
# seed.sql を編集後
psql $DATABASE_URL -f prisma/seed.sql
```

### 3. データベースの初期化

```bash
# Prisma マイグレーション
npx prisma migrate dev

# シードデータ投入
psql $DATABASE_URL -f prisma/seed.sql
```

### 4. 開発サーバーの起動

```bash
npm run dev
# → http://localhost:3000 が起動
```

---

## テスト手順

### ステップ 1: Google OAuth ログイン（通常ユーザー）

1. ブラウザで `http://localhost:3000` を開く
2. **「ログイン」** をクリック
3. Google アカウントでログイン（Enterprise ユーザー用のアカウント）
4. ログイン後、ダッシュボードが表示されることを確認

**確認ポイント:**
- ✅ ログインが成功し、ユーザー情報が表示される
- ✅ 現在のプランが「FREE」と表示される

---

### ステップ 2: Stripe Checkout で Enterprise プラン購入

1. **Pricing ページ** (`/pricing`) に移動
2. **ENTERPRISE プラン** の「購入」ボタンをクリック
3. Stripe Checkout ページが開くことを確認

**別ターミナルで Stripe CLI を起動:**

```bash
# Stripe Webhook をフォワーディング
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 出力された webhook secret を .env.local に設定
# STRIPE_WEBHOOK_SECRET="whsec_..."
```

4. Stripe Checkout でテストカード情報を入力：
   - **カード番号:** `4242 4242 4242 4242`
   - **有効期限:** 任意の未来の日付（例: `12/34`）
   - **CVC:** 任意の3桁（例: `123`）
   - **郵便番号:** 任意（例: `12345`）

5. **「購入」** をクリック

**確認ポイント:**
- ✅ Checkout が成功し、ダッシュボードにリダイレクトされる
- ✅ Stripe CLI のログに `checkout.session.completed` イベントが表示される
- ✅ ダッシュボードに「ENTERPRISE」プランが表示される
- ✅ データベースで Subscription レコードが作成されている

**データベース確認:**

```sql
SELECT u.email, p.name AS plan_name, s.status, s."stripeSubscriptionId"
FROM "users" u
JOIN "subscriptions" s ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
WHERE u.email = 'your-enterprise-user@example.com';
```

---

### ステップ 3: Chat → 画像生成 → 画像編集 → 動画生成

#### 3.1 チャット（テキスト生成）

1. メインページ (`/`) で **「チャットモード」** を選択
2. プロンプトを入力（例: `「こんにちは、今日の天気について教えてください」`）
3. **送信** をクリック
4. レスポンスが表示されることを確認

**確認ポイント:**
- ✅ メッセージが送信され、AI レスポンスが表示される
- ✅ 会話履歴にメッセージが追加される

#### 3.2 画像生成

1. **「画像モード」** に切り替え
2. プロンプトを入力（例: `「美しい夕日の風景画」`）
3. **送信** をクリック
4. 画像が生成され、表示されることを確認

**確認ポイント:**
- ✅ 画像が生成され、画面に表示される
- ✅ `imageUrl` が正しく返却されている

#### 3.3 画像編集

1. 生成した画像をクリックして選択
2. **「編集」** ボタンをクリック
3. 編集プロンプトを入力（例: `「雲を追加してください」`）
4. **送信** をクリック
5. 編集された画像が表示されることを確認

**確認ポイント:**
- ✅ 画像編集が成功し、新しい画像が表示される
- ✅ 元の画像と編集後の画像が区別される

#### 3.4 動画生成（ポーリング → ダウンロード）

1. **「動画モード」** に切り替え
2. プロンプトを入力（例: `「猫がピアノを弾いている動画」`）
3. **送信** をクリック
4. 動画生成が開始され、`operationName` が返却されることを確認
5. ポーリングが開始され、ステータスが更新されることを確認

**確認ポイント:**
- ✅ `/api/gemini/video` が `operationName` を返す
- ✅ `/api/gemini/video/status` でポーリングが動作する
- ✅ 動画生成が完了すると、`/api/gemini/video/download` でダウンロードできる
- ✅ 動画が画面に表示される

**注意:** 動画生成には数分かかる場合があります。ポーリングのタイムアウト（10分）まで待機してください。

---

### ステップ 4: 会話履歴の復元確認

1. ブラウザを **リロード**（F5 または Cmd+R）
2. 会話履歴が表示されることを確認

**確認ポイント:**
- ✅ 以前のメッセージ（チャット、画像、動画）がすべて表示される
- ✅ `/api/conversations/[id]/messages` からメッセージが取得できる
- ✅ `Conversation.updatedAt` が正しく更新されている

**データベース確認:**

```sql
SELECT c.id, c.title, c."updatedAt", COUNT(m.id) AS message_count
FROM "conversations" c
LEFT JOIN "messages" m ON m."conversationId" = c.id
WHERE c."userId" = (SELECT id FROM "users" WHERE email = 'your-enterprise-user@example.com')
GROUP BY c.id
ORDER BY c."updatedAt" DESC;
```

---

### ステップ 5: Admin ルートのアクセス確認

#### 5.1 Admin ユーザーの権限付与

**方法 A: SQL で直接更新（推奨）**

```sql
-- テスト Admin ユーザーの email を確認
SELECT id, email, role FROM "users" WHERE email = 'your-admin-user@example.com';

-- Admin 権限を付与
UPDATE "users" 
SET role = 'ADMIN' 
WHERE email = 'your-admin-user@example.com';

-- 確認
SELECT id, email, role FROM "users" WHERE email = 'your-admin-user@example.com';
```

**方法 B: Admin API を使用（既にAdmin権限がある場合）**

```bash
# Admin ユーザーでログイン後、API 経由で権限付与
curl -X PATCH http://localhost:3000/api/admin/users/{USER_ID} \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"role": "ADMIN"}'
```

#### 5.2 Admin ページへのアクセス確認

1. **Admin ユーザーでログイン**
2. `/admin` にアクセス
3. Admin ダッシュボードが表示されることを確認

**確認ポイント:**
- ✅ Admin ユーザーは `/admin` にアクセスできる
- ✅ ユーザー一覧、使用量統計が表示される

#### 5.3 通常ユーザーでのアクセス拒否確認

1. **通常ユーザー（Enterprise ユーザー）でログイン**
2. `/admin` に直接アクセス（URL を直接入力）
3. 403 Forbidden エラーが表示されることを確認

**確認ポイント:**
- ✅ 通常ユーザーは `/admin` にアクセスできない
- ✅ 403 エラーページが表示される

---

### ステップ 6: エラーハンドリング確認

#### 6.1 未ログイン時の 401 エラー

1. **ログアウト** する
2. 任意の API エンドポイントに直接アクセス（例: `/api/gemini/chat`）
3. 401 Unauthorized エラーが返ることを確認

**確認方法:**

```bash
curl -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'

# 期待されるレスポンス:
# {"error": "Unauthorized"}
```

#### 6.2 リミット超過時の 429 エラー

**FREE プランユーザーで画像生成を試行:**

1. FREE プランユーザーでログイン
2. 画像生成を試行
3. 403 Forbidden エラーが表示されることを確認（FREE プランは画像生成不可）

**月間リミット超過のシミュレーション:**

データベースで使用量を意図的に増やす：

```sql
-- テストユーザーの使用量を増やす
INSERT INTO "usage_logs" ("userId", action, "resourceType", metadata, "createdAt")
SELECT 
  u.id,
  'image_generation',
  'imagen-4.0',
  '{"test": true}'::jsonb,
  NOW()
FROM "users" u
WHERE u.email = 'your-pro-user@example.com'
LIMIT 1000;  -- PRO プランの上限（1000）を超える
```

その後、画像生成を試行：

1. PRO プランユーザーでログイン
2. 画像生成を試行
3. 429 Too Many Requests エラーが表示されることを確認

**確認ポイント:**
- ✅ エラーメッセージが UI に適切に表示される
- ✅ 429 エラーの場合、`Retry-After` ヘッダーが設定されている

---

## トラブルシューティング

### Stripe Webhook が受信されない

**原因:** Webhook secret が正しく設定されていない

**解決策:**
1. `stripe listen` を再起動
2. 出力された `whsec_...` を `.env.local` に設定
3. 開発サーバーを再起動

### 動画生成がタイムアウトする

**原因:** 動画生成に時間がかかりすぎている

**解決策:**
1. ポーリングのタイムアウト設定を確認（デフォルト: 10分）
2. Gemini API のレート制限を確認
3. より短いプロンプトで再試行

### Admin ページにアクセスできない

**原因:** ユーザーの role が ADMIN に設定されていない

**解決策:**
1. データベースで role を確認：
   ```sql
   SELECT id, email, role FROM "users" WHERE email = 'your-admin-user@example.com';
   ```
2. 必要に応じて UPDATE で ADMIN に変更

### 会話履歴が復元されない

**原因:** メッセージがデータベースに保存されていない

**解決策:**
1. ブラウザの開発者ツールで Network タブを確認
2. `/api/conversations/[id]/messages` の POST リクエストが成功しているか確認
3. データベースでメッセージが保存されているか確認：
   ```sql
   SELECT * FROM "messages" ORDER BY "createdAt" DESC LIMIT 10;
   ```

---

## テスト結果の記録

各ステップの結果を以下の形式で記録してください：

```markdown
## テスト実施日: YYYY-MM-DD

### ステップ 1: Google OAuth ログイン
- [ ] 成功
- [ ] 失敗（理由: ...）

### ステップ 2: Stripe Checkout
- [ ] 成功
- [ ] 失敗（理由: ...）

### ステップ 3: Chat → Image → Video
- [ ] Chat: 成功
- [ ] Image: 成功
- [ ] Image Edit: 成功
- [ ] Video: 成功

### ステップ 4: 会話履歴復元
- [ ] 成功
- [ ] 失敗（理由: ...）

### ステップ 5: Admin アクセス
- [ ] Admin ユーザー: 成功
- [ ] 通常ユーザー: 403 確認

### ステップ 6: エラーハンドリング
- [ ] 401: 確認
- [ ] 429: 確認
```

---

## 関連ドキュメント

- `docs/stripe-price-id-setup.md` - Stripe Price ID 設定手順
- `docs/manual-testing-procedure.md` - 詳細な手動テスト手順
- `docs/terraform-production-setup.md` - Terraform 本番環境セットアップ
