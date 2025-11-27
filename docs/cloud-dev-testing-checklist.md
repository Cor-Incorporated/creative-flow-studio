# クラウド開発環境 実働テスト チェックリスト

**最終更新:** 2025-11-17  
**対象環境:** Cloud Run (dev)  
**URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`

---

## ✅ 事前準備完了状況

### データベース設定
- [x] ENTERPRISE プランの Price ID 設定: `price_1SUPIgLi6CKW3pRawbELPocW` (¥5,000/月)
- [x] PRO プランの Price ID 設定: `price_1SUPSJLi6CKW3pRaeykWuGAE` (¥2,000/月)
- [x] FREE プランの設定確認

### Secret Manager 設定
- [x] `STRIPE_SECRET_KEY` (テストキー)
- [x] `STRIPE_WEBHOOK_SECRET` (テストキー)
- [x] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (テストキー)
- [x] `GEMINI_API_KEY`

### Cloud Run 設定
- [x] サービス URL: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`
- [x] 最新のシークレットバージョンを参照中

---

## 📋 実働テスト手順

### ステップ 1: Google OAuth ログイン

**URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`

1. ブラウザでアプリにアクセス
2. **「ログイン」** をクリック
3. Google アカウントでログイン
4. ダッシュボードが表示されることを確認

**確認ポイント:**
- [ ] ログインが成功し、ユーザー情報が表示される
- [ ] 現在のプランが「FREE」と表示される

---

### ステップ 2: Stripe Checkout で PRO プラン購入

**URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/pricing`

1. **Pricing ページ** に移動
2. **PRO プラン** の「購入」ボタンをクリック
3. Stripe Checkout ページが開くことを確認
4. テストカード情報を入力：
   - **カード番号:** `4242 4242 4242 4242`
   - **有効期限:** 任意の未来の日付（例: `12/34`）
   - **CVC:** 任意の3桁（例: `123`）
   - **郵便番号:** 任意（例: `12345`）
5. **「購入」** をクリック

**確認ポイント:**
- [ ] Checkout が成功し、ダッシュボードにリダイレクトされる
- [ ] ダッシュボードに「PRO」プランが表示される
- [ ] Stripe Dashboard で `checkout.session.completed` イベントが記録されている
- [ ] Cloud Run ログで Webhook が受信されたことを確認

**データベース確認:**
```sql
SELECT u.email, p.name AS plan_name, s.status, s."stripeSubscriptionId"
FROM "users" u
JOIN "subscriptions" s ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
WHERE u.email = 'YOUR_EMAIL@example.com';
```

---

### ステップ 3: ENTERPRISE プラン購入（別ユーザーまたはアップグレード）

**オプション A: 別ユーザーで ENTERPRISE プラン購入**

1. 別の Google アカウントでログイン
2. **Pricing ページ** に移動
3. **ENTERPRISE プラン** の「購入」ボタンをクリック
4. テストカードで購入

**オプション B: PRO から ENTERPRISE にアップグレード**

1. Stripe Customer Portal にアクセス（`/api/stripe/portal`）
2. プランを変更

**確認ポイント:**
- [ ] ENTERPRISE プランが正しく購入/アップグレードされる
- [ ] プラン機能（画像生成、動画生成）が有効になる

---

### ステップ 4: Chat → 画像生成 → 画像編集 → 動画生成

#### 4.1 チャット（テキスト生成）

1. メインページで **「チャットモード」** を選択
2. プロンプトを入力（例: `「こんにちは、今日の天気について教えてください」`）
3. **送信** をクリック
4. レスポンスが表示されることを確認

**確認ポイント:**
- [ ] メッセージが送信され、AI レスポンスが表示される
- [ ] 会話履歴にメッセージが追加される

#### 4.2 画像生成

1. **「画像モード」** に切り替え
2. プロンプトを入力（例: `「美しい夕日の風景画」`）
3. **送信** をクリック
4. 画像が生成され、表示されることを確認

**確認ポイント:**
- [ ] 画像が生成され、画面に表示される
- [ ] `imageUrl` が正しく返却されている
- [ ] API レスポンスに `imageUrl` が含まれている

#### 4.3 画像編集

1. 生成した画像をクリックして選択
2. **「編集」** ボタンをクリック
3. 編集プロンプトを入力（例: `「雲を追加してください」`）
4. **送信** をクリック
5. 編集された画像が表示されることを確認

**確認ポイント:**
- [ ] 画像編集が成功し、新しい画像が表示される
- [ ] 編集後の画像の `imageUrl` が正しく返却される

#### 4.4 動画生成（ポーリング → ダウンロード）

1. **「動画モード」** に切り替え
2. プロンプトを入力（例: `「猫がピアノを弾いている動画」`）
3. **送信** をクリック
4. 動画生成が開始され、`operationName` が返却されることを確認
5. ポーリングが開始され、ステータスが更新されることを確認

**確認ポイント:**
- [ ] `/api/gemini/video` が `operationName` を返す
- [ ] `/api/gemini/video/status` でポーリングが動作する
- [ ] 動画生成が完了すると、`/api/gemini/video/download` でダウンロードできる
- [ ] 動画が画面に表示される

