# Repository Guidelines

## Current Status (2025-11-28)

**Branch**: `feature/admin-dashboard-final` (dev base)
**Tests**: 136 passing ✅
**Phase**: All core features complete, pending Cloud Run auth setup

---

## Development Tool Roles

### Claude Code (フルスタック実装)

**担当:**
- Next.js フロントエンド・バックエンド実装
- API Routes 開発とテスト
- React コンポーネント作成
- Vitest / Playwright テスト作成
- ドキュメント更新

**特徴:**
- 外部接続可能（Web検索、API呼び出し可）
- MCP サーバー統合（Serena）による高度なコード解析

**制約:**
- GCP / Terraform は Cursor が管理

### Cursor (バックエンド・クラウド開発)

**担当:**
- クラウドインフラ（GCP, Terraform, Cloud Build）
- Secret Manager / 環境変数設定
- Cloud Run デプロイ
- バックエンドパフォーマンス最適化

**現在のタスク:**
1. NextAuth 環境変数を Cloud Run に設定
2. Google OAuth redirect URI を登録
3. N+1 クエリの最適化（admin/users API）

### Codex (レビュー専任)

**担当:**
- 要件定義の矛盾チェック
- アーキテクチャ・セキュリティレビュー
- コード品質監査
- Terraform / IaC レビュー

**特徴:**
- 外部接続不可（Web検索、API呼び出しできない）
- リポジトリ内の資料のみ参照可能
- 実装は行わず、レビューに専念

---

## Branch Strategy

- **main**: Alpha版 (React + Vite)、Vercel デプロイ
- **dev**: Next.js 14 フルスタック SaaS 開発ブランチ
- **feature/admin-dashboard-final**: 現在の作業ブランチ

---

## GCP Infrastructure

**Project**: `dataanalyticsclinic`
**Region**: `asia-northeast1`
**Cloud Run URL**: `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app`

**Service Accounts:**
- `cloud-run-runtime@...` - Cloud Run 実行
- `667780715339@cloudbuild.gserviceaccount.com` - Cloud Build
- `terraform@...` - Terraform 管理

**Terraform State**: `gs://dataanalyticsclinic-terraform-state`

---

## Development Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Production build
npm run type-check    # TypeScript check

# Testing
npm test              # Vitest
npm run test:e2e      # Playwright

# Database
npm run prisma:generate   # Generate client
npm run prisma:migrate    # Run migrations
npm run prisma:studio     # Open Studio

# Linting
npm run lint          # ESLint
npm run format        # Prettier
```

---

## Coding Conventions

- TypeScript, 4 spaces, single quotes
- App Router pattern
- Prisma + NextAuth (DB sessions)
- Server-side Gemini API calls
- Tailwind CSS classes
- Vitest/Playwright for testing

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Developer documentation |
| `docs/onboarding.md` | Quick start guide |
| `docs/implementation-plan.md` | Implementation status |
| `docs/interface-spec.md` | API contracts |
| `docs/testing-plan.md` | Manual validation |
| `docs/stripe-integration-plan.md` | Stripe/Plan setup |

---

## Commit Guidelines

- Conventional Commits format
- Small, focused commits
- Include verification steps in PR
- Screenshots for UI changes

```bash
# Examples
feat: Add user authentication
fix: Resolve video download issue
docs: Update API documentation
test: Add conversation API tests
```
