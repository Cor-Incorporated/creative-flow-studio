# Plans.md - BlunaAI 開発計画

> **最終更新**: 2025-12-27
> **現在のブランチ**: feature/multi-image-enhancements
> **モード**: 2-Agent (Cursor + Claude Code)

---

## マーカー凡例

| マーカー | 状態 | 担当 |
|---------|------|------|
| `cc:TODO` | 未着手 | Claude Code |
| `cc:WIP` | 作業中 | Claude Code |
| `cc:blocked` | ブロック中 | 依存待ち |
| `cc:完了` | 完了 | Claude Code |
| `pm:依頼中` | PM から依頼 | Cursor |
| `pm:確認済` | PM 確認完了 | Cursor |

---

## 🟢 フェーズ1: コア機能 `cc:完了`

- [x] 環境セットアップ (Next.js 14, Prisma, Tailwind v4) `cc:完了`
- [x] 認証機能 (NextAuth.js + Google OAuth + Email/Password) `cc:完了`
- [x] Gemini API 統合 (Chat/Pro/Search/Image/Video) `cc:完了`
- [x] 会話永続化 (CRUD + Messages) `cc:完了`
- [x] Stripe 統合 (Checkout/Portal/Webhooks) `cc:完了`
- [x] サブスクリプション管理 `cc:完了`
- [x] 管理ダッシュボード (RBAC + Users/Usage) `cc:完了`
- [x] インフルエンサーモード (DJ社長) `cc:完了`
- [x] チャットサイドバー `cc:完了`
- [x] モバイルレスポンシブ対応 `cc:完了`
- [x] モード切り替え機能 `cc:完了`

**テスト**: 519 passing

---

## 🟡 フェーズ2: インフラ整備 `pm:依頼中`

> **担当**: Cursor (PM)

- [ ] Cloud Run 認証設定 (NextAuth 環境変数) `pm:依頼中`
- [ ] Google OAuth リダイレクト URI 登録 `pm:依頼中`
- [x] N+1 クエリ最適化 (admin/users API) `pm:確認済`
- [ ] Cloud SQL セキュリティ指摘の是正（公開IP/監査/パスワードポリシー等） `pm:依頼中`

---

## 🟢 フェーズ2.8: パスワード変更機能（ログイン後に自己変更できる導線） `cc:完了`

> **目的**: 初期PW配布ユーザーが、ログイン後に安全にパスワード変更できるようにする（UI + API）。
> **背景**: Cloud SQL 側の「パスワードポリシー」是正と併せ、アプリ側でも最短導線で変更できる必要がある。

### 要件（PM）

- ログイン済みユーザーが `/auth/change-password` でパスワード変更できる
- 既存の credentials ユーザーは「現在のパスワード」必須
- Google OAuth のみで password 未設定のユーザーは「現在のパスワード」なしで設定できる
- 変更成功/失敗を UI に表示（Toast 等でOK）

### 受け入れ基準（Acceptance Criteria）

- [x] API: `POST /api/auth/change-password` が実装されている `cc:完了`
  - [x] バリデーション: `newPassword` は 8〜128 文字 `cc:完了`
  - [x] `user.password` が存在する場合のみ `currentPassword` を要求・検証 `cc:完了`
  - [x] 成功時に `users.password` を PBKDF2 形式で更新 `cc:完了`
  - [x] 監査ログ（`audit_logs`）に `auth.password_changed` を記録 `cc:完了`
- [x] UI: `/auth/change-password` 画面がある `cc:完了`
  - [x] 変更後は `/dashboard` へ戻れる導線 `cc:完了`
- [x] 既存フロー（signin/register/google OAuth）を壊さない `cc:完了`
- [x] ユニットテスト追加（可能なら） `cc:完了`

### 実装ファイル

- `app/api/auth/change-password/route.ts`（新規作成）
- `app/auth/change-password/page.tsx`（新規作成）
- `app/dashboard/page.tsx`（導線追加: 「パスワード変更」リンク）
- `__tests__/api/auth/change-password.test.ts`（新規作成: 29テスト）

---

## 🟢 フェーズ2.5: 命名/ドメイン表記ゆれ統一 `cc:完了`

> **背景**: `blunaai.com` / `bulnaai.com` / `BulnaAI` / `BlunaAI` が混在し、OAuth/Stripe/表示/ドキュメントの整合が崩れやすい。
> **目的**: 「何を正とするか」を決め、フロント/サーバ/スクリプト/ドキュメントで一貫させる。

### 要件（PM）

