# 完了済みフェーズ（アーカイブ）

> Plans.md から移動した完了済みタスクの詳細記録

---

## フェーズ1: コア機能 `cc:完了`

- [x] 環境セットアップ (Next.js 14, Prisma, Tailwind v4)
- [x] 認証機能 (NextAuth.js + Google OAuth + Email/Password)
- [x] Gemini API 統合 (Chat/Pro/Search/Image/Video)
- [x] 会話永続化 (CRUD + Messages)
- [x] Stripe 統合 (Checkout/Portal/Webhooks)
- [x] サブスクリプション管理
- [x] 管理ダッシュボード (RBAC + Users/Usage)
- [x] インフルエンサーモード (DJ社長)
- [x] チャットサイドバー
- [x] モバイルレスポンシブ対応
- [x] モード切り替え機能

**テスト**: 519 passing

---

## フェーズ2.5: 命名/ドメイン表記ゆれ統一 `cc:完了`

- **正のドメイン**: `blunaai.com`
- **正のプロダクト表示名**: `BlunaAI`
- [x] `bulnaai.com` → `blunaai.com` 修正
- [x] `BulnaAI` → `BlunaAI` 統一（23ファイル更新）
- [x] テスト全通過（600テスト）

---

## フェーズ2.6: 動画生成（Veo）複数画像対応 `cc:完了`

- [x] API: `/api/gemini/video` が複数画像（最大8枚）を受け取れる
- [x] UI: VIDEO モードで複数枚アップロード可能

> **注意**: Veo 3.1 fast は `config.referenceImages` 非対応。先頭1枚のみ使用する暫定対応済み。

---

## フェーズ2.6.3: Veo 3.1 (fast) 実仕様対応 `cc:完了`

- [x] VIDEO モードのUI を1枚制限に変更
- [x] テスト期待値を現実に合わせて更新
- [x] decisions.md 更新

---

## フェーズ2.6.4: 動画ダウンロード 403 対応 `cc:完了`

- [x] 上流403のログ強化（エラーボディ記録）
- [x] UX改善（ユーザー向けヒント表示）

---

## フェーズ2.8: パスワード変更機能 `cc:完了`

- [x] API: `POST /api/auth/change-password`
- [x] UI: `/auth/change-password` 画面
- [x] ユニットテスト追加（29テスト）

実装ファイル:
- `app/api/auth/change-password/route.ts`
- `app/auth/change-password/page.tsx`
- `app/dashboard/page.tsx`（導線追加）
- `__tests__/api/auth/change-password.test.ts`

---

## フェーズ2.6.5: 動画（Veo 3.1）複数参照画像（最大3枚） `cc:完了`

- [x] モデル変更: `veo-3.1-fast-generate-preview` → `veo-3.1-generate-preview`
- [x] `lib/gemini.ts` の `generateVideo()` が `config.referenceImages`（ASSET）で送信
- [x] `/api/gemini/video` が参照画像 最大3枚をバリデーション
- [x] UI で VIDEO の参照画像が最大3枚まで添付可能
- [x] テスト更新

---

## フェーズ2.6.6: 画像（Vertex AI）複数参照画像 `cc:完了`

- [x] `lib/gemini.ts` に `generateOrEditImageWithReferences()` 追加（Vertex AI経由）
- [x] `/api/gemini/image` が `referenceImages?: Media[]` を受け取り、Vertex AI 経由で処理
- [x] UI で「ベース画像（1枚）+ 参照画像（最大3枚）」を扱える
- [x] テスト追加

**インフラ前提**: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` 環境変数が必要
