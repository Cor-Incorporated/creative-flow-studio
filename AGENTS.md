# Repository Guidelines

## ブランチとリリース方針

- `main`: 既存の Vite + React α版を維持。Vercel にデプロイ済みで、軽微なホットフィックスのみ許可。
- `develop`: Next.js 14 (App Router) を軸にしたフルスタック版の実装ブランチ。以降の新機能・大規模改修はここで進め、完成後にリリースブランチを切って `main` へ段階的に統合。
- α版の UI/UX 改修が必要な場合は、`main` からトピックブランチを作成して最小差分で対応する。Next.js 版の開発内容は `develop` を最新化してから着手する。

## Next.js 再実装計画（`develop`）

### フェーズ別ロードマップ

1. **要件精査**: ユーザー規模、Gemini API のレート/コスト、セキュリティ要件を確定。
2. **基盤設計**: App Router 構成、サーバー/クライアント境界、初版データモデル（`User`, `Session`, `Conversation`, `Message`, `Subscription`, `Plan`, `UsageLog`, `PaymentEvent`, `AuditLog`）と RBAC を定義。必要なら `tenantId` を追加してマルチテナントに対応。
3. **環境セットアップ**: `create-next-app` でプロジェクト生成。Prisma 初期化、`prisma migrate dev` 運用、ESLint/Prettier/Vitest/Playwright を導入（4 スペース・単一引用符）。
4. **認証/ユーザー管理**: NextAuth.js + Prisma Adapter によるセッション永続化。Supabase Auth や Google OAuth をプロバイダとして組み込み、CSRF・Rate Limit を実装。
5. **会話履歴と Gemini 呼び出し**: `app/api/conversations` や `app/api/messages` Route Handler を実装し、Gemini API 呼び出しをサーバー側に移しつつレスポンスを DB に保存。添付ファイルは Cloud Storage/Supabase Storage の署名付き URL で処理。
6. **プラン管理と決済**: Stripe Product/Price、Subscription 同期。Checkout、Customer Portal、Webhook（成功/失敗/キャンセル）を実装し、プラン別リミットをサーバーで検証。
7. **管理画面/監視**: `/admin` を NextAuth の `role` ベースで保護。Cloud Monitoring/Logging、Stripe イベントログなどのダッシュボードを整備。
8. **QA/運用**: Vitest/Playwright、自動/手動 QA、Stripe/Gemini サンドボックス検証、OWASP ASVS を基準にしたセキュリティレビュー。

### 主要ディレクトリ方針

- `app/`: App Router ベースのページ・Route Handler。フロント/サーバーの境界を明示する。
- `lib/`: Prisma クライアント、Stripe ラッパー、RBAC/Rate Limit などのサーバー共有ロジック。
- `components/`: 表示寄りのコンポーネント。状態を持つ場合もクライアント境界を意識。
- `services/`: Gemini など外部 SDK アクセスをまとめる。既存 `services/geminiService.ts` の知見を利用。
- `utils/`: `fileToBase64` などバイナリ/共通ユーティリティ。
- `types.ts` と `types/`: メッセージ・メディア・モード型を集約し、Next.js 版でも再利用可能な形に整理。

## 現行 α版（`main`）の留意点

- `App.tsx` がチャット/画像/動画フローと Google GenAI を統括。軽微な UI 調整やバグ修正のみ許可。
- `npm run dev` / `npm run build` / `npm run preview` で Vite 開発～検証。`API_KEY` は `.env.local` などで指定。
- コンポーネント/サービス/ユーティリティの責務分離は現行方針を維持し、Next.js 版へ移植しやすいように整理する。

## Google Cloud / Terraform 状況（2025-11-12 時点）

- **プロジェクト**: `dataanalyticsclinic`（主要リージョン `asia-northeast1`、課金設定済み）。
- **Artifact Registry**: `creative-flow-studio`（Docker、`asia-northeast1`）。Next.js コンテナを格納。
- **Terraform ステート**: `gs://dataanalyticsclinic-terraform-state`（バージョニング有効、`terraform@...` に `storage.objectAdmin`）。
- **サービスアカウント**:
    - Cloud Run 実行: `cloud-run-runtime@...`（`roles/cloudsql.client`, `roles/secretmanager.secretAccessor`, `roles/logging.logWriter`, `roles/monitoring.metricWriter`）。
    - Cloud Build: `667780715339@cloudbuild.gserviceaccount.com`（`roles/run.admin` などデプロイ権限）。
    - Terraform 管理: `terraform@...`（`serviceUsageAdmin`, `compute.networkAdmin`, `run.admin`, `artifactregistry.admin`, `cloudsql.admin`, `secretmanager.admin`, `iam.serviceAccountAdmin`, `iam.serviceAccountUser`, `resourcemanager.projectIamAdmin`, `storage.admin`, `logging.admin`, `monitoring.admin`）。
