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

## 🟢 完了済みフェーズ（アーカイブ）

> 詳細は `.claude/archive/completed-phases.md` を参照

- **フェーズ1**: コア機能（認証/Gemini API/Stripe/管理画面等） - 519 tests ✅
- **フェーズ2.5**: 命名/ドメイン表記ゆれ統一（BlunaAI） ✅
- **フェーズ2.6**: 動画生成（Veo）複数画像対応 ✅
- **フェーズ2.8**: パスワード変更機能 ✅

---

## 🟡 フェーズ2: インフラ整備 `pm:依頼中`

> **担当**: Cursor (PM)

- [ ] Cloud Run 認証設定 (NextAuth 環境変数) `pm:依頼中`
- [ ] Google OAuth リダイレクト URI 登録 `pm:依頼中`
- [x] N+1 クエリ最適化 (admin/users API) `pm:確認済`
- [ ] Cloud SQL セキュリティ指摘の是正（公開IP/監査/パスワードポリシー等） `pm:依頼中`
- [ ] **prod環境をTerraformで新設**（Cloud Run/Secret/Env）し、`blunaai.com` を **dev→prodへ付け替え** `pm:依頼中`
- [ ] **Stripeを本番アカウントへ移行**（prodのみ live、devはtestのまま） `pm:依頼中`
- [ ] **DBは当面devとprodで同一Cloud SQL**（分離は後続） `pm:依頼中`

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

## 🟢 フェーズ2.6.3: Veo 3.1 (fast) の実仕様に合わせた動画生成入力/UX/テスト修正 `cc:完了`

> **背景**: Cloud Run の `stderr` にて、現行モデルが `config.referenceImages` を拒否する（INVALID_ARGUMENT 400）ことが判明。
> **影響**: 複数参照画像UI/ペイロードは"できそうに見えるが失敗する"状態になり、顧客体験が致命的。

### 受け入れ基準（Acceptance Criteria）

- [x] **動画生成**: 参照画像ありの動画生成が **500にならず成功**する（少なくとも「先頭1枚で生成」フローが成立） `cc:完了`
- [x] **UI**: VIDEO モードの参照画像UIは実態に合わせる（1枚のみ許可に変更） `cc:完了`
- [x] **テスト**: `__tests__/api/gemini/video.test.ts` の期待値を現実に合わせて更新（`referenceImages` 非対応前提） `cc:完了`
- [x] **決定ログ**: `.claude/memory/decisions.md` を更新（referenceImages方針の変更/暫定仕様） `cc:完了`

### 影響ファイル

- `lib/gemini.ts`（generateVideos 入力）
- `app/api/gemini/video/route.ts`
- `components/ChatInput.tsx`
- `app/page.tsx`
- `__tests__/api/gemini/video.test.ts`

---

## 🟢 フェーズ2.6.4: 動画ダウンロード（/api/gemini/video/download）403/Forbidden の調査と改善 `cc:完了`

> **症状**: `/api/gemini/video/download` が 403 を返すケースがある（同一ユーザー/同一会話で複数回）。
> **ログ根拠**: `stderr` に `Failed to fetch video from Gemini: Forbidden`。

### 受け入れ基準（Acceptance Criteria）

- [x] **原因特定**: 上流403のレスポンス内容/条件をログ（requestId付き）で追える `cc:完了`
- [x] **UX改善**: 403/期限切れ等のケースでユーザーに分かる案内（再生成/再試行）を提示できる `cc:完了`
- [x] **堅牢化**: `uri`/`file`/`mimeType` パラメータの扱いとエラー時ステータスを整理し、意図しない403を減らす `cc:完了`

### 影響ファイル

- `app/api/gemini/video/download/route.ts`
- `app/page.tsx`（ダウンロード失敗時の表示/リトライ導線）

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
> **対象（追記）**: フェーズ2.6 系の修正（例: 2.6.3/2.6.4 の “Veo実仕様対応・download 403 UX改善”）も、このPR/CIゲートを必須とする。

### 受け入れ基準（Acceptance Criteria）

- [ ] develop 向け PR が作成されている `cc:WIP`
- [ ] **CI/CD が全てグリーン**（**1つでも赤/未完了ならマージ禁止**） `cc:WIP`
- [ ] コンフリクトが発生した場合は解消済み `cc:WIP`
- [ ] 上記を満たした状態で develop にマージ済み `cc:WIP`

### Claude Code への依頼（PM）

- [ ] **PR作成**: 変更（2.6.3/2.6.4）を含む develop 向けPRを作成 `cc:WIP`
- [ ] **ローカル検証**: `npm test` / `npm run build` を実行し結果をPR本文に記載 `cc:WIP`
- [ ] **CI監視**: すべてグリーンになるまで修正・push を繰り返す `cc:WIP`
- [ ] **報告**: `/handoff-to-cursor` で PR URL と CI 状態を報告 `cc:WIP`

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
