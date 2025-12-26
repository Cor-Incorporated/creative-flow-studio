/**
 * E2E Tests: Auth Error Page Display
 *
 * Tests the authentication error page (/auth/error) to verify:
 * - Japanese error messages display correctly for different error codes
 * - Appropriate CTA buttons are shown based on error type
 * - Support info section appears for critical errors
 * - Navigation buttons work correctly
 */

import { test, expect } from '@playwright/test';

test.describe('Auth Error Page', () => {
    test.describe('OAuthAccountNotLinked Error', () => {
        test('should display Japanese error message for OAuthAccountNotLinked', async ({ page }) => {
            await page.goto('/auth/error?error=OAuthAccountNotLinked');
            await page.waitForLoadState('networkidle');

            // Verify the error title is displayed
            await expect(page.locator('h2')).toContainText('アカウントリンクエラー');

            // Verify the Japanese error message
            await expect(page.locator('p.text-gray-400')).toContainText(
                'このメールアドレスは別の認証方法で登録されています'
            );

            // Verify error code is shown
            await expect(page.locator('text=エラーコード: OAuthAccountNotLinked')).toBeVisible();
        });

        test('should display Google login button for OAuthAccountNotLinked', async ({ page }) => {
            await page.goto('/auth/error?error=OAuthAccountNotLinked');
            await page.waitForLoadState('networkidle');

            // Verify Google login button is present
            const googleButton = page.locator('button:has-text("Googleでログイン")');
            await expect(googleButton).toBeVisible();

            // Verify the button has the Google icon (white background style)
            await expect(googleButton).toHaveClass(/bg-white/);
        });

        test('should display email login button for OAuthAccountNotLinked', async ({ page }) => {
            await page.goto('/auth/error?error=OAuthAccountNotLinked');
            await page.waitForLoadState('networkidle');

            // Verify email login button is present
            const emailButton = page.locator('button:has-text("メール/パスワードでログイン")');
            await expect(emailButton).toBeVisible();
        });

        test('should display support info section for OAuthAccountNotLinked', async ({ page }) => {
            await page.goto('/auth/error?error=OAuthAccountNotLinked');
            await page.waitForLoadState('networkidle');

            // Verify support info section is visible (OAuthAccountNotLinked is an enhanced error)
            const supportSection = page.locator('.bg-gray-800.border.border-gray-700');
            await expect(supportSection).toBeVisible();

            // Verify support info title
            await expect(supportSection.locator('h3')).toContainText('サポート情報');

            // Verify guidance text
            await expect(supportSection.locator('pre')).toContainText(
                'Googleで登録した場合は「Googleでログイン」を'
            );
        });
    });

    test.describe('CredentialsSignin Error', () => {
        test('should display Japanese error message for CredentialsSignin', async ({ page }) => {
            await page.goto('/auth/error?error=CredentialsSignin');
            await page.waitForLoadState('networkidle');

            // Verify the error title
            await expect(page.locator('h2')).toContainText('ログインエラー');

            // Verify the Japanese error message
            await expect(page.locator('p.text-gray-400')).toContainText(
                'メールアドレスまたはパスワードが正しくありません'
            );
        });

        test('should display signin button for CredentialsSignin', async ({ page }) => {
            await page.goto('/auth/error?error=CredentialsSignin');
            await page.waitForLoadState('networkidle');

            // Verify signin button is present
            const signinButton = page.locator('button:has-text("再度ログイン")');
            await expect(signinButton).toBeVisible();
        });
    });

    test.describe('EmailNormalizationConflict Error (Critical)', () => {
        test('should display support info section with timestamp for critical errors', async ({
            page,
        }) => {
            await page.goto('/auth/error?error=EmailNormalizationConflict');
            await page.waitForLoadState('networkidle');

            // Verify support info section is visible
            const supportSection = page.locator('.bg-gray-800.border.border-gray-700');
            await expect(supportSection).toBeVisible();

            // Verify timestamp is shown (EmailNormalizationConflict has showTimestamp: true)
            await expect(supportSection.locator('text=発生日時:')).toBeVisible();

            // Verify support contact info
            await expect(supportSection.locator('pre')).toContainText('サポートにお問い合わせください');
        });

        test('should display support contact button for EmailNormalizationConflict', async ({
            page,
        }) => {
            await page.goto('/auth/error?error=EmailNormalizationConflict');
            await page.waitForLoadState('networkidle');

            // Verify support contact button is present
            const supportButton = page.locator('button:has-text("サポートに連絡")');
            await expect(supportButton).toBeVisible();
        });
    });

    test.describe('Default/Unknown Error', () => {
        test('should display default error message for unknown error codes', async ({ page }) => {
            await page.goto('/auth/error?error=UnknownError');
            await page.waitForLoadState('networkidle');

            // Verify the default error title
            await expect(page.locator('h2')).toContainText('認証エラー');

            // Verify the default Japanese error message
            await expect(page.locator('p.text-gray-400')).toContainText(
                '認証中にエラーが発生しました'
            );

            // Verify error code shows the actual code passed
            await expect(page.locator('text=エラーコード: UnknownError')).toBeVisible();
        });

        test('should display home and signin buttons for default error', async ({ page }) => {
            await page.goto('/auth/error?error=Default');
            await page.waitForLoadState('networkidle');

            // Verify signin button is present
            await expect(page.locator('button:has-text("ログインページに戻る")')).toBeVisible();

            // Verify home button is present
            await expect(page.locator('button:has-text("ホームに戻る")')).toBeVisible();
        });
    });

    test.describe('Navigation', () => {
        test('should navigate to home when clicking "ホームに戻る" button', async ({ page }) => {
            await page.goto('/auth/error?error=Default');
            await page.waitForLoadState('networkidle');

            // Click the home button
            await page.click('button:has-text("ホームに戻る")');

            // Verify navigation to home page
            await expect(page).toHaveURL('/');
        });

        test('should navigate to signin page when clicking signin button', async ({ page }) => {
            await page.goto('/auth/error?error=CredentialsSignin');
            await page.waitForLoadState('networkidle');

            // Click the signin button
            await page.click('button:has-text("再度ログイン")');

            // Verify navigation to signin page
            await expect(page).toHaveURL('/auth/signin');
        });
    });

    test.describe('Error Page UI Elements', () => {
        test('should display BlunaAI logo and title', async ({ page }) => {
            await page.goto('/auth/error?error=Default');
            await page.waitForLoadState('networkidle');

            // Verify logo/title area
            await expect(page.locator('h1:has-text("BlunaAI")')).toBeVisible();
        });

        test('should display error icon', async ({ page }) => {
            await page.goto('/auth/error?error=Default');
            await page.waitForLoadState('networkidle');

            // Verify error icon container is visible (red circular background with warning icon)
            const errorIconContainer = page.locator('.bg-red-900\\/50.rounded-full');
            await expect(errorIconContainer).toBeVisible();
        });

        test('should have proper styling for error page', async ({ page }) => {
            await page.goto('/auth/error?error=Default');
            await page.waitForLoadState('networkidle');

            // Verify dark background
            const mainContainer = page.locator('.min-h-screen.bg-gray-900');
            await expect(mainContainer).toBeVisible();
        });
    });

    test.describe('Configuration Error', () => {
        test('should display server error message for Configuration error', async ({ page }) => {
            await page.goto('/auth/error?error=Configuration');
            await page.waitForLoadState('networkidle');

            // Verify server error title
            await expect(page.locator('h2')).toContainText('サーバーエラー');

            // Verify the message
            await expect(page.locator('p.text-gray-400')).toContainText(
                'サーバー設定にエラーがあります'
            );

            // Verify both home and support buttons are present
            await expect(page.locator('button:has-text("ホームに戻る")')).toBeVisible();
            await expect(page.locator('button:has-text("サポートに連絡")')).toBeVisible();
        });
    });

    test.describe('AccessDenied Error', () => {
        test('should display access denied message', async ({ page }) => {
            await page.goto('/auth/error?error=AccessDenied');
            await page.waitForLoadState('networkidle');

            // Verify access denied title
            await expect(page.locator('h2')).toContainText('アクセス拒否');

            // Verify the message
            await expect(page.locator('p.text-gray-400')).toContainText('アクセスが拒否されました');
        });
    });
});
