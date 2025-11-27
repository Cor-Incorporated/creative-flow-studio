/**
 * E2E Test: Happy Path - Chat → Image → Video
 *
 * このテストは、将来の実装のためのテンプレートです。
 * 実際のGemini APIを使用するため、以下の前提条件が必要です：
 *
 * 前提条件:
 * - 有効な GEMINI_API_KEY が設定されている
 * - ENTERPRISEプランのユーザーアカウント（動画生成用）
 * - Stripe決済が完了している
 * - テストデータベースが準備されている
 *
 * 注意:
 * - このテストは時間がかかります（動画生成は2〜5分）
 * - APIコストが発生します
 * - 本番環境では実行しないでください
 *
 * @vitest-environment node
 */

import { test, expect } from '@playwright/test';

// ===== Configuration =====
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'testuser@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD; // Google OAuth なので不要かもしれません

// Timeouts (動画生成は時間がかかるため、長めに設定)
const IMAGE_GENERATION_TIMEOUT = 60000; // 60 seconds
const VIDEO_GENERATION_TIMEOUT = 600000; // 10 minutes

// ===== Helper Functions =====

/**
 * Google OAuth でログイン
 *
 * 注意: 実際のGoogle OAuthフローを自動化するには、Google Test Accountsを使用するか、
 * NextAuthの `CredentialsProvider` でテスト用の認証を追加する必要があります。
 */
async function loginWithGoogle(page: any) {
    // TODO: Google OAuthの自動化を実装
    // 現在は手動ログインを想定
    await page.goto(BASE_URL);
    await page.click('text=ログイン'); // ログインボタンのテキストに応じて調整

    // Google OAuth のリダイレクト後、ホームページに戻ることを確認
    await expect(page).toHaveURL(BASE_URL, { timeout: 30000 });
}

/**
 * ENTERPRISEプランが有効であることを確認
 */
async function verifyEnterprisePlan(page: any) {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('text=ENTERPRISE')).toBeVisible();
    await expect(page.locator('text=ACTIVE')).toBeVisible();
}

// ===== Test Suite =====

