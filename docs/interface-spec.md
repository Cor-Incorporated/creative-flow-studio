# インターフェース仕様書

**Version:** 1.2  
**Date:** 2025-11-13  
**Target:** Next.js Full-Stack SaaS (develop branch)

このドキュメントは、Claude Code（フロントエンド）と Cursor（バックエンド/インフラ）が参照し、実装漏れなく「動く」ことを最優先にするための仕様を定義します。

## 0. Reality Check（現在の実装状況と欠落）

- Prisma スキーマは仕様通り存在。NextAuth + Google OAuth、Stripe ルート、Gemini ルート（chat/image/video）は部分実装済み。  
- 欠落/不整合:
  - `/api/conversations/[id]/messages` が未実装。UI から保存リクエストが落ちるため会話履歴が永続化されない。
  - `/api/gemini/image` は `{ result }` を返すのみ。UI は `imageUrl` を期待し画像が表示されない。→ API で `imageUrl` を返すか UI 側を `result` 構造に合わせて変換すること。
  - `/api/gemini/video/status` と `/api/gemini/video/download` が未実装。`/api/gemini/video` も `operationName` をトップレベルで返さないため、ポーリング契約が破綻している。
  - Stripe Webhook は実装済みだが Secret 連携と Plan 解決ロジックの最終確認、Idempotency（PaymentEvent.stripeEventId）が必要。
  - テスト: video/image の契約変更に伴う Vitest 更新と E2E の不足。

上記を解消する実装が Done で初めて本仕様の完了と見なす。

---

## 0.1 Error Handling Contract（UI/UXのための必須契約）

### 0.1.1 APIエラー（App Router API Routes）

APIは、クライアントが安定してエラー表示できるよう **構造化エラー**を返す。

- **必須フィールド**:
  - `error`: ユーザー向け短文
  - `code`: 安定したエラーコード
  - `requestId`: 問い合わせ/ログ突合用ID
- **必須ヘッダー**:
  - `X-Request-Id`: `requestId` と一致

（実装は `lib/api-utils.ts` の `jsonError()` を利用）

### 0.1.2 認証エラー（NextAuth）

NextAuthの認証エラーは `/auth/error?error=<CODE>` に遷移し、UIは `CODE` に応じた日本語メッセージを表示する。

- `OAuthAccountNotLinked`: 「最初に登録した方法（メール/Google）でログイン」へ誘導する
- `EmailNormalizationConflict`: サポート問い合わせ導線（データ衝突の可能性）
- `SubscriptionInitFailed`: 時間をおいて再試行 + サポート問い合わせ

### 0.1.3 UI表示ルール

- APIエラーは **Toast + 必要に応じてインライン表示**でユーザーに提示する  
- `requestId` がある場合は文末に **「サポートID: <requestId>」**として表示する  
- `UNAUTHORIZED` / `FORBIDDEN_PLAN` / `RATE_LIMIT_EXCEEDED` は **行動導線（再ログイン/料金プラン）**を必ず付ける

## 1. 環境変数仕様

### 1.1 Next.js アプリケーション側で必要な環境変数

#### ローカル開発環境（`.env.local`）

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/creative_flow_studio?schema=public"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# OAuth Providers
GOOGLE_CLIENT_ID="<from-google-cloud-console>"
GOOGLE_CLIENT_SECRET="<from-google-cloud-console>"

# Supabase (Optional - if using Supabase Auth)
NEXT_PUBLIC_SUPABASE_URL="<from-supabase-dashboard>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<from-supabase-dashboard>"
SUPABASE_SERVICE_ROLE_KEY="<from-supabase-dashboard>"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Gemini API
GEMINI_API_KEY="<from-google-ai-studio>"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# NOTE: NODE_ENVはNext.jsが自動で設定するため、手動設定不要
```

#### 本番環境（Cloud Run / Secret Manager）

Secret Manager に格納し、Cloud Run の環境変数として注入する項目：

**注意:** Secret Manager のキー名は小文字ハイフン区切りを使用（GCP推奨）

| Secret Manager キー名   | 環境変数名                  | 説明                                        | 例                                                                  |
| ----------------------- | --------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `database-url`          | `DATABASE_URL`              | Cloud SQL への接続文字列（Unix socket）     | `postgresql://user:pass@localhost/db?host=/cloudsql/project%3Aregion%3Ainstance`<br/>**注意**: コロンを`%3A`にエンコード必須 |
| `nextauth-secret`       | `NEXTAUTH_SECRET`           | NextAuth.js のセッション暗号化キー          | `openssl rand -base64 32`                                           |
| `google-client-id`      | `GOOGLE_CLIENT_ID`          | Google OAuth クライアントID                 | Google Cloud Console から取得                                       |
| `google-client-secret`  | `GOOGLE_CLIENT_SECRET`      | Google OAuth クライアントシークレット       | Google Cloud Console から取得                                       |
| `supabase-service-role` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー（ストレージ用） | Supabase Dashboard から取得                                         |
| `stripe-secret-key`     | `STRIPE_SECRET_KEY`         | Stripe シークレットキー                     | Stripe Dashboard から取得                                           |
| `stripe-webhook-secret` | `STRIPE_WEBHOOK_SECRET`     | Stripe Webhook 署名検証シークレット         | Stripe Webhook 設定から取得                                         |
| `gemini-api-key`        | `GEMINI_API_KEY`            | Google Gemini API キー                      | Google AI Studio から取得                                           |

