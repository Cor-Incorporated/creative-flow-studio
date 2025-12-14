# 次PR（UI/UX改善メイン）対応項目まとめ

作成日: 2025-12-13  
対象: `feature/auth-multi-login-hardening` の後続PR（UI/UX中心）  
前提ドキュメント: `docs/interface-spec.md`（Error Handling Contract / UI表示ルール）, `CLAUDE.md`（UX/Error規約）, `docs/handoff-2025-12-13-auth-redirect-incident.md`（canonical host / OAuth障害）

---

## 目的（今回の後続PRで達成したいこと）

- 認証後UI/認証UIの両方で、**エラーが「ユーザーが次に何をすべきか」まで分かる形で表示される**こと
- 生成API（chat/image/video）の失敗理由を、**安定したエラーコード＋サポートID**としてユーザーに提示できること
- OAuth/credentials の「方法違い」「リンク不可」など、よく起きる詰まりを **UIで自己解決できる導線**にすること

---

## Must（次PRで必ず対応したいUI/UX）

### 1) Auth UIのエラー表示を“規約通り”に統一

**対象**: `app/auth/signin/page.tsx`, `app/auth/register/page.tsx`, `app/auth/error/page.tsx`

- **サインイン/登録画面の表示ポリシーを統一**
  - `CredentialsSignin` など NextAuth 由来コードと、サーバーが投げた日本語メッセージが混在するため、画面側で
    - **安全に出して良いメッセージ（日本語）**
    - **汎用メッセージへフォールバックする条件**
    を明文化して実装する
- **`OAuthAccountNotLinked` の案内を強化**
  - メッセージだけでなく、UI上で
    - 「Googleでログイン」ボタン
    - 「メールでログイン」フォーム
    の両方がすぐ押せる状態に誘導する（迷子防止）
- **`EmailNormalizationConflict` / `SubscriptionInitFailed` の案内を強化**
  - `app/auth/error/page.tsx` の文言に加えて、問い合わせ用に「サポートに伝える情報（例: 発生時刻、利用メール種別）」のガイドを追加
  - （可能なら）`requestId` 相当があれば表示する（現状NextAuth側では難しいので、次PRでは「表示できない理由」を明記してOK）

### 2) 生成APIエラーのユーザー表示を一段上げる（認証後UI）

**対象**: `app/page.tsx`（`handleApiError` 周辺）, `components/Toast.tsx` / エラーUI

`jsonError()` で返る **`error`, `code`, `requestId`, `X-Request-Id`** を前提に、以下をUI規約として固定する:

- **表示**: Toast + 必要に応じてインライン（`docs/interface-spec.md` 0.1.3準拠）
- **サポートID**: `requestId` がある場合は必ず「サポートID: <requestId>」を表示
- **行動導線**:
  - `UNAUTHORIZED` → ログイン導線（`/auth/signin`）
  - `FORBIDDEN_PLAN` / `RATE_LIMIT_EXCEEDED` → `/pricing` 導線
  - 上流障害/一時失敗系 → 「時間をおいて再試行」＋サポートID
- **Retry-After の表示**（現状は固定値のため “目安” として表示）
  - 画面上では「◯時間後に再試行」など、過度に断定しない文言にする

### 3) 送信中/リトライ/失敗時のUX改善（生成実行）

**対象**: `components/ChatInput.tsx`, `app/page.tsx`

- 送信中は二重送信しない（ボタン無効化、スピナー）
- 失敗後に「同じ入力で再試行」が1クリックでできる（直前プロンプト保持）
- 失敗が続く場合に「プラン/ログイン/時間を置く」の判断ができる表示

---

## Should（次PRで可能なら入れたい）

### 4) サインアップ時の入力バリデーション（UI側）

**対象**: `app/auth/register/page.tsx`, `app/auth/signin/page.tsx`

- すでにサーバー側で `MIN_PASSWORD_LENGTH` / `MAX_PASSWORD_LENGTH` を持っているので、UI側はそれに合わせて
  - パスワード条件の表示（短い/長いの即時フィードバック）
  - Email形式の簡易バリデーション（HTML `type=email` 以上のガイド）
  - 表示名の最大長/空白の扱いの説明（サーバー側は `sanitizeDisplayName()` 済み）

### 5) テストパターンのドキュメント化（Vitestのmock污染対策）

**対象**: `vitest.setup.ts` または `docs/testing-plan.md` への追記

- 動的import（`beforeEach(async () => ({ GET } = await import(...)))`）を採用している理由と手順を短く記載する
- 「いつdynamic importを使うべきか」を判断できるようにする（API route の module cache / vi.mock の都合）

---

## Out of scope（次PRではやらないが、別PRで計画すべき）

- **パスワードリセット/アカウント回復フロー**（credentials導入後の必須機能）
- **登録/ログインのrate limit**（WAF/Cloud Armor/アプリ側いずれでやるか方針決めが必要）
- **credentials のメール検証**（`allowDangerousEmailAccountLinking` を安全に解放する前提）
- **E2E（Playwright）で canonical host + OAuth 回帰テスト**（環境依存が大きいので整備計画が必要）

---

## 実装メモ（既存の契約/規約）

- APIエラーは `lib/api-utils.ts` の `jsonError()` を使い、UIは `code` と `requestId` を解釈して表示する（`docs/interface-spec.md` 0.1.1 / 0.1.3）。
- NextAuthエラーは `/auth/error?error=<CODE>` に集約し、`CODE` を日本語へマッピングする（`docs/interface-spec.md` 0.1.2）。
- Cloud Run + custom domain では canonical host が重要（`docs/handoff-2025-12-13-auth-redirect-incident.md`）。



