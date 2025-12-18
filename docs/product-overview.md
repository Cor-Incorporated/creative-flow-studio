# BlunaAI – Product & Tech Overview

BlunaAI は Google Gemini のマルチモーダル機能（テキスト / 画像 / 動画 / 検索）を 1 つの Web アプリで提供する SaaS です。ここではエンジニア・営業・CS など新しく参画するメンバーが短時間で全体像を把握できるよう、機能面と技術スタックをまとめています。

---

## 1. プロダクトスナップショット

| 項目 | 内容 |
| --- | --- |
| ターゲット | 生成系 AI を活用してクリエイティブ制作を行うチーム（マーケ、制作、CS、営業支援） |
| 価値 | Gemini の最新モデルを安全に利用し、チャット・画像・動画ワークフローを統合。使用量・課金を可視化しエンタープライズ要件に対応 |
| 主要画面 | ホーム（チャット／マルチモーダル UI）、ダッシュボード（購読状況・使用量）、Admin (/admin/users, /admin/usage, /admin/stats) |
| ビジネスモデル | サブスクリプション（Free / Pro / Enterprise）。Stripe Checkout & Customer Portal で決済、Usage Limit で従量制制御 |

---

## 2. コア機能

- **マルチモーダルチャット**: Chat / Pro / Search / Image / Video モードを切り替え、Gemini API へサーバー側からリクエスト。添付（画像）も Happy-path でサポート。
- **会話履歴**: `Conversation` / `Message` モデルで保存。App Router の Route Handler (`app/api/conversations`, `app/api/messages`) が Prisma を経由して CRUD。
- **認証 / RBAC**: NextAuth.js + Google OAuth。`role` フィールドで USER / PRO / ENTERPRISE / ADMIN を判定し、`middleware.ts` で `/admin` を保護。
- **課金 / プラン管理**: Stripe Product/Price 連携、Webhook による購読ステータス更新、Customer Portal 起動、`lib/subscription.ts` で Feature Flag & Usage Limit 判定。
- **Usage Logging & Monitoring**: すべての Gemini API 呼び出しを `UsageLog` に記録し、Admin で検索/フィルタ/データ閲覧が可能。`UsageLog` を元に使用制限を enforce。
- **Admin Dashboard**: `/admin/users`, `/admin/usage`, `/admin/stats` でユーザ一覧、利用状況、システム統計を提供。RBAC + Route Handler で API を防御。

---

## 3. アーキテクチャ概要

- **フロントエンド**: Next.js 14 (App Router)。UI レイヤーは `app/` + `components/`。Tailwind 風ユーティリティクラスでデザイン。クライアント境界を `use client` で明示。
- **サーバーサイド**: Route Handler (`app/api/**`) と Server Component が Prisma / Stripe / Gemini SDK を呼び出し。サーバー側で Gemini API を代理呼び出しし、レスポンスを DB に保存。
- **データレイヤー**: Prisma ORM + PostgreSQL (Cloud SQL)。モデルは `User`, `Session`, `Conversation`, `Message`, `Subscription`, `Plan`, `UsageLog`, `PaymentEvent`, `AuditLog` 等。
- **外部サービス**:
  - Google Gemini (`@google/genai`)
  - Stripe (Checkout, Billing, Webhook, Portal)
  - Google OAuth (NextAuth provider)
  - Supabase Storage（添付ファイル計画時の候補）
- **インフラ / DevOps**:
  - Cloud Run (asia-northeast1) に Docker コンテナをデプロイ
  - Secret Manager で機密値を管理し、Cloud Run へ `version='latest'` で注入
  - Cloud Build + GitHub トリガーで CI/CD、Terraform (`infra/`) で GCP リソースを IaC 化
  - Cloud SQL + Serverless VPC Connector、Monitoring/Logging も Terraform で管理

---

## 4. 技術スタック

| 分類 | ツール / サービス |
| --- | --- |
| 言語 / FW | TypeScript, Next.js 14 (App Router), React 18 |
| 状態管理 | React Hooks（コア機能はサーバーコンポーネント＋軽量クライアント） |
| UI | Tailwind 風ユーティリティクラス、カスタムコンポーネント |
| 認証 | NextAuth.js v4 + Prisma Adapter + Google OAuth |
| DB/ORM | PostgreSQL (Cloud SQL), Prisma |
| 外部 API | Google Gemini, Stripe |
| テスト | Vitest (+ React Testing Library), Playwright、`docs/manual-testing-procedure.md` で手動 QA |
| インフラ | GCP（Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud SQL, Terraform） |

---

## 5. コードベースの構造