**注意:** 動画生成には数分かかる場合があります。ポーリングのタイムアウト（10分）まで待機してください。

---

### ステップ 5: 会話履歴の復元確認

1. ブラウザを **リロード**（F5 または Cmd+R）
2. 会話履歴が表示されることを確認

**確認ポイント:**
- [ ] 以前のメッセージ（チャット、画像、動画）がすべて表示される
- [ ] `/api/conversations/[id]/messages` からメッセージが取得できる
- [ ] `Conversation.updatedAt` が正しく更新されている

---

### ステップ 6: Admin ルートのアクセス確認

#### 6.1 Admin ユーザーの権限付与

**SQL で直接更新:**

```sql
-- テスト Admin ユーザーの email を確認
SELECT id, email, role FROM "users" WHERE email = 'YOUR_ADMIN_EMAIL@example.com';

-- Admin 権限を付与
UPDATE "users" 
SET role = 'ADMIN' 
WHERE email = 'YOUR_ADMIN_EMAIL@example.com';

-- 確認
SELECT id, email, role FROM "users" WHERE email = 'YOUR_ADMIN_EMAIL@example.com';
```

#### 6.2 Admin ページへのアクセス

**URL:** `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/admin`

1. Admin ユーザーでログイン
2. `/admin` にアクセス
3. Admin ダッシュボードが表示されることを確認

**確認ポイント:**
- [ ] Admin ユーザーは `/admin` にアクセスできる（200 OK）
- [ ] 通常ユーザーは `/admin` にアクセスできない（403 Forbidden）
- [ ] Admin ダッシュボードに統計情報が表示される

---

### ステップ 7: エラーハンドリング確認

#### 7.1 認証エラー（401 Unauthorized）

1. ログアウト
2. 保護された API エンドポイントにアクセス（例: `/api/conversations`）
3. 401 エラーが返されることを確認

**確認ポイント:**
- [ ] 401 Unauthorized が返される
- [ ] エラーメッセージが適切に表示される

#### 7.2 プラン制限エラー（403 Forbidden）

1. FREE プランユーザーでログイン
2. 画像生成または動画生成を試行
3. 403 エラーが返されることを確認

**確認ポイント:**
- [ ] 403 Forbidden が返される
- [ ] エラーメッセージにプラン制限の説明が含まれる

#### 7.3 レート制限エラー（429 Too Many Requests）

1. 月間リクエスト制限を超えるリクエストを送信
2. 429 エラーが返されることを確認

**確認ポイント:**
- [ ] 429 Too Many Requests が返される
- [ ] エラーメッセージに制限の説明が含まれる

---

## 📊 テスト結果記録

### テスト実施日
- **日付:** _______________
- **実施者:** _______________
- **環境:** Cloud Run (dev)

### テスト結果サマリ

| テスト項目 | 結果 | 備考 |
|----------|------|------|
| Google OAuth ログイン | ⬜ 成功 / ⬜ 失敗 | |
| PRO プラン購入 | ⬜ 成功 / ⬜ 失敗 | |
| ENTERPRISE プラン購入 | ⬜ 成功 / ⬜ 失敗 | |
| Chat 機能 | ⬜ 成功 / ⬜ 失敗 | |
| 画像生成 | ⬜ 成功 / ⬜ 失敗 | |
| 画像編集 | ⬜ 成功 / ⬜ 失敗 | |
| 動画生成 | ⬜ 成功 / ⬜ 失敗 | |
| 会話履歴復元 | ⬜ 成功 / ⬜ 失敗 | |
| Admin アクセス | ⬜ 成功 / ⬜ 失敗 | |
| エラーハンドリング | ⬜ 成功 / ⬜ 失敗 | |

### 発見された問題

1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

---

## 🔍 トラブルシューティング

### Cloud Run ログの確認

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=creative-flow-studio-dev" \
  --project=dataanalyticsclinic \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

### Stripe Webhook の確認

1. [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks) → **Developers** → **Webhooks**
2. エンドポイントを選択
3. **「Send test webhook」** でテストイベントを送信

### データベース確認

```sql
-- Subscription 確認
SELECT u.email, p.name AS plan_name, s.status, s."stripeSubscriptionId"
FROM "users" u
JOIN "subscriptions" s ON s."userId" = u.id
JOIN "plans" p ON s."planId" = p.id
ORDER BY s."createdAt" DESC
LIMIT 10;

-- PaymentEvent 確認
SELECT pe.type, pe.status, pe.amount, pe."createdAt"
FROM "payment_events" pe
ORDER BY pe."createdAt" DESC
LIMIT 10;

-- UsageLog 確認
SELECT ul."userId", ul.type, COUNT(*) as count
FROM "usage_logs" ul
GROUP BY ul."userId", ul.type
ORDER BY count DESC;
```

---

## 関連ドキュメント

- `docs/testing-manual-dev.md` - 詳細なテスト手順
- `docs/cloud-dev-testing-setup.md` - クラウド開発環境設定ガイド
- `docs/stripe-price-id-setup.md` - Stripe Price ID 設定手順


