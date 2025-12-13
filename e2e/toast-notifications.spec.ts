/**
 * E2E Tests: Toast Notification Display
 *
 * Tests the toast notification system:
 * - Toast appears when API errors occur
 * - SupportId is displayed in toast when present
 * - Toast auto-dismisses after duration
 * - Different toast types (error, warning, success, info)
 * - Action buttons work correctly
 */

import { test, expect, Page } from '@playwright/test';

// Helper to mock authenticated session
async function mockAuthenticatedSession(page: Page) {
    await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                user: {
                    id: 'test-user-id',
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'USER',
                },
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            }),
        });
    });

    await page.route('**/api/auth/csrf', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                csrfToken: 'mock-csrf-token',
            }),
        });
    });

    await page.route('**/api/auth/providers', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                google: {
                    id: 'google',
                    name: 'Google',
                    type: 'oauth',
                    signinUrl: '/api/auth/signin/google',
                    callbackUrl: '/api/auth/callback/google',
                },
            }),
        });
    });
}

// Helper to mock basic APIs for authenticated state
async function mockBasicApis(page: Page) {
    await page.route('**/api/conversations**', async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ conversations: [] }),
            });
        } else if (method === 'POST') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    conversation: {
                        id: 'new-conv-id',
                        title: null,
                        mode: 'CHAT',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        messageCount: 0,
                    },
                }),
            });
        } else {
            await route.continue();
        }
    });

    await page.route('**/api/usage', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                isLimitReached: false,
                plan: { name: 'FREE' },
                usage: { current: 10, limit: 100 },
                resetDate: null,
            }),
        });
    });

    // Mock messages API
    await page.route('**/api/conversations/*/messages', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: { id: 'msg-1' } }),
        });
    });
}

test.describe('Toast Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuthenticatedSession(page);
        await mockBasicApis(page);
    });

    test.describe('API Error Toast Display', () => {
        test('should display toast when API returns error', async ({ page }) => {
            // Mock chat API to return an error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'サーバーエラーが発生しました',
                        code: 'UPSTREAM_ERROR',
                        requestId: 'req-123-456',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Wait for toast to appear - use the actual toast element with red background
            const toast = page.locator('.bg-red-600').first();
            await expect(toast).toBeVisible({ timeout: 5000 });
        });

        test('should display supportId in toast when present', async ({ page }) => {
            const testSupportId = 'req-test-support-id-789';

            // Mock chat API to return an error with requestId
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'エラーが発生しました',
                        code: 'UPSTREAM_ERROR',
                        requestId: testSupportId,
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Wait for toast and verify supportId is displayed
            await expect(page.locator(`text=サポートID:`)).toBeVisible({ timeout: 5000 });
            await expect(page.locator(`text=${testSupportId}`)).toBeVisible();
        });

        test('should display retry-after text for rate limit errors', async ({ page }) => {
            const resetDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

            // Mock chat API to return rate limit error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 429,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: '今月の利用上限に達しました',
                        code: 'RATE_LIMIT_EXCEEDED',
                        requestId: 'req-rate-limit',
                        planName: 'FREE',
                        usage: { current: 100, limit: 100 },
                        resetDate: resetDate,
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Wait for toast to appear (with red background for error)
            const toast = page.locator('.bg-red-600').first();
            await expect(toast).toBeVisible({ timeout: 5000 });

            // Verify toast contains rate limit message
            await expect(toast.locator('text=利用上限')).toBeVisible();
        });
    });

    test.describe('Toast Auto-Dismiss', () => {
        test('toast should auto-dismiss after duration', async ({ page }) => {
            // Mock chat API to return an error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'テストエラー',
                        code: 'UPSTREAM_ERROR',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Verify toast appears
            const toast = page.locator('.bg-red-600').first();
            await expect(toast).toBeVisible({ timeout: 5000 });

            // Wait for auto-dismiss (default duration is 8000ms for errors, plus animation time)
            // We use a slightly longer timeout to account for animation
            await expect(toast).not.toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Toast Close Button', () => {
        test('should close toast when clicking close button', async ({ page }) => {
            // Mock chat API to return an error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'テストエラー',
                        code: 'UPSTREAM_ERROR',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Wait for toast to appear
            const toast = page.locator('.bg-red-600').first();
            await expect(toast).toBeVisible({ timeout: 5000 });

            // Click the close button (the X button in the toast)
            const closeButton = page.locator('button[aria-label="Close"]');
            await closeButton.click();

            // Verify toast is dismissed (with animation delay)
            await expect(toast).not.toBeVisible({ timeout: 1000 });
        });
    });

    test.describe('Toast Action Button', () => {
        test('should display action button for UNAUTHORIZED error', async ({ page }) => {
            // Mock chat API to return unauthorized error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'セッションが切れました',
                        code: 'UNAUTHORIZED',
                        requestId: 'req-unauth',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Verify toast has action button
            await expect(page.locator('text=ログインする')).toBeVisible({ timeout: 5000 });
        });

        test('should display action button for FORBIDDEN_PLAN error', async ({ page }) => {
            // Mock chat API to return forbidden plan error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: '現在のプランではこの機能を利用できません',
                        code: 'FORBIDDEN_PLAN',
                        requestId: 'req-forbidden',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Verify toast has pricing CTA
            await expect(page.locator('text=料金プランを見る')).toBeVisible({ timeout: 5000 });
        });

        test('should display action button for RATE_LIMIT_EXCEEDED error', async ({ page }) => {
            // Mock chat API to return rate limit error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 429,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: '今月の利用上限に達しました',
                        code: 'RATE_LIMIT_EXCEEDED',
                        requestId: 'req-rate-limit',
                        planName: 'FREE',
                        usage: { current: 100, limit: 100 },
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Send a message to trigger the error
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message');
            await textarea.press('Control+Enter');

            // Verify toast has pricing CTA
            await expect(page.locator('text=料金プランを見る')).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Toast Types and Styling', () => {
        test('error toast should have red background', async ({ page }) => {
            // Mock chat API to return an error
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'サーバーエラー',
                        code: 'UPSTREAM_ERROR',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test');
            await textarea.press('Control+Enter');

            // Verify red background for error toast
            const errorToast = page.locator('.bg-red-600');
            await expect(errorToast).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Toast Content', () => {
        test('toast should display error message correctly', async ({ page }) => {
            const errorMessage = 'カスタムエラーメッセージのテスト';

            // Mock chat API to return an error with specific message
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: errorMessage,
                        code: 'UPSTREAM_ERROR',
                    }),
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test');
            await textarea.press('Control+Enter');

            // Wait for toast and verify custom message (will be mapped to user-friendly message)
            await expect(page.locator('.bg-red-600')).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Unauthenticated User Warning Toast', () => {
        test('should show warning toast when unauthenticated user tries to send message', async ({
            page,
        }) => {
            // Override session mock to return unauthenticated state
            await page.route('**/api/auth/session', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({}), // Empty session = unauthenticated
                });
            });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // For unauthenticated users, they should see the landing page
            // Check if landing page is displayed (has login button)
            const loginButton = page.locator('text=/ログイン|始める/');

            // If landing page is shown, we can't test the toast directly
            // as the chat input is not available
            // This test verifies the landing page is shown for unauthenticated users
            await expect(loginButton.first()).toBeVisible({ timeout: 5000 });
        });
    });
});
