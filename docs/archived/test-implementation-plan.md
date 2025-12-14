# テスト実装計画書

**作成日**: 2025-12-13
**対象**: UI/UX改善実装に伴うテストカバレッジ拡充

---

## 1. 現状分析

### 1.1 テストカバレッジの概要

| カテゴリ | ファイル | 現在のカバレッジ | ギャップ |
|----------|---------|-----------------|---------|
| **新規Libファイル** | `lib/auth-errors.ts` | 0% | 全関数未テスト |
| | `lib/gemini-safety.ts` | 0% | 全関数未テスト |
| **修正コンポーネント** | `components/Toast.tsx` | 0% | 新props未テスト |
| | `components/ChatInput.tsx` | 0% | リトライバナー+Cmd+Enter未テスト |
| **修正ページ** | `app/page.tsx` | 0% | formatRetryAfter, リトライハンドラ未テスト |
| **APIルート** | `gemini/chat/route.ts` | ~50% | 安全性チェック未テスト |
| | `gemini/image/route.ts` | ~60% | 安全性チェック未テスト |
| | `gemini/video/route.ts` | ~50% | mediaパラメータ+安全性未テスト |
| | `conversations/[id]/messages/route.ts` | ~70% | modeパラメータ未テスト |
| **バリデータ** | `lib/validators.ts` | ~80% | createMessageSchema mode未テスト |

**推定未テストコード: 新規/修正機能の約40-50%**

### 1.2 リスク評価

| リスクレベル | 対象 | 理由 |
|-------------|------|------|
| **高** | `lib/gemini-safety.ts` | 安全性ブロックが正しく動作しない可能性 |
| **高** | `lib/auth-errors.ts` | 認証エラー表示が壊れる可能性 |
| **高** | Toast新props | サポートID/リトライ時間が表示されない可能性 |
| **中** | Cmd+Enter送信 | IME入力中に誤送信する可能性 |
| **中** | リトライ状態管理 | 状態がリークまたはクリアされない可能性 |
| **低** | modeパラメータ | 既存テストで部分的にカバー |

---

## 2. テスト実装フェーズ

### Phase 1: クリティカル（セキュリティ/データ整合性）

#### 1.1 `__tests__/lib/gemini-safety.test.ts` (新規作成)

**目的**: Gemini APIの安全性検出ロジックの正確性を保証

```typescript
// テストケース一覧 (約50件)

describe('checkResponseSafety', () => {
    // 基本ケース
    it('should return isBlocked=false for successful response');
    it('should return isBlocked=true when candidates is empty');
    it('should return isBlocked=true when response is null');
    it('should return isBlocked=true when response is undefined');

    // finishReason チェック
    it('should detect SAFETY finish reason');
    it('should detect RECITATION finish reason');
    it('should detect PROHIBITED_CONTENT finish reason');
    it('should detect BLOCKLIST finish reason');
    it('should detect SPII finish reason');
    it('should pass STOP finish reason');
    it('should pass MAX_TOKENS finish reason');

    // promptFeedback チェック
    it('should detect blockReason in promptFeedback');
    it('should detect SAFETY blockReason in promptFeedback');
    it('should detect PROHIBITED_CONTENT blockReason in promptFeedback');

    // safetyRatings チェック
    it('should detect blocked=true in safetyRatings');
    it('should detect HIGH probability in safetyRatings');
    it('should pass LOW probability in safetyRatings');
    it('should pass NEGLIGIBLE probability in safetyRatings');
    it('should handle multiple safetyRatings');
});

describe('checkImageSafety', () => {
    // 基本ケース
    it('should return isBlocked=false for successful image generation');
    it('should return isBlocked=true when no images generated');

    // エラーメッセージ検出
    it('should detect "safety" in error message');
    it('should detect "policy" in error message');
    it('should detect "copyright" in error message');
    it('should detect "recitation" in error message');
    it('should handle case-insensitive error messages');
    it('should handle nested error.details.message');
});

describe('checkVideoSafety', () => {
    // 基本ケース
    it('should return isBlocked=false for successful video generation');

    // エラーメッセージ検出
    it('should detect "safety" in error message');
    it('should detect "policy" in error message');
    it('should detect "copyright" in error message');
    it('should detect "recitation" in error message');
    it('should handle nested error details');
});

describe('blockReasonToErrorCode', () => {
    it('should map SAFETY to SAFETY_BLOCKED');
    it('should map RECITATION to RECITATION_BLOCKED');
    it('should map POLICY to CONTENT_POLICY_VIOLATION');
    it('should map OTHER to CONTENT_POLICY_VIOLATION');
});
```

