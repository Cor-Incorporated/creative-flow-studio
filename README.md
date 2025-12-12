<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BulnaAI

Google Geminiの複数のAI機能を統合したマルチモーダルチャットアプリケーションです。テキスト生成、画像生成・編集、動画生成を1つのインターフェースで利用できます。

**AI Studioで表示**: <https://ai.studio/apps/drive/1hanzLEEM6UDMUU_uyL5xKr7-zFedvYij>

## 🔎 最新オペレーションメモ

- 最初に読む: `docs/onboarding.md`（環境URL/アカウント例/手順のショートカット）
- 役割: Claude Code（フロント）、Cursor（バックエンド/インフラ）、Codex（レビュー専任）。詳細は `AGENTS.md`
- 現状のギャップと優先度: `docs/implementation-plan.md`
- API 契約: `docs/interface-spec.md`
- Stripe/Plan/Secret 方針: `docs/stripe-integration-plan.md`
- テスト（開発/クラウド dev）: `docs/testing-manual-dev.md`

## 📂 ブランチ構成

このリポジトリは2つのバージョンを管理しています：

### main ブランチ - α版（React + Vite）

- **場所**: ルートディレクトリ
- **デプロイ**: Vercel（自動デプロイ）
- **ステータス**: α版として維持中
- **詳細**: [alpha/README.md](alpha/README.md)

### develop ブランチ - 次世代版（Next.js Full-Stack SaaS）

- **場所**: ルートディレクトリ（α版は `alpha/` に移動）
- **フレームワーク**: Next.js 14 + TypeScript
- **インフラ**: Google Cloud Platform (Cloud Run, Cloud SQL, etc.)
- **ステータス**: 開発完了（Cloud Run auth設定待ち） - 185 tests passing
- **最新更新**: 2025-12-01 - パスワード表示トグル、モバイルレスポンシブ対応、料金プラン更新
- **詳細**: 以下のセクションを参照

---

## 🚀 次世代版（develop ブランチ）- セットアップ

### 必要環境

- Node.js 20 以上
- PostgreSQL 14 以上（ローカル開発用）
- Google Cloud SDK（本番デプロイ用）

### ローカル開発環境のセットアップ

1. **リポジトリのクローン**

    ```bash
    git clone https://github.com/Cor-Incorporated/creative-flow-studio.git
    cd creative-flow-studio
    git checkout develop
    ```

2. **依存関係のインストール**

    ```bash
    npm install
    ```

3. **環境変数の設定**

    `.env.local` ファイルを作成（`.env.example` を参考）：

    ```bash
    cp .env.example .env.local
    ```

    必要な環境変数を設定：

    ```env
    # Database
    DATABASE_URL="postgresql://user:password@localhost:5432/creative_flow_studio?schema=public"

    # NextAuth.js
    NEXTAUTH_URL="http://localhost:3000"
    NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

    # OAuth Providers
    GOOGLE_CLIENT_ID="<from-google-cloud-console>"
    GOOGLE_CLIENT_SECRET="<from-google-cloud-console>"

    # Gemini API
    GEMINI_API_KEY="<from-google-ai-studio>"

    # Stripe (テストモード)
    STRIPE_SECRET_KEY="sk_test_..."
    STRIPE_WEBHOOK_SECRET="whsec_..."
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
    ```

4. **データベースのセットアップ**

    PostgreSQL をローカルで起動し、Prisma マイグレーションを実行：

    ```bash
    # Prisma Client を生成
    npm run prisma:generate

    # データベーススキーマをプッシュ（開発用）
    npm run prisma:push

    # または、マイグレーションを実行
    npm run prisma:migrate
    ```

5. **開発サーバーの起動**

    ```bash
    npm run dev
    ```

    ブラウザで <http://localhost:3000> を開きます。

## 開発コマンド

```bash
# 開発サーバー起動（ポート3000）
npm run dev

# プロダクションビルド
npm run build

# ビルド結果の起動
npm run start

# 型チェック
npm run type-check

# ESLint
npm run lint
npm run lint:fix          # 自動修正

# コードフォーマット
npm run format            # Prettier で自動フォーマット
npm run format:check      # フォーマットチェックのみ

# テスト
npm test                  # Vitest 単体テスト実行
npm run test:ui           # Vitest UI モード
npm run test:coverage     # カバレッジレポート生成
npm run test:e2e          # Playwright E2E テスト
npm run test:e2e:ui       # Playwright UI モード

# Prisma コマンド
npm run prisma:generate  # Prisma Client 生成
npm run prisma:migrate   # マイグレーション実行
npm run prisma:studio    # Prisma Studio 起動
npm run prisma:push      # スキーマをDBにプッシュ（開発用）
```

### テスト実行

プロジェクトには包括的なテストスイートが含まれています：

**単体テスト (Vitest) - 185 tests**

- Conversation API エンドポイント（33 tests）
- Stripe Integration（37 tests）
- Gemini API（18 tests）
- Admin API & UI（48 tests）
- API Utilities（14 tests）
- Subscription Utilities（23 tests）
- Validators（9 tests）
- Example tests（3 tests）

```bash
# 全テスト実行
npm test

# ウォッチモード
npm test -- --watch

# カバレッジレポート
npm run test:coverage

# UI モード（推奨）
npm run test:ui
```

**E2E テスト (Playwright)**

```bash
# 全 E2E テスト実行
npm run test:e2e

# UI モード
npm run test:e2e:ui

# 特定のブラウザで実行
npm run test:e2e -- --project=chromium
```

**参考資料:**

