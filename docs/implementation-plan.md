# Creative Flow Studio 実装計画

最終更新: 2025-12-01
ステータス: **コア機能完了** - Cloud Run 認証設定待ち

---

## 1. 実装ステータス

### ✅ 完了済みフェーズ

| Phase | 内容 | 完了日 | テスト数 |
|-------|------|--------|----------|
| 2 | 環境セットアップ | 2025-11-12 | - |
| 3 | 認証基盤 | 2025-11-12 | - |
| 4 | 会話永続化 | 2025-11-13 | 33 |
| 5 | Stripe 統合 | 2025-11-13 | 37 |
| 5 | Subscription Utilities | 2025-11-13 | 23 |
| 6 | 管理画面 | 2025-11-13 | 48 |
| - | Shared API Utilities | 2025-11-28 | 14 |
| - | Validators | 2025-11-28 | 9 |
| - | Landing Page & Auth UX | 2025-11-17 | - |
| - | Gemini API | - | 18 |
| - | Example tests | - | 3 |

**合計テスト数:** 185 passing ✅

### 実装済み機能

**Gemini API 統合:**

- ✅ Chat/Pro/Search モード (`/api/gemini/chat`)
- ✅ 画像生成・編集 (`/api/gemini/image`)
- ✅ 動画生成 (`/api/gemini/video`)
- ✅ 動画ステータスポーリング (`/api/gemini/video/status`)
- ✅ セキュアダウンロード (`/api/gemini/video/download`)
- ✅ 使用量制限の適用

**会話永続化:**

- ✅ 会話 CRUD API (POST/GET/PATCH/DELETE)
- ✅ メッセージ追加 API
- ✅ サイドバー UI
- ✅ 自動保存

**Stripe 課金:**

- ✅ Checkout Session
- ✅ Customer Portal
- ✅ Webhook (5 イベント + idempotency)
- ✅ サブスクリプション管理
- ✅ 使用量ログ

**管理画面:**

- ✅ RBAC ミドルウェア
- ✅ ユーザー管理 UI
- ✅ 使用量モニタリング
- ✅ システム統計

**UI/UX:**

- ✅ Landing Page (未認証ユーザー向け)
- ✅ Toast 通知システム
- ✅ Tailwind v4 移行
- ✅ SVG favicon
- ✅ パスワード表示/非表示トグル機能
- ✅ モバイルレスポンシブ対応（全ページ）
- ✅ iOSズーム防止（font-size: 16px）
- ✅ ノッチ付きデバイス対応（safe-area-inset）
- ✅ ChatInput自動リサイズ機能

---

## 2. 保留中タスク（インフラ）

### P0: Cloud Run 認証設定（Cursor）

```
問題: NextAuth 環境変数が Cloud Run で未設定
結果: ログインしても 401 エラー
```

**必要な作業:**

1. Google OAuth redirect URI を登録:
   `https://creative-flow-studio-dev-w5o5e7rwgq-an.a.run.app/api/auth/callback/google`

2. Secret Manager にシークレット追加:
   - `nextauth-url`
   - `nextauth-secret`
   - `google-client-id`
   - `google-client-secret`

3. Cloud Run サービスアカウントに Secret Accessor ロール付与

4. 環境変数を Cloud Run に設定

**検証方法:**

```bash
# 1. ログインボタンクリック → Google OAuth 画面
# 2. ログイン成功 → ログアウトボタン表示
# 3. /api/auth/session が { user: {...} } を返す
# 4. チャット送信が 401 を返さない
```

### P1: N+1 クエリ最適化（Cursor）

```
場所: app/api/admin/users/route.ts (lines 174-186)
問題: 各ユーザーに対して prisma.usageLog.count() を個別実行
```

**修正方針:**

```typescript
// Before: N+1
const usersWithStats = await Promise.all(
    users.map(async user => {
        const usageCount = await prisma.usageLog.count({...});
        return { ...user, usageCount };
    })
);

// After: groupBy
const usageCounts = await prisma.usageLog.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: { userId: { in: userIds } },
});
```

---

## 3. 将来の改善タスク

### P2: テスト強化

- [ ] E2E テスト拡充 (Playwright)
- [ ] Stripe webhook 統合テスト
- [ ] Load テスト

### P3: 監視・運用

- [ ] Cloud Monitoring アラート設定
- [ ] Error tracking (Sentry 等)
- [ ] Performance monitoring

### P4: 機能拡張

- [ ] ファイルアップロード (Cloud Storage)
- [ ] 会話エクスポート
- [ ] 複数言語対応

---

## 4. 完成定義（DoD）

| 機能 | 定義 | ステータス |
|------|------|------------|
| 会話 | CRUD + メッセージが DB 永続化、UI で再読込時も表示 | ✅ |
| 画像 | 生成・編集が UI 表示、DL 可能 | ✅ |
| 動画 | 生成→ポーリング→ダウンロードが完了、API キー非露出 | ✅ |
| 課金 | Checkout→Webhook→Subscription→Portal が通る | ✅ |
| 制限 | limit 超過で 429/403 が返る | ✅ |
| RBAC | /admin は ADMIN のみ、middleware で遮断 | ✅ |
| 認証 | Cloud Run で Google OAuth が動作 | ❌ (設定待ち) |

---

## 5. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 14 (App Router)              │
├─────────────────────────────────────────────────────────┤
│  Pages                │  API Routes                     │
│  ─────                │  ──────────                     │
│  / (Chat + Landing)   │  /api/auth/*     (NextAuth)     │
│  /pricing             │  /api/gemini/*   (AI)           │
│  /dashboard           │  /api/conversations/* (CRUD)   │
│  /admin/*             │  /api/stripe/*   (Billing)      │
│                       │  /api/admin/*    (Management)   │
├─────────────────────────────────────────────────────────┤
│  Libraries            │  External Services              │
│  ─────────            │  ─────────────────              │
│  lib/auth.ts          │  Google Gemini API              │
│  lib/gemini.ts        │  Stripe API                     │
│  lib/stripe.ts        │  Google OAuth                   │
│  lib/subscription.ts  │  Cloud SQL (PostgreSQL)         │
│  lib/api-utils.ts     │                                 │
│  lib/validators.ts    │                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 6. GCP インフラ

| リソース | 詳細 |
|----------|------|
| Project | `dataanalyticsclinic` |
| Region | `asia-northeast1` |
| Cloud Run | `creative-flow-studio-dev` |
| Cloud SQL | PostgreSQL (Private IP) |
| Secret Manager | 環境変数管理 |
| Artifact Registry | `creative-flow-studio` |
| Terraform State | `gs://dataanalyticsclinic-terraform-state` |

---

## 7. ロールと責務

| ロール | 担当 | 現在のタスク |
|--------|------|--------------|
| Claude Code | フロント、API、テスト、ドキュメント | ドキュメント更新 ✅ |
| Cursor | バックエンド、インフラ、デプロイ | 認証設定、N+1最適化 |
| Codex | レビュー専任 | セキュリティ監査 |

---

## 8. 開発規約

- TypeScript, 4 spaces, single quotes
- App Router パターン
- Prisma + NextAuth (DB セッション)
- Server-side Gemini API 呼び出し
- Tailwind CSS クラス
- Vitest/Playwright テスト