**工数見積**: 3-4時間

---

#### 1.2 `__tests__/lib/auth-errors.test.ts` (新規作成)

**目的**: 認証エラーメッセージマッピングの正確性を保証

```typescript
// テストケース一覧 (約25件)

describe('getAuthErrorConfig', () => {
    // 全エラーコードのマッピング
    it('should return config for Configuration error');
    it('should return config for AccessDenied error');
    it('should return config for Verification error');
    it('should return config for OAuthSignin error');
    it('should return config for OAuthCallback error');
    it('should return config for OAuthCreateAccount error');
    it('should return config for OAuthAccountNotLinked error');
    it('should return config for EmailCreateAccount error');
    it('should return config for EmailSignin error');
    it('should return config for Callback error');
    it('should return config for CredentialsSignin error');
    it('should return config for EmailNormalizationConflict error');
    it('should return config for SubscriptionInitFailed error');
    it('should return config for SessionRequired error');
    it('should return default config for unknown error code');

    // 特殊エラーの検証
    it('should include supportInfo for OAuthAccountNotLinked');
    it('should include supportInfo for EmailNormalizationConflict');
    it('should include supportInfo for SubscriptionInitFailed');
    it('should include multiple actions for OAuthAccountNotLinked');
});

describe('getAuthErrorMessage', () => {
    it('should return message string for known error code');
    it('should return default message for unknown error code');
    it('should not include undefined in returned message');
});

describe('isEnhancedError', () => {
    it('should return true for OAuthAccountNotLinked');
    it('should return true for EmailNormalizationConflict');
    it('should return true for SubscriptionInitFailed');
    it('should return false for CredentialsSignin');
    it('should return false for unknown error code');
});

describe('formatErrorTimestamp', () => {
    it('should return formatted timestamp string');
    it('should include date and time components');
});
```

**工数見積**: 2時間

---

#### 1.3 APIルート安全性テスト追加

**修正ファイル**: `__tests__/api/gemini/chat.test.ts`

```typescript
// 追加テストケース (約8件)

describe('POST /api/gemini/chat - Safety checks', () => {
    it('should return 400 SAFETY_BLOCKED when finishReason is SAFETY');
    it('should return 400 RECITATION_BLOCKED when finishReason is RECITATION');
    it('should return 400 CONTENT_POLICY_VIOLATION when finishReason is PROHIBITED_CONTENT');
    it('should return 400 SAFETY_BLOCKED when safetyRatings has blocked=true');
    it('should return 400 SAFETY_BLOCKED when promptFeedback has blockReason');
    it('should include requestId in safety error response');
    it('should return success when no safety blocks');
    it('should handle safety blocks in pro mode');
});
```

**修正ファイル**: `__tests__/api/gemini/image.test.ts`

```typescript
// 追加テストケース (約6件)

describe('POST /api/gemini/image - Safety checks', () => {
    it('should return 400 SAFETY_BLOCKED when no images and safety error');
    it('should return 400 RECITATION_BLOCKED when copyright error');
    it('should return 400 CONTENT_POLICY_VIOLATION when policy error');
    it('should return success when image generated without errors');
    it('should handle safety blocks in edit mode');
    it('should include requestId in safety error response');
});
```

**修正ファイル**: `__tests__/api/gemini/video.test.ts`

```typescript
// 追加テストケース (約8件)

describe('POST /api/gemini/video - Media parameter', () => {
    it('should accept media parameter for Image-to-Video');
    it('should generate video without media (text-to-video)');
    it('should pass media to generateVideo function');
});

describe('POST /api/gemini/video - Safety checks', () => {
    it('should return 400 SAFETY_BLOCKED when error contains safety');
    it('should return 400 RECITATION_BLOCKED when error contains copyright');
    it('should return 400 CONTENT_POLICY_VIOLATION when error contains policy');
    it('should include requestId in safety error response');
    it('should return success when no safety errors');
});
```

**工数見積**: 3時間

---

### Phase 2: 高優先度（コア機能）

#### 2.1 `__tests__/components/Toast.test.tsx` (新規作成)

**目的**: Toast通知の新props表示を保証

