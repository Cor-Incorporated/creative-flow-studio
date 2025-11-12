# Creative Flow Studio 実装計画および Google Cloud 設定まとめ

## 1. 全体方針

- フロントエンド単体の Vite アプリを、Next.js 14 (App Router) を中核としたフルスタック SaaS アーキテクチャへ再構築する。
- バックエンド API、認証、決済、スレッド履歴永続化、管理画面までを段階的に実装し、初期 2,000 ユーザーとウェイトリスト解放に耐えうる基盤を整備する。
- インフラは Google Cloud Platform (GCP) 上に構築し、Terraform による IaC を導入する。

## 2. フェーズ別実装計画

### フェーズ 0: 要件精査

- ユーザー規模、レート制限、法務・セキュリティ要件を整理。
- Gemini API 利用ポリシーおよびコストモデルの確認。

### フェーズ 1: 基盤設計

- Next.js App Router 構成 (app/api/lib/prisma/components 等) とサーバー/クライアント境界を定義。
- データモデル初版: `User`, `Session`, `Conversation`, `Message`, `Subscription`, `Plan`, `UsageLog`, `PaymentEvent`, `AuditLog`。
- 役割/RBAC ポリシー設計 (`user`, `pro`, `enterprise`, `admin`)。
- マルチテナント要否の判定 (必要時は `tenantId` を追加)。

### フェーズ 2: 環境セットアップ

- `create-next-app` で Next.js 14 + TypeScript + Tailwind ベースプロジェクト作成。
- Prisma 初期化とスキーマ定義、`prisma migrate dev` によるローカルマイグレーション。
- ESLint/Prettier/Vitest/Playwright など開発ツール導入 (4 スペース・単一引用符設定)。

### フェーズ 3: 認証とユーザー管理

- NextAuth.js (App Router) + Prisma Adapter でサーバーサイドセッションを永続化。
- Supabase Auth / Google OAuth 等のプロバイダ設定。
- CSRF/Rate Limit/セッション管理などセキュリティハードニング。

### フェーズ 4: 会話履歴・チャット永続化

- `app/api/conversations` `app/api/messages` Route Handler を実装。
- Gemini API 呼び出しをサーバー側に移行し、レスポンスを DB に保存。
- 添付ファイルは署名付き URL + Cloud Storage (または Supabase Storage) に保存。

### フェーズ 5: プラン管理と Stripe 統合

- Stripe Product/Price とユーザーの Subscription を同期。
- Checkout セッション、Customer Portal、Webhook (成功/失敗/キャンセル) を実装。
- プラン別利用制限 (リクエスト回数、アップロード制限等) をサーバーサイドで検証。

### フェーズ 6: 管理画面・モニタリング

- `/admin` で管理 UI を提供し、NextAuth の `role` ベースでアクセス制御。
- Cloud Monitoring / Logging / Stripe イベントログと連携したダッシュボード実装。

### フェーズ 7: QA・運用

- Vitest/Playwright によるテスト、Stripe/Gemini サンドボックス検証。
- OWASP ASVS を基準にセキュリティレビュー。
- リリース手順、ロールバック、バックアップ方針の整備。

## 3. 技術スタック

- Web フレームワーク: Next.js 14 (App Router)
- 言語・ランタイム: TypeScript, Node.js (Cloud Run)
- ORM/DB: Prisma + Cloud SQL for PostgreSQL
- 認証: NextAuth.js + Supabase Auth / OAuth プロバイダ
- 決済: Stripe Billing + Checkout + Webhook
- ストレージ: Cloud Storage (または Supabase Storage)
- IaC: Terraform
- CI/CD: Cloud Build + Artifact Registry + Cloud Run
- モニタリング: Cloud Logging / Cloud Monitoring / OpenTelemetry

## 4. Google Cloud 構成 (2025-11-12 時点)

### 4.1 プロジェクト

- Project ID: `dataanalyticsclinic`
- 課金アカウント: 紐付け済み
- リージョン方針: `asia-northeast1` を主要ロケーションとする

### 4.2 有効化済み API (主要)

- Cloud Run Admin API (`run.googleapis.com`)
- Cloud Build API (`cloudbuild.googleapis.com`)
- Artifact Registry API (`artifactregistry.googleapis.com`)
- Cloud SQL Admin API (`sqladmin.googleapis.com`)
- Secret Manager API (`secretmanager.googleapis.com`)
- IAM API (`iam.googleapis.com`)
- Cloud Logging API (`logging.googleapis.com`)
- Cloud Monitoring API (`monitoring.googleapis.com`)
- Compute Engine API (`compute.googleapis.com`)
- Service Networking API (`servicenetworking.googleapis.com`)
- Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)
- その他 BigQuery, Pub/Sub, Cloud Trace など (将来拡張分含む)

### 4.3 Artifact Registry

- リポジトリ名: `creative-flow-studio`
- リージョン: `asia-northeast1`
- フォーマット: Docker
- 用途: Cloud Run 向けの Next.js コンテナイメージ格納