- 詳細なテスト計画: [`docs/testing-plan.md`](docs/testing-plan.md)
- Vitest 公式: <https://vitest.dev/>
- Playwright 公式: <https://playwright.dev/>

## 技術スタック（次世代版）

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript 5
- **ORM**: Prisma 6 + PostgreSQL
- **認証**: NextAuth.js + Google OAuth
- **決済**: Stripe Billing
- **スタイリング**: Tailwind CSS 4
- **AI SDK**: @google/genai
- **インフラ**: Google Cloud Platform
    - Cloud Run (アプリケーション)
    - Cloud SQL for PostgreSQL (データベース)
    - Secret Manager (環境変数管理)
    - Artifact Registry (コンテナイメージ)
    - Cloud Build (CI/CD)
- **IaC**: Terraform
- **使用モデル**:
    - Gemini 2.5 Flash (チャット・検索・画像分析)
    - Gemini 2.5 Pro (高度な推論)
    - Gemini 2.5 Flash Image (画像編集)
    - Imagen 4.0 (画像生成)
    - Veo 3.1 Fast (動画生成)

## プロジェクト構造（次世代版）

```
/
├── alpha/                      # React + Vite α版（mainブランチ用）
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout with SessionProvider
│   ├── page.tsx                # Main chat interface + LandingPage
│   ├── globals.css             # Tailwind v4 styles
│   ├── icon.svg                # SVG favicon
│   ├── pricing/page.tsx        # Pricing page (FREE/PRO/ENTERPRISE)
│   ├── dashboard/page.tsx      # User dashboard (subscription, usage)
│   ├── admin/                  # Admin dashboard (RBAC protected)
│   │   ├── page.tsx            # Overview dashboard
│   │   ├── users/page.tsx      # User management
│   │   └── usage/page.tsx      # Usage monitoring
│   └── api/                    # API Routes
│       ├── auth/               # NextAuth.js
│       ├── conversations/      # CRUD + messages
│       ├── stripe/             # Billing APIs
│       ├── gemini/             # AI generation APIs
│       └── admin/              # Admin APIs
├── components/                 # React コンポーネント
│   ├── ChatMessage.tsx         # Message display
│   ├── ChatInput.tsx           # Input controls
│   ├── LandingPage.tsx         # Landing page
│   ├── Toast.tsx               # Notifications
│   └── icons.tsx               # SVG icons
├── lib/                        # ユーティリティ・ヘルパー
│   ├── auth.ts                 # NextAuth config
│   ├── prisma.ts               # Prisma Client singleton
│   ├── gemini.ts               # Gemini service
│   ├── stripe.ts               # Stripe utilities
│   ├── subscription.ts         # Subscription management
│   ├── validators.ts           # Zod schemas
│   ├── api-utils.ts            # Shared API utilities (auth, error handling)
│   ├── constants.ts            # App-wide constants
│   └── fileUtils.ts            # File/base64 utilities
├── prisma/
│   └── schema.prisma           # データベーススキーマ
├── __tests__/                  # Unit tests (185 tests)
├── e2e/                        # E2E tests
├── infra/                      # Terraform（GCP インフラ）
├── docs/                       # ドキュメント
├── .env.example                # 環境変数テンプレート
├── package.json
├── tsconfig.json
├── next.config.js
├── CLAUDE.md                   # Developer documentation
├── AGENTS.md                   # Tool roles & guidelines
└── README.md
```

## アーキテクチャ

詳細なアーキテクチャ情報は以下を参照：

- **開発者向け**: [`CLAUDE.md`](CLAUDE.md)
- **インターフェース仕様**: [`docs/interface-spec.md`](docs/interface-spec.md)
- **実装計画**: [`docs/implementation-plan.md`](docs/implementation-plan.md)

## 本番環境（GCP）への環境変数設定

本番環境では、環境変数は **Secret Manager** に格納し、Cloud Run に注入します。

| Secret Manager キー       | 環境変数名              | 説明                          |
|-------------------------|-------------------------|-------------------------------|
| `database-url`          | `DATABASE_URL`          | Cloud SQL 接続文字列          |
| `nextauth-secret`       | `NEXTAUTH_SECRET`       | NextAuth.js セッション暗号化キー     |
| `google-client-id`      | `GOOGLE_CLIENT_ID`      | Google OAuth クライアントID         |
| `google-client-secret`  | `GOOGLE_CLIENT_SECRET`  | Google OAuth クライアントシークレット     |
| `stripe-secret-key`     | `STRIPE_SECRET_KEY`     | Stripe シークレットキー               |
| `stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証シークレット |
| `gemini-api-key`        | `GEMINI_API_KEY`        | Google Gemini API キー          |

**非機密の環境変数**（Cloud Run に直接設定）:

- `NEXTAUTH_URL`: `https://<cloud-run-url>`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_live_...`
- `NEXT_PUBLIC_APP_URL`: `https://<cloud-run-url>`

**参考資料：**

- ローカル開発用環境変数: [`.env.example`](.env.example)
- Terraform設定例: [`infra/README.md`](infra/README.md)
- 詳細な仕様: [`docs/interface-spec.md`](docs/interface-spec.md)

## Cloud Build パイプライン

`cloudbuild.yaml` は Google 公式ドキュメントに沿っており、以下のステップを実行します。

1. `npm ci / npx prisma generate / npx prisma migrate deploy / npm run build`
2. `docker build/push` → `asia-northeast1-docker.pkg.dev/<project>/<repo>/<image>:<sha>`
3. `gcloud run deploy` で Cloud Run サービスを更新

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _SERVICE_NAME=creative-flow-studio-dev
```

## ライセンス

ISC
