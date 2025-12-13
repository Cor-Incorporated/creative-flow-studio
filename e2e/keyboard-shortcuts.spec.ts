/**
 * E2E Tests: Keyboard Shortcuts on Chat Page
 *
 * Tests keyboard shortcut behavior for the chat input:
 * - Enter key alone adds a newline (does NOT submit)
 * - Cmd+Enter (Mac) / Ctrl+Enter (Windows/Linux) submits the form
 * - Proper handling during IME composition
 */

import { test, expect, Page } from '@playwright/test';

// Helper to mock authenticated session
async function mockAuthenticatedSession(page: Page) {
    // Set up a mock session via cookie/localStorage or route interception
    // For NextAuth.js, we need to mock the session endpoint
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

    // Also mock the CSRF token
    await page.route('**/api/auth/csrf', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                csrfToken: 'mock-csrf-token',
            }),
        });
    });

    // Mock providers
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
                credentials: {
                    id: 'credentials',
                    name: 'Credentials',
                    type: 'credentials',
                    signinUrl: '/api/auth/signin/credentials',
                    callbackUrl: '/api/auth/callback/credentials',
                },
            }),
        });
    });
}

// Helper to mock conversations API
async function mockConversationsApi(page: Page) {
    await page.route('**/api/conversations**', async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    conversations: [],
                }),
            });
        } else if (method === 'POST') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    conversation: {
                        id: 'new-conversation-id',
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
}

// Helper to mock usage API
async function mockUsageApi(page: Page) {
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
}