環境変数として直接設定する項目（非機密）：

| 環境変数名                           | 説明                        | 例                        |
| ------------------------------------ | --------------------------- | ------------------------- |
| `NEXTAUTH_URL`                       | NextAuth.js のベースURL     | `https://app.example.com` |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase プロジェクトURL    | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Supabase 匿名キー（公開可） | `eyJhbGc...`              |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開可能キー         | `pk_live_...`             |
| `NEXT_PUBLIC_APP_URL`                | アプリケーションのベースURL | `https://app.example.com` |

### 1.2 Terraform / Codex 側での対応

- Secret Manager に上記の機密情報を格納（キー名は小文字ハイフン区切り）
- Cloud Run サービスに環境変数として注入する設定を Terraform で定義
    - Secret の値を環境変数にマッピング（例: `database-url` → `DATABASE_URL`）
- `google_secret_manager_secret_iam_binding` で `cloud-run-runtime@` SA に `roles/secretmanager.secretAccessor` を付与

---

## 2. データベーススキーマ（Prisma）

### 2.1 初版スキーマ

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// Authentication & User Management
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  conversations Conversation[]
  subscription  Subscription?
  usageLogs     UsageLog[]

  @@map("users")
}

enum Role {
  USER
  PRO
  ENTERPRISE
  ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ============================================
// Conversation & Messages
// ============================================

model Conversation {
  id        String    @id @default(cuid())
  title     String?
  userId    String
  mode      GenerationMode @default(CHAT)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  Message[]

  @@index([userId, createdAt])
  @@map("conversations")
}

enum GenerationMode {
  CHAT
  PRO
  SEARCH
  IMAGE
  VIDEO
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           MessageRole
  content        Json     // Flexible structure for text, media, sources
  createdAt      DateTime @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@map("messages")
}

enum MessageRole {
  USER
  MODEL
  SYSTEM
}

// ============================================
// Subscription & Billing
// ============================================

model Plan {
  id                  String   @id @default(cuid())
  name                String   @unique
  stripePriceId       String?  @unique
  monthlyPrice        Int      // in cents
  features            Json     // Flexible JSON for feature flags
  maxRequestsPerMonth Int?
  maxFileSize         Int?     // in bytes
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  subscriptions       Subscription[]

  @@map("plans")
}

model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  planId               String
  stripeCustomerId     String?  @unique
  stripeSubscriptionId String?  @unique
  status               SubscriptionStatus @default(INACTIVE)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                 Plan     @relation(fields: [planId], references: [id])
  paymentEvents        PaymentEvent[]

  @@map("subscriptions")
}

enum SubscriptionStatus {
  ACTIVE
  INACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  UNPAID
}

model PaymentEvent {
  id               String   @id @default(cuid())
  subscriptionId   String
  stripeEventId    String   @unique
  type             String   // e.g., 'invoice.paid', 'payment_intent.succeeded'
  amount           Int?     // in cents
  status           String?
  metadata         Json?
  createdAt        DateTime @default(now())

  subscription     Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId, createdAt])
  @@map("payment_events")
}

// ============================================
// Usage Tracking & Audit
// ============================================

