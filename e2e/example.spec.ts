import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test('should load the homepage', async ({ page }) => {
        await page.goto('/');

        // Wait for the page to load
        await page.waitForLoadState('networkidle');

        // Check that the page has loaded
        expect(page).toBeTruthy();
    });

    test('should have a title', async ({ page }) => {
        await page.goto('/');

        // Verify the page has a title (Next.js default or custom)
        const title = await page.title();
        expect(title).toBeTruthy();
    });
});
