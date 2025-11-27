# オンボーディング（2025-11-28 更新）

このプロジェクトに初めて参加するエンジニア向けの最短ガイドです。

---

## 全体像

| ドキュメント | 内容 |
|-------------|------|
| `docs/product-overview.md` | プロダクト概要 |
| `docs/implementation-plan.md` | 実装ステータス |
| `docs/interface-spec.md` | API 契約 |
| `docs/stripe-integration-plan.md` | Stripe/Plan 設計 |
| `docs/testing-plan.md` | テスト計画 |
| `CLAUDE.md` | 開発者向け詳細ドキュメント |
| `AGENTS.md` | ツール役割・ガイドライン |

---

## 現在のステータス

**✅ 完了済み:**

- Phase 2: 環境セットアップ (Next.js 14, Prisma, Tailwind v4)
- Phase 3: 認証基盤 (NextAuth.js + Google OAuth)
- Phase 4: 会話永続化 (CRUD + メッセージAPI)
- Phase 5: Stripe 統合 (Checkout/Portal/Webhook/Usage)
- Phase 6: 管理画面 (RBAC + Users/Usage UI)
- Landing Page & Auth UX

**🔄 保留中（インフラ）:**

- Cloud Run に NextAuth 環境変数を設定
- Google OAuth redirect URI を登録
- N+1 クエリ最適化

**テスト:** 136 tests passing ✅

---

## 環境情報（dev）

| 項目 | 値 |
|------|-----|
| Cloud Run URL | `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/` |
| 管理画面 URL | `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/admin` |
| GCP Project | `dataanalyticsclinic` |
| Region | `asia-northeast1` |

**テストアカウント:**

- Google OAuth でログイン後、`scripts/grant-admin-role.sql` で ADMIN 権限を付与
- 実際の ID/PW はチーム共有情報を使用

---

## ローカル開発の手順

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集して必要な値を設定

# 3. DB 初期化
npm run prisma:generate
npm run prisma:push  # or prisma:migrate

# 4. 開発サーバー起動
npm run dev
# → http://localhost:3000

# 5. テスト実行
npm test
```

**必要な環境変数:**

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GEMINI_API_KEY="..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

## クラウド dev での実働テスト

1. Secret Manager にテストキーを投入:
   - `database-url`, `nextauth-secret`, `google-client-id`
   - `google-client-secret`, `gemini-api-key`
   - `stripe-secret-key`, `stripe-webhook-secret`

2. Cloud Run デプロイ後、以下を確認:
   - Google OAuth ログインが動作
   - Chat/Image/Video 生成が動作
   - Admin 画面に ADMIN ユーザーのみアクセス可能

3. `docs/testing-manual-dev.md` に従い結果を記録

---

## よく使うスクリプト

```bash
# Admin 権限付与
psql $DATABASE_URL -f scripts/grant-admin-role.sql

# Stripe Price ID 更新
psql $DATABASE_URL -f scripts/update-stripe-price-ids.sql

# テスト実行
npm test                    # Vitest
npm run test:e2e           # Playwright

# 型チェック
npm run type-check

# Lint & Format
npm run lint
npm run format
```

---

## 連携と役割

| ツール | 役割 | 担当 |
|--------|------|------|
| Claude Code | フロント実装、API、テスト、ドキュメント | - |
| Cursor | バックエンド、インフラ、クラウドデプロイ | NextAuth 設定、N+1最適化 |
| Codex | レビュー専任（外部接続なし） | セキュリティ監査 |

---

## 主要ファイル

**ページ:**

- `app/page.tsx` - メインチャット + LandingPage
- `app/pricing/page.tsx` - 料金プラン
- `app/dashboard/page.tsx` - ユーザーダッシュボード
- `app/admin/` - 管理画面

**API:**

- `app/api/gemini/` - AI 生成 (chat, image, video)
- `app/api/conversations/` - 会話 CRUD
- `app/api/stripe/` - 課金 (checkout, portal, webhook)
- `app/api/admin/` - 管理者 API

**コンポーネント:**

- `components/LandingPage.tsx` - LP
- `components/Toast.tsx` - 通知
- `components/ChatMessage.tsx` - メッセージ表示
- `components/ChatInput.tsx` - 入力コントロール

**ライブラリ:**

- `lib/auth.ts` - NextAuth 設定
- `lib/gemini.ts` - Gemini サービス
- `lib/stripe.ts` - Stripe ユーティリティ
- `lib/subscription.ts` - サブスク管理
- `lib/validators.ts` - Zod スキーマ
