<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# クリエイティブフロースタジオ

Google Geminiの複数のAI機能を統合したマルチモーダルチャットアプリケーションです。テキスト生成、画像生成・編集、動画生成を1つのインターフェースで利用できます。

**AI Studioで表示**: <https://ai.studio/apps/drive/1hanzLEEM6UDMUU_uyL5xKr7-zFedvYij>

## 📂 ブランチ構成

このリポジトリは2つのバージョンを管理しています：

### main ブランチ - α版（React + Vite）
- **場所**: ルートディレクトリ
- **デプロイ**: Vercel（自動デプロイ）
- **ステータス**: α版として維持中
- **詳細**: [alpha/README.md](alpha/README.md)

### dev ブランチ - 次世代版（Next.js Full-Stack SaaS）
- **場所**: ルートディレクトリ（α版は `alpha/` に移動）
- **フレームワーク**: Next.js 14 + TypeScript
- **インフラ**: Google Cloud Platform (Cloud Run, Cloud SQL, etc.)
- **ステータス**: 開発中
- **詳細**: 以下のセクションを参照

---

## 🚀 次世代版（dev ブランチ）- セットアップ

### 必要環境

- Node.js 20 以上
- PostgreSQL 14 以上（ローカル開発用）
- Google Cloud SDK（本番デプロイ用）

### ローカル開発環境のセットアップ

1. **リポジトリのクローン**

   ```bash
   git clone https://github.com/Cor-Incorporated/creative-flow-studio.git
   cd creative-flow-studio
   git checkout dev
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

### 本番環境（GCP）への環境変数設定

本番環境では、環境変数は **Secret Manager** に格納し、Cloud Run に注入します。

#### Secret Manager キーと環境変数のマッピング

| Secret Manager キー<br/>（小文字ハイフン区切り） | 環境変数名<br/>（アプリ内で使用） | 説明 |
|---|---|---|
| `database-url` | `DATABASE_URL` | Cloud SQL 接続文字列 |
| `nextauth-secret` | `NEXTAUTH_SECRET` | NextAuth.js セッション暗号化キー |
| `google-client-id` | `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `google-client-secret` | `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `supabase-service-role-key` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー（ストレージ用） |
| `stripe-secret-key` | `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証シークレット |
| `gemini-api-key` | `GEMINI_API_KEY` | Google Gemini API キー |

**非機密の環境変数**（Cloud Run に直接設定）:
- `NEXTAUTH_URL`: `https://<cloud-run-url>`
- `NEXT_PUBLIC_SUPABASE_URL`: `https://xxx.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 匿名キー
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_live_...`
- `NEXT_PUBLIC_APP_URL`: `https://<cloud-run-url>`

**Terraform での設定例:**
```hcl
resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"
  # ...
}

# Cloud Run で環境変数として注入
env {
  name = "DATABASE_URL"
  value_source {
    secret_key_ref {
      secret  = "database-url"
      version = "latest"
    }
  }
}
```

詳細は [`docs/interface-spec.md`](docs/interface-spec.md) を参照してください。

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

# Prisma コマンド
npm run prisma:generate  # Prisma Client 生成
npm run prisma:migrate   # マイグレーション実行
npm run prisma:studio    # Prisma Studio 起動
npm run prisma:push      # スキーマをDBにプッシュ（開発用）
```

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
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/                   # API Routes（今後実装）
├── components/                 # Reactコンポーネント
├── lib/                        # ユーティリティ・ヘルパー
│   ├── prisma.ts              # Prisma Client singleton
│   └── validators.ts          # Zod スキーマ（今後実装）
├── prisma/
│   └── schema.prisma          # データベーススキーマ
├── infra/                      # Terraform（GCP インフラ）
├── docs/                       # ドキュメント
│   └── interface-spec.md      # インターフェース仕様書
├── .env.example                # 環境変数テンプレート
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## アーキテクチャ

詳細なアーキテクチャ情報は以下を参照：
- **開発者向け**: [`CLAUDE.md`](CLAUDE.md)
- **インターフェース仕様**: [`docs/interface-spec.md`](docs/interface-spec.md)
- **実装計画**: [`docs/implementation-plan.md`](docs/implementation-plan.md)

## ライセンス

ISC