### 4.4 Terraform 用 GCS バケット

- バケット名: `gs://dataanalyticsclinic-terraform-state`
- リージョン: `asia-northeast1`
- バージョニング: 有効
- 権限: `terraform@dataanalyticsclinic.iam.gserviceaccount.com` に `storage.objectAdmin`

### 4.5 サービスアカウントとロール

#### Cloud Run 実行用

- SA: `cloud-run-runtime@dataanalyticsclinic.iam.gserviceaccount.com`
- 付与ロール:
    - `roles/cloudsql.client`
    - `roles/secretmanager.secretAccessor`
    - `roles/logging.logWriter`
    - `roles/monitoring.metricWriter`

#### Cloud Build デフォルト SA

- SA: `667780715339@cloudbuild.gserviceaccount.com`
- 付与ロール:
    - `roles/run.admin`
    - `roles/artifactregistry.writer`
    - `roles/cloudsql.client`
    - `roles/secretmanager.secretAccessor`
    - `roles/iam.serviceAccountUser`

#### Terraform 管理用

- SA: `terraform@dataanalyticsclinic.iam.gserviceaccount.com`
- 付与ロール:
    - `roles/serviceusage.serviceUsageAdmin`
    - `roles/compute.networkAdmin`
    - `roles/run.admin`
    - `roles/artifactregistry.admin`
    - `roles/cloudsql.admin`
    - `roles/secretmanager.admin`
    - `roles/iam.serviceAccountAdmin`
    - `roles/iam.serviceAccountUser`
    - `roles/resourcemanager.projectIamAdmin`
    - `roles/storage.admin`
    - `roles/logging.admin`
    - `roles/monitoring.admin`

### 4.6 IAM ポリシー更新履歴 (CLI 実施)

- `gcloud projects add-iam-policy-binding` を利用して上記ロールを個別付与。
- Cloud Run Runtime / Cloud Build / Terraform 用 SA の作成 (`gcloud iam service-accounts create ...`).

### 4.7 その他設定

- Application Default Credentials を `dataanalyticsclinic` に紐付け (`gcloud auth application-default login` + `set-quota-project`).
- `gcloud services enable compute.googleapis.com servicenetworking.googleapis.com cloudresourcemanager.googleapis.com` を実施済み。
- 必要に応じて Cloud Build から Cloud Run へのデプロイ時に `--service-account=cloud-run-runtime@...` を指定。

## 5. 次のアクションガイド

1. **Terraform コード整備（進捗: モジュール作成済み）**
    - `infra/envs/dev` で VPC / Cloud SQL / Secrets / Cloud Run モジュールを実装済み。`terraform plan` はダミー値で検証済み。
    - 次の合意ステップ:
        - `infra/envs/dev/terraform.tfvars` に実運用値を入力 (`stripe-webhook-secret` は Cloud Run URL 発行後に差し替え)。
        - `terraform plan -out dev.plan` → 内容レビュー → `terraform apply dev.plan` を実行し、Cloud Run / Cloud SQL / Secret Manager を本番プロジェクトに作成。
        - `terraform output` の結果（Cloud Run URI、Cloud SQL 接続名、Secret リソース名）をアプリ実装担当へ共有。

2. **アプリケーション実装（進捗: Next.js 基盤・Gemini API Routes 完了）**
    - 完了済み: Next.js 14 プロジェクト初期化、Prisma スキーマ、NextAuth 設定、Zod スキーマ、Gemini API Routes（Chat/Image/Video）。
    - 残タスク:
        - `alpha/` から UI コンポーネント（`ChatMessage`, `ChatInput` 等）を移植し、App Router 用に再構成。
        - 会話履歴 API / Prisma 永続化を追加し、フロントエンドと統合。
        - Stripe Webhook Route を実装し、Secret Manager から署名検証キーを読み込む。

3. **CI/CD パイプライン構築（進捗: `cloudbuild.yaml` 作成済み）**
    - 今後のアクション:
        - Terraform で Cloud Run を作成後、`gcloud builds triggers create` で dev ブランチ用トリガーを登録。
        - Cloud Build SA (`667780715339@cloudbuild.gserviceaccount.com`) に `roles/run.admin`, `roles/artifactregistry.writer`, `roles/cloudsql.client`, `roles/secretmanager.secretAccessor` を付与し、必要なら Terraform 化。
        - `cloudbuild.yaml` の substitution で Cloud Run サービス名・イメージ名を本番値に上書きして運用。

4. **監視・アラート設計**
    - Cloud Monitoring ダッシュボード、アラートポリシー (HTTP 5xx, レイテンシ, Cloud SQL 接続上限, Stripe webhook 失敗など) を Terraform で管理。

5. **実装フェーズ進行**
    - 各フェーズの機能 (認証 / チャット / Stripe / 管理画面) を実装し、段階的に QA → ステージング → 本番へ展開。

---

このドキュメントは 2025-11-12 時点の構成を基にしており、以降の変更点は Git リポジトリおよび Terraform ステートに反映して更新してください。
