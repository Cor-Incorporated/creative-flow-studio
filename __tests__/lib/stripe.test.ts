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
});