| ディレクトリ | 役割 |
| --- | --- |
| `app/` | App Router のページと API Route Handler。`app/admin/**`, `app/api/**` など |
| `components/` | プレゼンテーション/フォーム/UI コンポーネント |
| `lib/` | Prisma クライアント、Stripe/Gemini ラッパー、RBAC/Rate Limit 共通ロジック |
| `services/` | 追加予定の外部 SDK ラッパー（Gemini など）。現状の知見は `lib/` に集約 |
| `types/` | 共通型 (`Message`, `Media`, `GenerationMode` など) |
| `docs/` | 設計・テスト・引き継ぎ資料 (このファイルのほか、`testing-plan.md`, `handoff-2025-11-13.md` 等) |
| `infra/` | Terraform モジュールと環境別設定 (`envs/dev` など) |
| `__tests__/` & `e2e/` | Vitest / Playwright テストとユーティリティ |

---

## 6. 主要ワークフロー

1. **認証 & RBAC**
   - ユーザーは Google OAuth でサインインし、NextAuth セッション (JWT) に `role` を含める。
   - `middleware.ts` が `/admin/**` へのアクセスをブロックし、ADMIN のみ許可。

2. **Gemini 呼び出し**
   - クライアントは `app/(features)/chat` 等から API Route (`app/api/gemini/<mode>`) を呼び出し。
   - サーバー側で `checkSubscriptionLimits()` → Gemini SDK 実行 → `logUsage()`。
   - 結果はレスポンス + `Conversation` / `Message` に保存。

3. **Stripe 課金 / Webhook**
   - Checkout で `metadata.userId` を付与し、Webhook (`app/api/stripe/webhook`) が購読状態を同期。
   - Customer Portal (`app/api/stripe/portal`) でプラン変更やキャンセルが可能。
   - `docs/manual-testing-procedure.md` に手動検証手順、`docs/handoff-2025-11-13.md` にログテンプレート。

4. **Usage Monitoring**
   - `UsageLog` へ行動ログを保存し、Admin 画面で検索/フィルタ/CSV エクスポート（今後）。
   - `app/api/admin/users`, `app/api/admin/usage` が Prisma の groupBy や pagination を実装済み。

5. **CI/CD & インフラ**
   - `cloudbuild.yaml` で `npm ci → npm test → npm run build → docker build/push → Cloud Run deploy`。
   - Secret Manager で Stripe/Gemini/NEXTAUTH などを一元管理し、Terraform から参照。

---

## 7. Onboarding チェックリスト

### エンジニア
1. `README.md` に従って `npm install`, `cp .env.example .env.local`, Prisma セットアップ。
2. `docs/testing-plan.md` と `docs/manual-testing-procedure.md` を読み、テストポリシーと手動 QA フローを把握。
3. `AGENTS.md` で開発フェーズとロールを確認し、現在のタスク（Cloud Build / Stripe / Gemini など）を理解。
4. `infra/README.md` を確認し、Terraform / GCP の権限・バックエンドを把握。
5. `docs/handoff-2025-11-13.md` で最新進捗・Pending タスクをチェック。

### ビジネス / CS / 営業
1. 本ドキュメントの「プロダクトスナップショット」「コア機能」で価値と画面を理解。
2. `README.md` のスクリーンショットや `app/dashboard/page.tsx` を参考に、デモ時のストーリーラインを把握。
3. プラン構成（Free / Pro / Enterprise）と Stripe 決済フローを `docs/stripe-integration-plan.md` で確認。
4. 仕様質問があれば `docs/interface-spec.md`, `docs/admin-api-design.md` を参照し、開発チームへフィードバック。

---

## 8. 関連ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| `AGENTS.md` | プロジェクト方針・役割分担・Next.js 再実装ロードマップ |
| `docs/handoff-2025-11-13.md` | 日次進捗、インフラタスク、手動 QA ログ |
| `docs/testing-plan.md` | テスト戦略、Vitest/Playwright/E2E、Phase 4/5 QA シナリオ |
| `docs/manual-testing-procedure.md` | Stripe Webhook / Usage Limit の実施手順（Cursor が使用） |
| `docs/admin-api-design.md` | Admin 機能の API 設計と Step-by-step |
| `docs/stripe-integration-plan.md` | Stripe Phase 別実装計画、Webhook や Portal の仕様 |
| `infra/README.md` | Terraform 構成、GCP リソース、State 管理 |

---

必要な情報がこの概要に無い場合は `AGENTS.md` または `docs/handoff-2025-11-13.md` の該当セクションに追記し、プロジェクトメンバー全員が最新情報を共有できるようにしてください。