```typescript
// テストケース一覧 (約15件)

describe('Toast Component', () => {
    // 基本機能
    it('should render toast with message');
    it('should render toast with title');
    it('should apply correct variant styles');
    it('should call onClose when close button clicked');
    it('should auto-dismiss after duration');

    // 新props: supportId
    it('should display supportId when provided');
    it('should format supportId with prefix "サポートID:"');
    it('should not display supportId section when not provided');

    // 新props: retryAfterText
    it('should display retryAfterText when provided');
    it('should not display retryAfterText section when not provided');

    // 組み合わせ
    it('should display both supportId and retryAfterText');
    it('should display action button when provided');
    it('should call action onClick when action button clicked');

    // アクセシビリティ
    it('should have correct ARIA attributes');
    it('should be focusable');
});
```

**工数見積**: 2-3時間

---

#### 2.2 `__tests__/components/ChatInput.test.tsx` (新規作成)

**目的**: リトライUI・キーボードショートカットの動作を保証

```typescript
// テストケース一覧 (約20件)

describe('ChatInput Component', () => {
    // 基本機能
    it('should render textarea');
    it('should render send button');
    it('should call onSendMessage when form submitted');
    it('should disable send button when loading');
    it('should disable send button when input is empty');

    // Cmd+Enter / Ctrl+Enter 送信
    describe('Keyboard shortcuts', () => {
        it('should submit on Cmd+Enter (Mac)');
        it('should submit on Ctrl+Enter (Windows/Linux)');
        it('should NOT submit on Enter alone');
        it('should NOT submit on Shift+Enter');
        it('should NOT submit during IME composition');
        it('should display correct shortcut hint based on platform');
    });

    // リトライバナー
    describe('Retry banner', () => {
        it('should display retry banner when lastFailedPrompt exists');
        it('should NOT display retry banner when lastFailedPrompt is null');
        it('should truncate long failed prompts to 50 chars');
        it('should show media indicator when lastFailedMedia exists');
        it('should call onRetry when retry button clicked');
        it('should call onClearRetry when clear button clicked');
        it('should disable retry button when loading');
    });

    // メディアアップロード
    describe('Media upload', () => {
        it('should show media preview when media attached');
        it('should call onClearMedia when remove button clicked');
    });
});
```

**工数見積**: 3-4時間

---

#### 2.3 Validators mode テスト追加

**修正ファイル**: `__tests__/lib/validators.test.ts`

```typescript
// 追加テストケース (約10件)

describe('createMessageSchema - mode parameter', () => {
    it('should accept mode="CHAT"');
    it('should accept mode="PRO"');
    it('should accept mode="SEARCH"');
    it('should accept mode="IMAGE"');
    it('should accept mode="VIDEO"');
    it('should accept message without mode (optional)');
    it('should reject invalid mode value');
    it('should accept mode with all content types');
    it('should validate mode is string enum');
    it('should preserve mode in parsed output');
});
```

**工数見積**: 1時間

---

#### 2.4 Messages API mode テスト追加

**修正ファイル**: `__tests__/api/conversations/messages.test.ts`

```typescript
// 追加テストケース (約8件)

describe('POST /api/conversations/[id]/messages - mode parameter', () => {
    it('should create message with mode=CHAT');
    it('should create message with mode=PRO');
    it('should create message with mode=SEARCH');
    it('should create message with mode=IMAGE');
    it('should create message with mode=VIDEO');
    it('should default to CHAT when mode not provided');
    it('should store mode in database');
    it('should return mode in response');
});
```

**工数見積**: 1.5時間

---

### Phase 3: 中優先度（ユーザー体験）

#### 3.1 `__tests__/lib/formatRetryAfter.test.ts` (新規作成)

**目的**: リトライ時間フォーマットの正確性を保証

```typescript
// テストケース一覧 (約10件)

describe('formatRetryAfter', () => {
    it('should return "間もなく" for past dates');
    it('should return "間もなく" for negative time difference');
    it('should return "1時間" for 1 hour in future');
    it('should return "10時間" for 10 hours in future');
    it('should return "23時間" for 23 hours in future');
    it('should return "1日" for 24 hours in future');
    it('should return "2日" for 48 hours in future');
    it('should return "30日" for 30 days in future');
    it('should handle timezone differences');
    it('should handle Date object input');
});
```

**工数見積**: 1時間

---

#### 3.2 E2Eテスト: リトライフロー

**新規ファイル**: `e2e/retry-flow.spec.ts`

```typescript
// E2Eテストシナリオ (約5件)

describe('Message Retry Flow', () => {
    test('should show retry banner after send failure');
    test('should retry message when retry button clicked');
    test('should clear retry state when clear button clicked');
    test('should clear retry state after successful send');
    test('should preserve media in retry state');
});
```