test.describe('Happy Path: Chat → Image → Video', () => {
    test.beforeEach(async ({ page }) => {
        // 各テストの前にログイン
        await loginWithGoogle(page);
        await verifyEnterprisePlan(page);

        // メインページに移動
        await page.goto(BASE_URL);
    });

    test('Step 1: Chat Mode - Text Generation', async ({ page }) => {
        // Chat モードを選択
        await page.selectOption('select[name="mode"]', 'chat'); // セレクタは実際のUIに応じて調整

        // プロンプトを入力
        const prompt = 'こんにちは、簡単に挨拶してください。';
        await page.fill('textarea[placeholder*="プロンプト"]', prompt); // セレクタは実際のUIに応じて調整

        // 送信
        await page.click('button[type="submit"]');

        // 応答を待つ
        await expect(page.locator('[data-testid="message-response"]')).toBeVisible({
            timeout: 30000,
        });

        // 応答にテキストが含まれていることを確認
        const responseText = await page.locator('[data-testid="message-response"]').textContent();
        expect(responseText).toBeTruthy();
        expect(responseText?.length).toBeGreaterThan(0);
    });

    test('Step 2: Image Generation', async ({ page }) => {
        // Image モードを選択
        await page.selectOption('select[name="mode"]', 'image');

        // アスペクト比を選択（オプション）
        await page.selectOption('select[name="aspectRatio"]', '16:9');

        // プロンプトを入力
        const prompt = 'A serene mountain landscape at sunset';
        await page.fill('textarea[placeholder*="プロンプト"]', prompt);

        // 送信
        await page.click('button[type="submit"]');

        // 読み込み中インジケーターが表示されることを確認
        await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

        // 画像が生成されるのを待つ
        await expect(page.locator('img[alt*="Generated"]')).toBeVisible({
            timeout: IMAGE_GENERATION_TIMEOUT,
        });

        // 画像のURLが有効であることを確認
        const imageSrc = await page.locator('img[alt*="Generated"]').getAttribute('src');
        expect(imageSrc).toBeTruthy();
        expect(imageSrc).toMatch(/^(data:image|blob:|https?:\/\/)/);
    });

    test('Step 3: Image Editing', async ({ page }) => {
        // まず画像を生成（Step 2 と同じ）
        await page.selectOption('select[name="mode"]', 'image');
        await page.fill('textarea[placeholder*="プロンプト"]', 'A beautiful sunset');
        await page.click('button[type="submit"]');
        await expect(page.locator('img[alt*="Generated"]')).toBeVisible({
            timeout: IMAGE_GENERATION_TIMEOUT,
        });

        // 生成された画像にマウスオーバーして「編集」ボタンを表示
        const generatedImage = page.locator('img[alt*="Generated"]').first();
        await generatedImage.hover();

        // 編集ボタンをクリック
        await page.click('button:has-text("編集")');

        // 編集プロンプトを入力
        const editPrompt = 'Add more clouds in the sky';
        await page.fill('textarea[placeholder*="編集"]', editPrompt);

        // 送信
        await page.click('button[type="submit"]');

        // 編集された画像が表示されるのを待つ
        await expect(page.locator('img[alt*="Edited"]')).toBeVisible({
            timeout: IMAGE_GENERATION_TIMEOUT,
        });
    });

    test('Step 4: Video Generation (ENT ERPRISE only)', async ({ page }) => {
        // Video モードを選択
        await page.selectOption('select[name="mode"]', 'video');

        // アスペクト比を選択
        await page.selectOption('select[name="aspectRatio"]', '9:16');

        // プロンプトを入力
        const prompt = 'A cat playing with a ball of yarn';
        await page.fill('textarea[placeholder*="プロンプト"]', prompt);

        // 送信
        await page.click('button[type="submit"]');

        // 「ビデオ生成を開始しました...」メッセージが表示されることを確認
        await expect(page.locator('text=ビデオ生成を開始しました')).toBeVisible();

        // ポーリング進行状況が表示されることを確認
        await expect(page.locator('text=/ビデオを処理中.*%/')).toBeVisible({
            timeout: 60000,
        });

        // 動画が生成されるのを待つ（最大10分）
        await expect(page.locator('video')).toBeVisible({
            timeout: VIDEO_GENERATION_TIMEOUT,
        });

        // 動画のURLが有効であることを確認
        const videoSrc = await page.locator('video source').getAttribute('src');
        expect(videoSrc).toBeTruthy();
        expect(videoSrc).toMatch(/^(blob:|https?:\/\/)/);

        // 動画が再生可能であることを確認
        const videoElement = page.locator('video');
        await videoElement.click(); // 再生ボタンをクリック（必要に応じて）

        // 動画の長さが0より大きいことを確認
        const duration = await videoElement.evaluate((el: any) => el.duration);
        expect(duration).toBeGreaterThan(0);
    });

    test('Step 5: Conversation Persistence', async ({ page }) => {
        // チャットで1つメッセージを送信
        await page.selectOption('select[name="mode"]', 'chat');
        await page.fill('textarea[placeholder*="プロンプト"]', 'Test message for persistence');
        await page.click('button[type="submit"]');
        await expect(page.locator('[data-testid="message-response"]')).toBeVisible({
            timeout: 30000,
        });

        // 会話IDを取得（URLから）
        const currentUrl = page.url();
        const conversationId = currentUrl.split('/conversations/')[1];

        // ページをリロード
        await page.reload();

        // 会話履歴が表示されることを確認
        await expect(page.locator('[data-testid="conversation-history"]')).toBeVisible();

        // 以前のメッセージが復元されることを確認
        await expect(page.locator('text=Test message for persistence')).toBeVisible();

        // 応答も復元されることを確認
        await expect(page.locator('[data-testid="message-response"]')).toBeVisible();
    });

    test('Step 6: Error Handling - 429 Rate Limit (Optional)', async ({ page }) => {
        // このテストは、月間リミットを超過した場合のエラーハンドリングを確認します
        // 実際に429エラーを発生させるには、DBで使用量を増やすか、複数回APIを呼び出す必要があります

        // テストをスキップ（実際のリミット超過を発生させるのは困難）
        test.skip();

        // 以下は理想的なテストコード（実装は環境依存）
        /*
        // Chat で複数回メッセージを送信してリミットを超過させる
        for (let i = 0; i < 1001; i++) {
            await page.fill('textarea[placeholder*="プロンプト"]', `Test message ${i}`);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(1000);
        }

        // 429 エラーメッセージが表示されることを確認
        await expect(page.locator('text=/Monthly request limit exceeded/')).toBeVisible();
        await expect(page.locator('text=/Please upgrade your plan/')).toBeVisible();
        */
    });
});

// ===== 追加の統合テスト（将来の拡張用） =====

test.describe('Integration Tests (Future)', () => {
    test.skip('Admin Dashboard Access', async ({ page }) => {
        // TODO: Admin ユーザーでログイン
        // TODO: /admin にアクセス
        // TODO: ダッシュボードが表示されることを確認
    });

    test.skip('Stripe Checkout Flow', async ({ page }) => {
        // TODO: /pricing にアクセス
        // TODO: ENTERPRISEプランの「購入」ボタンをクリック
        // TODO: Stripe Checkout ページにリダイレクトされることを確認
        // TODO: テストカード情報を入力
        // TODO: 決済完了後、ダッシュボードにリダイレクトされることを確認
    });
});

// ===== テスト実行コマンド =====
/*
# 全E2Eテストを実行
npm run test:e2e

# 特定のテストのみ実行
npx playwright test e2e/happy-path.spec.ts

# UIモードで実行（デバッグ用）
npx playwright test --ui

# ヘッドレスモードで実行
npx playwright test --headed

# 特定のブラウザで実行
npx playwright test --project=chromium
*/

// ===== 環境変数設定例 =====
/*
# .env.test または CI環境で設定

PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=testuser@example.com
GEMINI_API_KEY=AIza...
DATABASE_URL=postgresql://...
*/