model UsageLog {
  id           String   @id @default(cuid())
  userId       String
  action       String   // e.g., 'chat', 'image_generation', 'video_generation'
  resourceType String?  // e.g., 'gemini-2.5-flash', 'imagen-4.0'
  metadata     Json?
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("usage_logs")
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  resource  String?
  metadata  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

### 2.2 JSON フィールドの構造定義（Zod スキーマ）

Prisma の `Json` 型フィールド（`Plan.features`, `UsageLog.metadata` 等）の構造を Zod で定義します。
これらは `lib/validators.ts` に配置します。

**Plan.features の構造:**

```typescript
import { z } from 'zod';

export const PlanFeaturesSchema = z.object({
    maxRequestsPerMonth: z.number().nullable(),
    maxFileSize: z.number().nullable(), // in bytes
    maxConcurrentRequests: z.number().default(3),
    allowImageGeneration: z.boolean().default(true),
    allowVideoGeneration: z.boolean().default(false),
    allowProMode: z.boolean().default(false),
    allowSearchMode: z.boolean().default(true),
    prioritySupport: z.boolean().default(false),
    customBranding: z.boolean().default(false),
});

export type PlanFeatures = z.infer<typeof PlanFeaturesSchema>;
```

**UsageLog.metadata の構造:**

```typescript
export const UsageLogMetadataSchema = z.object({
    model: z.string().optional(), // e.g., 'gemini-2.5-flash', 'imagen-4.0'
    mode: z.enum(['chat', 'pro', 'search', 'image', 'video']).optional(),
    tokensUsed: z.number().optional(),
    imageSize: z.string().optional(), // e.g., '1024x1024'
    videoLength: z.number().optional(), // in seconds
    aspectRatio: z.string().optional(),
    success: z.boolean().default(true),
    errorMessage: z.string().optional(),
});

export type UsageLogMetadata = z.infer<typeof UsageLogMetadataSchema>;
```

**Message.content の構造:**

```typescript
export const MessageContentSchema = z.object({
    text: z.string().optional(),
    media: z
        .object({
            type: z.enum(['image', 'video']),
            url: z.string(),
            mimeType: z.string(),
        })
        .optional(),
    sources: z
        .array(
            z.object({
                uri: z.string(),
                title: z.string(),
            })
        )
        .optional(),
    isLoading: z.boolean().optional(),
    status: z.string().optional(),
    isError: z.boolean().optional(),
    originalMedia: z
        .object({
            type: z.enum(['image', 'video']),
            url: z.string(),
            mimeType: z.string(),
        })
        .optional(),
});

export type MessageContent = z.infer<typeof MessageContentSchema>;
```

### 2.3 Cloud SQL 要件

- **インスタンスタイプ**: `db-f1-micro`（初期）→ ユーザー増加に応じてスケール
- **PostgreSQL バージョン**: 14 以上
- **リージョン**: `asia-northeast1`
- **バックアップ**: 自動バックアップ有効（7日間保持）
- **接続方法**: Unix ソケット（`/cloudsql/project:region:instance`）

---

## 3. API Routes 設計

### 3.1 エンドポイント一覧

#### 認証関連（NextAuth.js）

| Method     | Path                      | 説明                                                             |
| ---------- | ------------------------- | ---------------------------------------------------------------- |
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth.js エンドポイント（ログイン、コールバック、セッション） |

#### 会話・メッセージ関連

| Method   | Path                               | 説明                                 | 認証 |
| -------- | ---------------------------------- | ------------------------------------ | ---- |
| `GET`    | `/api/conversations`               | ユーザーの会話一覧取得               | 必須 |
| `POST`   | `/api/conversations`               | 新規会話作成                         | 必須 |
| `GET`    | `/api/conversations/[id]`          | 特定会話の詳細とメッセージ取得       | 必須 |
| `DELETE` | `/api/conversations/[id]`          | 会話削除                             | 必須 |
| `POST`   | `/api/conversations/[id]/messages` | メッセージ送信（Gemini API呼び出し） | 必須 |

#### Gemini API Proxy（サーバーサイド）

| Method | Path                                     | 説明                     | 認証 |
| ------ | ---------------------------------------- | ------------------------ | ---- |
| `POST` | `/api/gemini/chat`                       | チャット生成             | 必須 |
| `POST` | `/api/gemini/pro`                        | Pro モード生成           | 必須 |
| `POST` | `/api/gemini/search`                     | 検索グラウンディング生成 | 必須 |
| `POST` | `/api/gemini/image/generate`             | 画像生成                 | 必須 |
| `POST` | `/api/gemini/image/edit`                 | 画像編集                 | 必須 |
| `POST` | `/api/gemini/image/analyze`              | 画像分析                 | 必須 |
| `POST` | `/api/gemini/video/generate`             | 動画生成開始             | 必須 |
| `GET`  | `/api/gemini/video/status/[operationId]` | 動画生成ステータス確認   | 必須 |

#### Stripe 決済・Webhook

| Method | Path                   | 説明                           | 認証           |
| ------ | ---------------------- | ------------------------------ | -------------- |
| `POST` | `/api/stripe/checkout` | Checkout セッション作成        | 必須           |
| `POST` | `/api/stripe/portal`   | Customer Portal セッション作成 | 必須           |
| `POST` | `/api/stripe/webhook`  | Stripe Webhook エンドポイント  | Stripe署名検証 |

#### 管理画面 API

| Method  | Path                    | 説明                           | 認証       |
| ------- | ----------------------- | ------------------------------ | ---------- |
| `GET`   | `/api/admin/users`      | ユーザー一覧取得               | Admin のみ |
| `GET`   | `/api/admin/stats`      | システム統計情報               | Admin のみ |
| `PATCH` | `/api/admin/users/[id]` | ユーザー情報更新（role変更等） | Admin のみ |

#### ヘルスチェック

| Method | Path             | 説明                           | 認証 |
| ------ | ---------------- | ------------------------------ | ---- |
| `GET`  | `/api/health`    | アプリケーション正常性チェック | 不要 |
| `GET`  | `/api/health/db` | データベース接続チェック       | 不要 |

### 3.2 認証ミドルウェア

すべての認証必須エンドポイントで、NextAuth.js の `getServerSession()` を使用してセッション検証を実施。

### 3.3 レスポンス契約（実装時に必ず合わせること）

- `/api/conversations/[id]/messages`  
  - **POST** Body: `{ role: 'USER' | 'MODEL' | 'SYSTEM', content: ContentPart[] }`  
  - **Behavior**: Conversation に紐づく Message を作成し、`201 { message }` を返す。作成と同時に `updatedAt` を更新。  
  - **AuthZ**: 会話所有者のみ。存在しない会話は 404。

- `/api/gemini/image`  
  - **Response (成功)**: `{ imageUrl: string }` を返す（result は返さない）。UI は `imageUrl` を表示に使用。  
  - **Image Edit**: `originalImage` を受け取り、編集後の画像も `imageUrl` で返す。

- `/api/gemini/video`  
  - **Response (成功)**: `{ operationName: string }` を返す（result は返さない）。  
  - **Status** `/api/gemini/video/status`（POST 推奨）: Body `{ operationName }` → `{ operation }`。  
  - **Download** `/api/gemini/video/download`: Query `uri` を受け取り、API キーを露出せずにバイナリを返却（Content-Type: video/mp4）。

- 429/403/401 ケースでは `{ error, details? }` を JSON で返し、UI は `error` を表示に利用する。

---

## 4. ディレクトリ構造

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認証関連ページグループ
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # ダッシュボードページグループ
│   │   ├── layout.tsx            # 認証チェック付きレイアウト
│   │   ├── page.tsx              # チャットメインページ
│   │   ├── history/              # 会話履歴ページ
│   │   └── settings/             # 設定ページ
│   ├── (admin)/                  # 管理画面ページグループ
│   │   ├── layout.tsx            # Admin権限チェック付きレイアウト
│   │   └── page.tsx              # 管理ダッシュボード
│   ├── api/                      # API Routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts      # NextAuth.js設定
│   │   ├── conversations/
│   │   ├── gemini/
│   │   ├── stripe/
│   │   ├── admin/
│   │   └── health/
│   ├── layout.tsx                # ルートレイアウト
│   ├── page.tsx                  # ランディングページ
│   └── globals.css               # グローバルCSS
│
├── components/                   # React コンポーネント
│   ├── chat/
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatHistory.tsx
│   ├── ui/                       # 汎用UIコンポーネント
│   └── providers/
│       └── SessionProvider.tsx   # NextAuth Session Provider
│
├── lib/                          # ユーティリティ・ヘルパー
│   ├── auth.ts                   # NextAuth 設定・ヘルパー
│   ├── prisma.ts                 # Prisma Client インスタンス
│   ├── stripe.ts                 # Stripe Client
│   ├── gemini.ts                 # Gemini API Client
│   ├── validators.ts             # Zod スキーマ
│   └── utils.ts                  # 汎用ユーティリティ
│
├── prisma/
│   ├── schema.prisma             # Prisma スキーマ
│   └── migrations/               # マイグレーションファイル
│
├── public/                       # 静的ファイル
├── types/                        # TypeScript 型定義
├── middleware.ts                 # Next.js ミドルウェア（認証チェック等）
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local                    # ローカル環境変数（gitignore）
├── package.json
└── README.md
```

---

## 5. NextAuth.js 設定要件

### 5.1 プロバイダー

- **Google OAuth 2.0**（初期実装）
- 今後: GitHub, Email/Password 等を追加可能

### 5.2 Adapter

- **Prisma Adapter** を使用
- セッション永続化先: PostgreSQL（Cloud SQL）

### 5.3 セッション戦略

- **Database Sessions**（JWT ではなく DB セッション）
- セッション有効期限: 30日間
- セッショントークンの自動延長

### 5.4 コールバック URL

**ローカル開発:**

- Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

**本番環境:**

- Authorized redirect URIs: `https://<cloud-run-url>/api/auth/callback/google`

---

## 6. 外部サービス連携要件

### 6.1 Supabase（ストレージのみ使用）

**重要:** 認証は NextAuth.js を使用し、Supabase Authentication は**使用しません**。
Supabase は画像・動画ファイルのストレージ機能のみに使用します。

**使用範囲:**

- **Storage のみ**: 画像・動画ファイルのアップロード用
- **Database**: 使用しない（Cloud SQL を使用）
- **Authentication**: 使用しない（NextAuth.js を使用）

**設定項目:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 匿名キー（Storage アクセス用）
- `SUPABASE_SERVICE_ROLE_KEY` - サービスロールキー（サーバーサイドからの Storage 操作用）

**Supabase 以外の選択肢:**

- Cloud Storage を使用する場合は、Supabase の設定は不要です

### 6.2 Stripe

**初期セットアップ:**

1. Stripe アカウント作成（テストモード）
2. Product & Price 作成:
    - **Free Plan**: $0/month（デフォルト）
    - **Pro Plan**: $20/month（仮）
    - **Enterprise Plan**: $100/month（仮）
3. Webhook エンドポイント登録:
    - URL: `https://<cloud-run-url>/api/stripe/webhook`
    - Events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`

**必要な情報:**

- Secret Key: `STRIPE_SECRET_KEY`
- Publishable Key: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Webhook Secret: `STRIPE_WEBHOOK_SECRET`
- Product/Price IDs（Prisma の Plan テーブルに格納）

### 6.3 Google OAuth（Google Cloud Console）

1. OAuth 2.0 Client ID 作成
2. Authorized JavaScript origins: `http://localhost:3000`, `https://<cloud-run-url>`
3. Authorized redirect URIs: `/api/auth/callback/google`
4. Client ID/Secret を環境変数に設定

---

## 7. Cloud Run / GCP 連携仕様

### 7.1 Cloud SQL 接続

**接続方法:**

- Unix ソケット経由: `/cloudsql/dataanalyticsclinic:asia-northeast1:<instance-name>`
- `DATABASE_URL` 形式:
    ```
    postgresql://user:password@/creative_flow_studio?host=/cloudsql/dataanalyticsclinic:asia-northeast1:<instance-name>
    ```

**Terraform での設定:**

- Cloud Run サービスに `--add-cloudsql-instances` オプションでインスタンスを指定
- サービスアカウント `cloud-run-runtime@` に `roles/cloudsql.client` を付与

### 7.2 Secret Manager

**アクセス方法:**

- Cloud Run の環境変数として注入（Terraform で設定）
- サービスアカウント `cloud-run-runtime@` に `roles/secretmanager.secretAccessor` を付与

### 7.3 コンテナイメージ

**ビルド:**

- Dockerfile を使用して Next.js アプリをコンテナ化
- Artifact Registry にプッシュ: `asia-northeast1-docker.pkg.dev/dataanalyticsclinic/creative-flow-studio/app:latest`

**起動コマンド:**

```bash
npm run start
```

### 7.4 ヘルスチェック

**Cloud Run ヘルスチェック設定:**

- Path: `/api/health`
- Interval: 10 秒
- Timeout: 3 秒
- Unhealthy threshold: 3 回

---

## 8. CI/CD パイプライン

### 8.1 Cloud Build トリガー

**トリガー条件:**

- ブランチ: `develop`
- 変更検知: develop ブランチへの push

**ビルドステップ（cloudbuild.yaml）:**

1. `npm install`
2. `npm run build`
3. **Prisma マイグレーション（Cloud SQL Proxy 経由）**
    - Cloud SQL Auth Proxy を起動
    - `DATABASE_URL` を Secret Manager から取得
    - `npx prisma migrate deploy` を実行
    - Proxy を停止
4. Docker イメージビルド
5. Artifact Registry へプッシュ
6. Cloud Run へデプロイ

**Cloud SQL 接続方法:**

- Cloud Build から Cloud SQL に接続するには、ビルドステップ内で Cloud SQL Auth Proxy を使用
- 参考: https://cloud.google.com/build/docs/deploying-builds/deploy-cloud-run#connect_sql

**cloudbuild.yaml サンプル:**

```yaml
steps:
    # 1. 依存関係インストール
    - name: 'node:20'
      entrypoint: npm
      args: ['install']

    # 2. ビルド
    - name: 'node:20'
      entrypoint: npm
      args: ['run', 'build']

    # 3. Prisma マイグレーション（Cloud SQL Proxy 使用）
    - name: 'gcr.io/cloud-builders/gcloud'
      entrypoint: bash
      args:
          - '-c'
          - |
              # Cloud SQL Proxy をダウンロード
              wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
              chmod +x cloud_sql_proxy

              # Proxy を起動（バックグラウンド）
              ./cloud_sql_proxy -instances=dataanalyticsclinic:asia-northeast1:INSTANCE_NAME=tcp:5432 &
              sleep 5

              # DATABASE_URL を設定してマイグレーション実行
              export DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/creative_flow_studio"
              npx prisma migrate deploy

              # Proxy を停止
              killall cloud_sql_proxy
      env:
          - 'DATABASE_URL=${_DATABASE_URL}'
      secretEnv: ['DATABASE_URL']

    # 4-6. Docker ビルド、プッシュ、デプロイ
    # ... (省略)

availableSecrets:
    secretManager:
        - versionName: projects/$PROJECT_ID/secrets/database-url/versions/latest
          env: 'DATABASE_URL'
```

### 8.2 必要な権限

Cloud Build デフォルト SA (`667780715339@cloudbuild.gserviceaccount.com`) に付与済み:

- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/cloudsql.client`
- `roles/secretmanager.secretAccessor`
- `roles/iam.serviceAccountUser`

---

## 9. 開発フロー

### 9.1 ローカル開発

1. `.env.local` に環境変数設定
2. `npm install`
3. `npx prisma generate`
4. `npx prisma migrate dev`（ローカルPostgreSQL必要）
5. `npm run dev`

### 9.2 ステージング環境（develop ブランチ）

1. develop ブランチへ push
2. Cloud Build 自動トリガー
3. Cloud Run（ステージング環境）へ自動デプロイ
4. 動作確認

### 9.3 本番環境（main ブランチ）

1. develop → main へ PR 作成
2. Cursor（レビューエンジニア）によるコードレビュー
3. マージ後、Cloud Build 自動トリガー
4. 本番 Cloud Run へデプロイ

**注意:** 以前は `dev` ブランチを使用していましたが、現在は `develop` ブランチに統一されています。

---

## 10. レビューポイント

### 10.1 Claude Code → Codex/Cursor へのレビュー依頼項目

- [ ] Prisma スキーマが要件を満たしているか
- [ ] API Routes の設計が適切か
- [ ] 環境変数の命名規則が統一されているか
- [ ] Secret Manager のキー名が合意されているか
- [ ] Cloud SQL 接続方法が正しいか
- [ ] Stripe Product/Price ID の格納方法が適切か
- [ ] ヘルスチェックエンドポイントの実装が適切か

### 10.2 Codex → Claude Code へのフィードバック項目

- [ ] Terraform で作成した Cloud SQL インスタンス名
- [ ] Secret Manager に格納した環境変数キー一覧
- [ ] Supabase プロジェクト URL と API キー
- [ ] Stripe テストモード Webhook URL
- [ ] Google OAuth Callback URL の設定状況
- [ ] Cloud Run サービス URL

---

## 11. 今後の拡張ポイント

- マルチテナント対応（`tenantId` カラム追加）
- 画像・動画ファイルの Cloud Storage / Supabase Storage 保存
- Rate Limiting（Redis / Cloud Memorystore）
- OpenTelemetry による分散トレーシング
- プラン別機能制限の詳細実装

---

**このドキュメントは Week 1 のレビュー後に更新し、最新状態を維持してください。**