**工数見積**: 2時間

---

#### 3.3 E2Eテスト: 安全性エラー表示

**新規ファイル**: `e2e/safety-errors.spec.ts`

```typescript
// E2Eテストシナリオ (約4件)

describe('Safety Error Display', () => {
    test('should show toast with safety blocked message');
    test('should show toast with recitation blocked message');
    test('should display supportId in error toast');
    test('should not allow retry for safety-blocked content');
});
```

**工数見積**: 2時間

---

#### 3.4 E2Eテスト: 認証エラー表示

**新規ファイル**: `e2e/auth-errors.spec.ts`

```typescript
// E2Eテストシナリオ (約5件)

describe('Auth Error Pages', () => {
    test('should display Japanese error message for OAuthAccountNotLinked');
    test('should show Google login button on OAuthAccountNotLinked error');
    test('should display support info for critical errors');
    test('should navigate to signin page from error page');
    test('should display timestamp on enhanced error pages');
});
```

**工数見積**: 2時間

---

## 3. 実装順序とタイムライン

### 優先度マトリックス

```
重要度
  ↑
  │  [Phase 1]           [Phase 2]
  │  gemini-safety.ts    Toast.test.tsx
  │  auth-errors.ts      ChatInput.test.tsx
  │  API safety tests    validators mode
  │                      messages mode
  │
  │  [Phase 3]
  │  formatRetryAfter
  │  E2E tests
  │
  └─────────────────────────────────→ 緊急度
```

### 推奨実装順序

| 順序 | ファイル | 工数 | 累計テスト数 |
|-----|---------|------|-------------|
| 1 | `lib/gemini-safety.test.ts` | 3-4h | +50 |
| 2 | `lib/auth-errors.test.ts` | 2h | +25 |
| 3 | API safety tests (chat/image/video) | 3h | +22 |
| 4 | `components/Toast.test.tsx` | 2-3h | +15 |
| 5 | `components/ChatInput.test.tsx` | 3-4h | +20 |
| 6 | validators.test.ts (mode追加) | 1h | +10 |
| 7 | messages.test.ts (mode追加) | 1.5h | +8 |
| 8 | formatRetryAfter.test.ts | 1h | +10 |
| 9 | E2E: retry-flow.spec.ts | 2h | +5 |
| 10 | E2E: safety-errors.spec.ts | 2h | +4 |
| 11 | E2E: auth-errors.spec.ts | 2h | +5 |

**合計工数**: 約22-26時間
**追加テスト数**: 約174件

---

## 4. テスト環境・ツール

### 単体テスト
- **フレームワーク**: Vitest 4.0.8
- **アサーション**: Vitest expect
- **モック**: vi.mock, vi.fn

### コンポーネントテスト
- **レンダリング**: @testing-library/react
- **ユーザーイベント**: @testing-library/user-event
- **DOM検証**: @testing-library/jest-dom

### E2Eテスト
- **フレームワーク**: Playwright 1.56.1
- **ブラウザ**: Chromium, Firefox, WebKit

### 必要な追加パッケージ

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

---

## 5. テストカバレッジ目標

### 現状 → 目標

| メトリクス | 現状 | 目標 |
|-----------|------|------|
| 総テスト数 | 206 | 380+ |
| 新規ファイルカバレッジ | 0% | 90%+ |
| コンポーネントカバレッジ | 0% | 80%+ |
| APIルートカバレッジ | 50-70% | 90%+ |

### 品質基準

1. **すべての公開関数**: 少なくとも1つの正常系・1つの異常系テスト
2. **エッジケース**: null/undefined/空文字列の処理
3. **エラーハンドリング**: すべてのエラーパスをカバー
4. **日本語メッセージ**: 正確な文字列マッチング

---

## 6. CI/CD統合

### GitHub Actions追加設定

```yaml
# .github/workflows/test.yml に追加

- name: Run Component Tests
  run: npm test -- --coverage --reporter=verbose

- name: Upload Coverage Report
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### カバレッジしきい値設定

```typescript
// vitest.config.ts に追加
coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
    },
},
```

---

## 7. 実装開始前チェックリスト

- [ ] @testing-library/react インストール確認
- [ ] @testing-library/user-event インストール確認
- [ ] @testing-library/jest-dom インストール確認
- [ ] vitest.config.ts のセットアップ確認
- [ ] __tests__/components/ ディレクトリ作成
- [ ] テストユーティリティファイル作成（モック、ヘルパー）

---

## 8. 参考資料

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
