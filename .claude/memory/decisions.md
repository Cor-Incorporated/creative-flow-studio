# Decisions

## 2025-12-26: プロダクト表記・ドメインの正規化

- **採用案**: B案
- **正のプロダクト表示名**: `BlunaAI`
- **正のドメイン**: `blunaai.com`
- **禁止/修正対象**:
  - `bulnaai.com`（typo）
  - `BulnaAI`（表示名としては不採用。必要ならDocs等で移行注記）
- **補足**:
  - dev 環境は Cloud Run の `*.run.app` を正として運用し、カスタムドメインは将来移行。
  - Google OAuth の承認済みリダイレクトURI/JS生成元は `*.run.app` と `blunaai.com` の両方を許可しておく。

## 2025-12-26: 動画生成（Veo）複数参照画像入力

- **対象**: `/api/gemini/video`（Veo）
- **用途**: 画像は **すべて参照画像（reference images）**として扱う
- **最大枚数**: **8枚**
- **入力形式**: **data URL**（`Media.url` + `Media.mimeType`）で複数送信
- **後方互換**: 1枚入力も許可（既存UI/既存クライアント互換）
- **実装方針**:
  - サーバ側は `@google/genai` の `generateVideos` に対し `config.referenceImages`（配列）で渡す
  - フロント側は VIDEO モードで複数画像を選択・保持し、APIへ配列で送信

## 2025-12-28: Veo 3.1 fast の実仕様（referenceImages 非対応）に合わせた方針変更

- **発見（Cloud Runログ）**: `veo-3.1-fast-generate-preview` が `config.referenceImages` を拒否する
  - エラー: `` `referenceImages` isn't supported by this model. ``（INVALID_ARGUMENT 400）
- **暫定方針**: 参照画像は **先頭1枚のみ**を `image` 入力として渡す（複数参照画像はUI/仕様を見直し）
- **UI対応**: VIDEO モードの画像アップロード上限を **1枚** に制限
  - `ChatInput.tsx`: `MAX_VIDEO_REFERENCE_IMAGES = 1` を追加
  - エラーメッセージ: 「動画生成では参照画像は1枚のみ使用できます」
- **API対応**: 後方互換のため、APIは引き続き最大8枚を受け付けるが、`lib/gemini.ts` の `generateVideo` は先頭1枚のみ使用
- **TODO**: 複数参照画像を実現する場合は、対応モデル/Vertex AI等の方式を含めて再検討する

## 2025-12-28: video/download 403 エラーの調査とUX改善

- **症状**: `/api/gemini/video/download` が 403 を返すケースがある
- **根本原因**: 上流（generativelanguage API）から 403 Forbidden を返されている
  - Gemini API のファイルは **48時間で有効期限切れ** になる
  - 参照: https://ai.google.dev/gemini-api/docs/video
- **対応**:
  - ログ強化: エラーボディの内容（最大500文字）をログに出力
  - UXメッセージ: 403時は「動画の有効期限が切れている可能性があります。動画を再生成してください。」と案内
  - `hint` フィールドをエラーレスポンスに追加し、フロントエンドで表示

## 2025-12-28: 本番ドメイン/本番課金への移行方針（最短・低リスク）

- **方針**: 本番課金（Stripe live）へ入る場合、`creative-flow-studio-dev` をそのまま本番化せず、**Terraformで prod 環境を新設**して `blunaai.com` を **prodへ付け替える**
- **理由**: dev と prod を分けた意味（誤課金/データ汚染防止）を維持するため
- **DB**: 当面は dev/prod とも **同一 Cloud SQL** を使用（DB分離は後続）
- **Stripe**:
  - prod には **live** の `STRIPE_*`（secret/publishable/webhook secret）を注入
  - dev は **test** の `STRIPE_*` を維持（切替途中の400/署名不一致を避ける）
- **ドメイン**: canonical host を `blunaai.com` に統一（`NEXTAUTH_URL`/OAuth/Stripe webhook URL を整合させる）

## 2025-12-28: 複数参照画像の本対応（フェーズ2.6.5/2.6.6）

### 動画（Veo 3.1）
- **モデル変更**: `veo-3.1-fast-generate-preview` → `veo-3.1-generate-preview`
  - `veo-3.1-generate-preview` は `config.referenceImages`（ASSET）をサポート
- **最大枚数**: **3枚**
- **実装**: `lib/gemini.ts` の `generateVideo()` が `config.referenceImages` で送信

### 画像（Vertex AI）
- **背景**: Gemini Developer API の `editImage` は `referenceImages` 未対応
- **対応**: 参照画像がある場合は **Vertex AI 経由**で処理
- **新関数**: `generateOrEditImageWithReferences()` を追加
- **モデル**: `imagen-3.0-capability-001`
- **最大枚数**: **3枚**（ベース画像は別枠）
- **インフラ前提**:
  - `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` 環境変数
  - Cloud Run 実行SAに Vertex AI 利用権限