- **正のドメイン**: `blunaai.com`（カスタムドメインとして将来利用。dev は run.app を正にする）
- **正のプロダクト表示名**: `BlunaAI`（B案）
- **正の内部識別子**: `package.json` の `"name"`（現状 `bulnaai`）は **変更しない**（npm/package識別子として許容）

### 受け入れ基準（Acceptance Criteria）

- [x] **ドメイン**: `bulnaai.com` という誤記が **コード/スクリプト/ドキュメントから消える** `cc:完了`
- [x] **表示名**: 画面タイトル/見出し/メタデータが **単一表記に統一**される `cc:完了`
- [ ] **OAuth**: Google OAuth の「承認済みリダイレクトURI/JS生成元」が、採用したドメイン方針と一致している `pm:依頼中`
- [x] **Stripe**: `appInfo.url` / 各種 URL 表示が方針と一致している `cc:完了`
- [x] **テスト**: 既存テストが落ちない（落ちた場合は期待値を更新して復旧） `cc:完了`
- [ ] **CI/CD**: PR 作成時に **CI/CD がオールグリーンになるまで**を完了条件とする `cc:WIP`
- [ ] **コンフリクト**: ベースブランチ更新等でコンフリクトが発生した場合は **解消してから**完了とする `cc:WIP`

### タスク分解

- [x] **pm:確認済**: 正の表記（`BlunaAI`）を決定し追記（決定ログ: `.claude/memory/decisions.md`）
- [x] **cc:完了**: リポジトリ全体で表記ゆれを一括修正（UI/サーバ/スクリプト/Docs/Tests）
  - [x] **cc:完了**: `bulnaai.com` → `blunaai.com`（コード内に残存なし）
  - [x] **cc:完了**: `BulnaAI` → `BlunaAI`（表示名として統一、23ファイル更新）
  - [x] **cc:完了**: 影響するテスト（E2E/Unit）と文言を更新（600テスト全通過）
  - [x] **cc:完了**: ドキュメント（`docs/*`）の見出し・本文の表記を統一

---

## 🟢 フェーズ2.6: 動画生成（Veo）入力を複数画像対応 `cc:完了`

> **背景**: 現状の `/api/gemini/video` は `media?: Media`（単数）で、`lib/gemini.ts` も `generateVideos({ image: ... })`（単数）しか渡していない。  
> **狙い**: Veo 3 の想定に合わせ、**少なくとも2枚以上**の画像を入力として渡せるようにする（必要なら上限も設ける）。

### 要件（PM）

- **最低枚数**: 2枚以上をサポート（1枚入力は後方互換として維持）
- **最大枚数**: 8枚
- **用途**: **全部参照画像（reference images）**
- **入力形式**: **data URL**（`Media` の `url` + `mimeType`）で複数送信

### 受け入れ基準（Acceptance Criteria）

- [x] **API**: `/api/gemini/video` が **複数画像（2枚以上、最大8枚）**を受け取れる `cc:完了`
- [x] **SDK呼び出し**: `@google/genai` の `generateVideos` に対し、複数画像を **`config.referenceImages`（配列）**で渡す `cc:完了`
- [x] **UI**: VIDEO モードで複数枚アップロードでき、送信時に全画像がAPIへ渡る `cc:完了`
- [x] **検証**: ユニットテストを追加/更新し、既存テストが通る `cc:完了`

### タスク分解

- **pm:確認済**: 「用途=参照画像」「最大8枚」「data URL」を確定（決定ログ: `.claude/memory/decisions.md`）
- **cc:完了**: API/型/バリデータ/フロントを改修（後方互換・エラー処理含む）
- **cc:完了**: `/__tests__/api/gemini/video.test.ts` に複数画像ケースを追加

---

## 🟡 フェーズ2.6.2: 動画モードで参照画像があるのに「参照できる画像がありません」が出る不具合修正 `pm:依頼中`

> **症状**: 複数参照画像をアップロードして動画生成しようとすると「参照できる画像がありません。まず画像を生成してください。」が出て送信できない。  
> **原因**: `app/page.tsx` の `handleSendMessage` が、プロンプト中の画像参照表現（例:「この画像」）検出時に `lastGeneratedImage` のみを見て即 return しており、ユーザー提供の `referenceImages` を考慮していない。

### 受け入れ基準（Acceptance Criteria）

- [ ] VIDEO モードで `referenceImages`（2〜8枚）を付けて送信する場合、`lastGeneratedImage` が無くてもブロックされない `cc:TODO`
- [ ] `referenceImages` があるときは、画像参照表現が含まれていても **自動注入（lastGeneratedImage注入）を行わない** `cc:TODO`
- [ ] 既存の「最後に生成した画像を参照して動画化/分析」フローは壊れない `cc:TODO`
- [ ] ユニットテスト（可能なら `__tests__/components/ChatInput.test.tsx` or 新規）で再現ケースを追加 `cc:TODO`