test.describe('Keyboard Shortcuts on Chat Page', () => {
    test.beforeEach(async ({ page }) => {
        // Set up mocks before each test
        await mockAuthenticatedSession(page);
        await mockConversationsApi(page);
        await mockUsageApi(page);
    });

    test.describe('Enter Key Behavior', () => {
        test('Enter key alone should NOT submit the form', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Find the textarea (chat input)
            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Type some text
            await textarea.fill('Hello');

            // Get initial message count (should have welcome message)
            const initialMessages = await page.locator('[class*="ChatMessage"], .flex.gap-3.p-4').count();

            // Press Enter alone
            await textarea.press('Enter');

            // Wait a moment for any potential submission
            await page.waitForTimeout(500);

            // Verify form was NOT submitted - message count should remain the same
            const afterEnterMessages = await page.locator('[class*="ChatMessage"], .flex.gap-3.p-4').count();
            expect(afterEnterMessages).toBe(initialMessages);

            // Verify the textarea still has content (with added newline)
            const textareaValue = await textarea.inputValue();
            expect(textareaValue).toContain('Hello');
        });

        test('Enter key should add a newline to textarea', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Type text, press Enter, type more text
            await textarea.fill('Line 1');
            await textarea.press('Enter');
            await textarea.type('Line 2');

            // Verify textarea contains both lines
            const textareaValue = await textarea.inputValue();
            expect(textareaValue).toContain('Line 1');
            expect(textareaValue).toContain('Line 2');
        });
    });

    test.describe('Cmd/Ctrl+Enter Behavior', () => {
        test('Cmd+Enter should submit the form on Mac', async ({ page, browserName }) => {
            // Skip on non-webkit browsers as they might handle meta key differently
            test.skip(browserName !== 'webkit', 'Testing Mac-specific behavior on webkit');

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Mock the chat API to track submissions
            let chatApiCalled = false;
            await page.route('**/api/gemini/chat', async (route) => {
                chatApiCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        result: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: 'This is a test response' }],
                                    },
                                },
                            ],
                        },
                    }),
                });
            });

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Type a message
            await textarea.fill('Test message');

            // Press Cmd+Enter (Meta+Enter on Mac)
            await textarea.press('Meta+Enter');

            // Wait for API call
            await page.waitForTimeout(1000);

            // Verify the chat API was called (form was submitted)
            expect(chatApiCalled).toBe(true);
        });

        test('Ctrl+Enter should submit the form', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Mock the chat API to track submissions
            let chatApiCalled = false;
            await page.route('**/api/gemini/chat', async (route) => {
                chatApiCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        result: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: 'This is a test response' }],
                                    },
                                },
                            ],
                        },
                    }),
                });
            });

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Type a message
            await textarea.fill('Test message with Ctrl+Enter');

            // Press Ctrl+Enter
            await textarea.press('Control+Enter');

            // Wait for API call
            await page.waitForTimeout(1000);

            // Verify the chat API was called (form was submitted)
            expect(chatApiCalled).toBe(true);
        });

        test('Ctrl+Enter should clear the textarea after submission', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Mock the chat API
            await page.route('**/api/gemini/chat', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        result: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: 'Response' }],
                                    },
                                },
                            ],
                        },
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

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Type a message
            await textarea.fill('Test clearing');

            // Press Ctrl+Enter
            await textarea.press('Control+Enter');

            // Wait for submission to complete
            await page.waitForTimeout(1500);

            // Verify textarea is cleared
            const textareaValue = await textarea.inputValue();
            expect(textareaValue).toBe('');
        });
    });

    test.describe('Empty Input Handling', () => {
        test('Ctrl+Enter with empty input should not submit', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Mock the chat API
            let chatApiCalled = false;
            await page.route('**/api/gemini/chat', async (route) => {
                chatApiCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        result: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: 'Response' }],
                                    },
                                },
                            ],
                        },
                    }),
                });
            });

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Ensure textarea is empty
            await textarea.fill('');

            // Press Ctrl+Enter
            await textarea.press('Control+Enter');

            // Wait a moment
            await page.waitForTimeout(500);

            // Verify the chat API was NOT called (empty input should not submit)
            expect(chatApiCalled).toBe(false);
        });

        test('Ctrl+Enter with only whitespace should not submit', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Mock the chat API
            let chatApiCalled = false;
            await page.route('**/api/gemini/chat', async (route) => {
                chatApiCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        result: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: 'Response' }],
                                    },
                                },
                            ],
                        },
                    }),
                });
            });

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await expect(textarea).toBeVisible();

            // Fill with only whitespace
            await textarea.fill('   ');

            // Press Ctrl+Enter
            await textarea.press('Control+Enter');

            // Wait a moment
            await page.waitForTimeout(500);

            // Verify the chat API was NOT called
            expect(chatApiCalled).toBe(false);
        });
    });

    test.describe('Keyboard Shortcut Hint Display', () => {
        test('should display keyboard shortcut hint on mobile', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Look for the hint text (visible on mobile)
            const hint = page.locator('text=/Ctrl\\+Enter|で送信/');
            await expect(hint).toBeVisible();
        });
    });

    test.describe('Send Button Behavior', () => {
        test('Send button should be disabled when textarea is empty', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Find the send button
            const sendButton = page.locator('button[type="submit"]');
            await expect(sendButton).toBeVisible();

            // Verify it's disabled when empty
            await expect(sendButton).toBeDisabled();
        });

        test('Send button should be enabled when textarea has content', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test content');

            // Find the send button
            const sendButton = page.locator('button[type="submit"]');
            await expect(sendButton).toBeVisible();

            // Verify it's enabled when there's content
            await expect(sendButton).toBeEnabled();
        });

        test('Clicking send button should submit the form', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Mock the chat API
            let chatApiCalled = false;
            await page.route('**/api/gemini/chat', async (route) => {
                chatApiCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        result: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: 'Response' }],
                                    },
                                },
                            ],
                        },
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

            const textarea = page.locator('textarea[placeholder="メッセージを入力..."]');
            await textarea.fill('Test message via button');

            // Click send button
            const sendButton = page.locator('button[type="submit"]');
            await sendButton.click();

            // Wait for API call
            await page.waitForTimeout(1000);

            // Verify the chat API was called
            expect(chatApiCalled).toBe(true);
        });
    });
});
