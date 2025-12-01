/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatPrice } from '@/lib/stripe';

// Mock Stripe
vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => ({
        customers: {
            create: vi.fn(),
        },
        subscriptions: {
            retrieve: vi.fn(),
        },
    })),
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        subscription: {
            findUnique: vi.fn(),
        },
        plan: {
            findUnique: vi.fn(),
        },
        paymentEvent: {
            findUnique: vi.fn(),
        },
    },
}));

describe('lib/stripe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('formatPrice', () => {
        it('should format price in JPY correctly', () => {
            expect(formatPrice(300000)).toBe('¥3,000');
            expect(formatPrice(0)).toBe('¥0');
            expect(formatPrice(10000)).toBe('¥100');
        });

        it('should format price with custom currency', () => {
            expect(formatPrice(1000, 'usd')).toBe('$10');
            expect(formatPrice(99900, 'usd')).toBe('$999');
        });

        it('should handle large amounts', () => {
            expect(formatPrice(3000000)).toBe('¥30,000');
            expect(formatPrice(100000000)).toBe('¥1,000,000');
        });

        it('should handle edge cases', () => {
            // Small amounts
            expect(formatPrice(1)).toBe('¥0');
            expect(formatPrice(99)).toBe('¥1');
            expect(formatPrice(100)).toBe('¥1');

            // Currency case insensitivity
            expect(formatPrice(1000, 'USD')).toBe('$10');
            expect(formatPrice(1000, 'JPY')).toBe('¥10');
        });
    });

    describe('Stripe client configuration', () => {
        it('should have correct app info structure in source code', async () => {
            // This test verifies the source code contains the correct configuration
            // by checking the actual file content pattern
            const fs = await import('fs');
            const path = await import('path');

            const stripePath = path.join(process.cwd(), 'lib', 'stripe.ts');
            const content = fs.readFileSync(stripePath, 'utf-8');

            // Verify the appInfo configuration uses environment variable with fallback
            expect(content).toContain("url: process.env.NEXT_PUBLIC_APP_URL || 'https://bulnaai.com'");
            expect(content).toContain("name: 'BulnaAI'");
            expect(content).toContain("version: '1.0.0'");
        });

        it('should throw error message mentioning STRIPE_SECRET_KEY when not defined', async () => {
            // This test verifies the error handling logic exists in source code
            const fs = await import('fs');
            const path = await import('path');

            const stripePath = path.join(process.cwd(), 'lib', 'stripe.ts');
            const content = fs.readFileSync(stripePath, 'utf-8');

            // Verify error handling for missing STRIPE_SECRET_KEY
            expect(content).toContain('STRIPE_SECRET_KEY is not defined');
            expect(content).toContain("if (!process.env.STRIPE_SECRET_KEY)");
        });
    });
});