### 影響ファイル

- `app/page.tsx`（原因箇所）
- `lib/mediaReference.ts`（参照検出・自動注入ロジック）

---

## 🟡 フェーズ2.7: チャットで複数画像解析（最大8枚、data URL） `pm:依頼中`

> **背景**: 現状 `/api/gemini/chat` は `media?: Media`（単一）しか受けず、画像解析も1枚前提。  
> **狙い**: チャット/検索モードで **複数画像をまとめて解析**できるようにする（例: 8枚まで）。

### 要件（PM）

- **対象**: `/api/gemini/chat`（chat/search の画像解析）
- **入力**:
  - 後方互換として `media?: Media`（単一）は維持
  - 新規に `mediaList?: Media[]`（画像のみ）を追加し、最大 **8枚**
  - 形式は **data URL**（`Media.url` + `Media.mimeType`）
- **優先順位**: `mediaList` がある場合はそれを優先（`media` は無視）
- **制約**:
  - 画像のみ（動画は従来通り単一 `media.type === 'video'`）
  - 合計サイズ上限（例: 8MB など）は後続検討。まずは枚数上限のみでスタート。

### 受け入れ基準（Acceptance Criteria）

- [ ] UI（CHAT/SEARCH）で複数画像を選択でき、プレビュー/削除ができる `cc:TODO`
- [ ] `/api/gemini/chat` が `mediaList`（1〜8枚）を受け付け、Gemini へ **複数画像を同一リクエストで送る** `cc:TODO`
- [ ] `mediaList` が 9枚以上の場合は 400（VALIDATION_ERROR） `cc:TODO`
- [ ] 既存の単一 `media`（画像/動画）フローは壊れない `cc:TODO`
- [ ] ユニットテスト追加（API + UI） `cc:TODO`

### タスク分解（Claude Code）

- **cc:TODO**: 型追加
  - `types/app.ts` の `ChatRequest` に `mediaList?: Media[]` を追加
- **cc:TODO**: フロント
  - `components/ChatInput.tsx` を chat/search でも複数画像選択に対応（video と同様のUIを流用）
  - `app/page.tsx` で `mediaList` ペイロードを組み立てて `/api/gemini/chat` へ送信
- **cc:TODO**: API
  - `app/api/gemini/chat/route.ts` で `mediaList` を受け取り、`@google/genai` への contents.parts を複数画像に対応
  - safety/check/logUsage は既存の枠組みを維持
- **cc:TODO**: テスト
  - `__tests__/api/gemini/chat.test.ts`（存在しなければ新規）で 2枚/8枚/9枚のバリデーションと優先順位を確認
  - `__tests__/components/ChatInput.test.tsx` で複数画像送信を確認

---

## 🟡 フェーズ2.6.1: フェーズ2.6 を develop にマージ（PR/CI/CD） `cc:WIP`

> **目的**: フェーズ2.6 の変更を develop に安全に取り込む（CI/CD オールグリーン確認をゲートにする）。

### 受け入れ基準（Acceptance Criteria）

- [ ] develop 向け PR が作成されている `cc:WIP`
- [ ] **CI/CD が全てグリーン**（**1つでも赤/未完了ならマージ禁止**） `cc:WIP`
- [ ] コンフリクトが発生した場合は解消済み `cc:WIP`
- [ ] 上記を満たした状態で develop にマージ済み `cc:WIP`

### 参考

- `.claude/memory/patterns.md` の「PR作成〜CIオールグリーンまで（2-Agent）」に従う

---

## 🔴 フェーズ3: 追加機能 `cc:TODO`

> **担当**: Claude Code (Worker) - PM からの依頼待ち

- [ ] 新しいインフルエンサー追加 `cc:TODO`
- [ ] 使用量ダッシュボード改善 `cc:TODO`
- [ ] エクスポート機能 `cc:TODO`

---

## 📋 バックログ

- [ ] パフォーマンス最適化
- [ ] アクセシビリティ改善
- [ ] 国際化 (i18n) 対応
- [ ] PWA 対応

---

## 📝 セッション履歴

### 2025-12-26
- 2-Agent ワークフロー導入
- Plans.md 作成
- Cursor コマンドファイル生成

### 2025-12-17
- モード切り替えバグ修正
- テストカバレッジ拡充 (519 tests)