- **有効 API**: Cloud Run, Cloud Build, Artifact Registry, Cloud SQL, Secret Manager, IAM, Logging, Monitoring, Compute Engine, Service Networking, Cloud Resource Manager, BigQuery, Pub/Sub, Cloud Trace など。
- **その他**: ADC は `dataanalyticsclinic` に紐付け済み。`gcloud services enable ...` を実行済み。Cloud Build→Cloud Run デプロイ時は `--service-account=cloud-run-runtime@...` を使用。

## 開発・CI/CD 手順

- Next.js 版では `npm run dev` → App Router 開発、`npm run build` で本番ビルド。Prisma 変更時は `prisma migrate dev` → `prisma generate`。
- Terraform コードは `infra/` で管理し、上記 GCS バケットを state backend に設定。VPC / Cloud SQL / Cloud Run / Secrets / Monitoring をコード化。
- Cloud Build トリガーで Docker ビルド → Artifact Registry push → Cloud Run デプロイ。`cloud-build.yaml` にテスト・Prisma マイグレーションを統合。

## コーディング規約

- TypeScript / Next.js / React。関数コンポーネント、4 スペース、単一引用符、既存スタイルに合わせた JSX。
- コンポーネントは PascalCase、ユーティリティは camelCase、カスタムフックは `use` 接頭辞。
- スタイルは Tailwind 風クラスを組み合わせる。コメントは非自明な制御フローや外部 API 事情に限定。
- 共有ロジックは `services/` や `utils/` へ集約し、重複を避ける。

## テスト方針

- 公式テスト環境は未整備。Next.js 版では Vitest + React Testing Library、E2E は Playwright を推奨。`__tests__/` と同階層に配置し、`<Component>.test.tsx` / `<module>.test.ts` 命名を徹底。
- 画像編集・動画ポーリングなど多段フローは統合テストまたは手動 QA 手順を PR に記載。

## コミット / PR ガイド

- Git メタデータは省略されているが、コミットメッセージは Conventional Commits（例: `feat: support video polling status`）。
- コミットは小さく保ち、必要に応じて問題/解決/検証を本文に記載。
- PR では関連 Issue、検証手順（`npm run build` や手動 QA）、UI 変更時のスクリーンショット/クリップを添付。

## セキュリティ / 設定

- `API_KEY` などのシークレットは `.env.local` や Secret Manager に置き、Git には含めない。生成メディアもリポジトリ外で扱う。
- Next.js 版でも `window.aistudio` の依存を把握し、スタジオ外動作時はスタブする。
- Cloud Run では Secret Manager を介して環境変数を注入し、Cloud SQL への接続は `cloud-run-runtime@...` の `roles/cloudsql.client` を利用。

## Codex / Cursor ロールメモ（2025-11-13 更新）
- **配置転換**: 本チャット以降は Cursor がバックエンド/クラウド開発（実装・`gcloud`/Terraform 操作）を担当し、Codex はレビュー専任ロール（外部ネットワークへ接続不可だが要件矛盾の精査や設計レビューに集中）へ移行。
- **Codex の現状タスク**:
  1. Cursor が実装した Cloud Build / Stripe / Gemini まわりの成果物をレビューし、公式ドキュメントとの整合性や要件ギャップを指摘。
  2. CI/CD・インフラの要件や仕様に矛盾がないかを深く検証し、必要に応じて AGENTS.md / handoff ドキュメントを更新。
  3. 次フェーズで必要となる Terraform 取込みや Secret 運用の方針について、Cursor へフィードバックを渡す。
- **Cursor の現状タスク**:
  - Stripe Phase 5 継続（Checkout/Webhook/Usage 管理）、Cloud Build トリガー運用、GCP 実作業などエンジニアリング全般。
- **インフラ進捗サマリ**:
  - `infra/` 配下のモジュール化完了、Cloud Run 〜 Secret Manager 連携済み。
  - Cloud Build はユーザー管理 SA + Secret Manager 連携 + GitHub トリガー整備済み（Node 20 イメージ化も完了）。デフォルト substitutions の更新は `gcloud builds triggers update ... --update-substitutions` で対応する。
- **次の検討ポイント**:
  1. 手動デプロイ済み Cloud Run を Terraform state へ `terraform import` で取り込む（権限端末必須）。
  2. `infra/envs/dev/terraform.tfvars` 本番値反映と `terraform plan/apply` 再実行。
  3. Stripe Webhook シークレット更新フローの運用品質向上（Secret Manager v 管理）。
  4. 監視/アラート、SA キーローテーション、Cloud Build Node 版管理など長期運用タスク。
- **留意事項**:
  - Codex は外部ネットワークへアクセスできないため、ドキュメント参照はリポジトリ内の資料に限定。必要な CLI 実行は Cursor に依頼する。
  - Terraform / Stripe / gcloud など外部操作は必ず Cursor 側（権限端末）で行い、Codex は手順レビューと整合性確認に徹する。
