/**
 * Test Utilities for Admin UI Components
 *
 * Provides data factory functions for testing.
 *
 * Note: Mock functions for useSession and useRouter cannot be shared utilities
 * due to Vitest's module hoisting. Each test file must define its own mocks.
 *
 * Usage:
 * ```typescript
 * import { createMockUsers, createMockUsageLogs } from '@/__tests__/utils/test-helpers';
 *
 * const mockUsers = createMockUsers(3);
 * const mockLogs = createMockUsageLogs(5);
 * ```
 */

/**
 * Create mock users data for testing
 */
export function createMockUsers(count: number = 3) {
    return Array.from({ length: count }, (_, i) => ({
        id: `user_${i + 1}`,
        email: `user${i + 1}@example.com`,
        name: `User ${i + 1}`,
        role: i === 0 ? 'ADMIN' : 'USER',
        createdAt: new Date('2025-11-13').toISOString(),
        subscription: {
            planName: i === 0 ? 'ENTERPRISE' : 'FREE',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-12-31').toISOString(),
        },
        usageStats: {
            totalRequests: 100 + i * 50,
            currentMonthRequests: 10 + i * 5,
        },
        lastActiveAt: new Date('2025-11-13T12:00:00Z').toISOString(),
    }));
}

/**
 * Create mock usage logs data for testing
 */
export function createMockUsageLogs(count: number = 3) {
    return Array.from({ length: count }, (_, i) => ({
        id: `log_${i + 1}`,
        userId: `user_${i + 1}`,
        userEmail: `user${i + 1}@example.com`,
        action: i % 2 === 0 ? 'chat' : 'image_generation',
        resourceType: i % 2 === 0 ? 'gemini-2.5-flash' : 'imagen-4.0',
        metadata: { mode: 'test' },
        createdAt: new Date(`2025-11-${13 + i}T12:00:00Z`).toISOString(),
    }));
}

/**
 * Wait for async updates in React components
 */
export function waitForAsync(ms: number = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
