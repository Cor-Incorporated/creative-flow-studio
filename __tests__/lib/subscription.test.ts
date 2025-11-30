/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getUserSubscription,
    hasActiveSubscription,
    getMonthlyUsageCount,
    checkSubscriptionLimits,
    formatBillingPeriod,
    getDaysUntilBilling,
    calculateUsagePercentage,
} from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        subscription: {
            findUnique: vi.fn(),
        },
        usageLog: {
            count: vi.fn(),
        },
    },
}));

describe('subscription utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getUserSubscription', () => {
        it('should return subscription with plan', async () => {
            const mockSubscription = {
                id: 'sub-1',
                userId: 'user-1',
                planId: 'plan-1',
                status: 'ACTIVE',
                plan: {
                    id: 'plan-1',
                    name: 'PRO',
                    monthlyPrice: 198000,
                    features: {},
                    maxRequestsPerMonth: 1000,
                    maxFileSize: 50,
                },
            };

            (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);

            const result = await getUserSubscription('user-1');

            expect(result).toEqual(mockSubscription);
            expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                include: { plan: true },
            });
        });

        it('should return null if subscription not found', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue(null);

            const result = await getUserSubscription('user-nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('hasActiveSubscription', () => {
        it('should return true for active subscription', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue({
                status: 'ACTIVE',
            });

            const result = await hasActiveSubscription('user-1');

            expect(result).toBe(true);
        });

        it('should return false for inactive subscription', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue({
                status: 'INACTIVE',
            });

            const result = await hasActiveSubscription('user-1');

            expect(result).toBe(false);
        });

        it('should return false if subscription not found', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue(null);

            const result = await hasActiveSubscription('user-nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('getMonthlyUsageCount', () => {
        it('should return usage count for current month', async () => {
            (prisma.usageLog.count as any).mockResolvedValue(350);

            const result = await getMonthlyUsageCount('user-1');

            expect(result).toBe(350);
            expect(prisma.usageLog.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user-1',
                        createdAt: expect.objectContaining({ gte: expect.any(Date) }),
                    }),
                })
            );
        });

        it('should return 0 if no usage', async () => {
            (prisma.usageLog.count as any).mockResolvedValue(0);

            const result = await getMonthlyUsageCount('user-new');

            expect(result).toBe(0);
        });
    });

    describe('checkSubscriptionLimits', () => {
        it('should allow action within limits', async () => {
            const mockSubscription = {
                id: 'sub-1',
                userId: 'user-1',
                status: 'ACTIVE',
                plan: {
                    id: 'plan-1',
                    name: 'PRO',
                    features: {
                        allowProMode: true,
                        allowImageGeneration: true,
                        maxRequestsPerMonth: 1000,
                    },
                    maxRequestsPerMonth: 1000,
                },
            };

            (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
            (prisma.usageLog.count as any).mockResolvedValue(350);

            const result = await checkSubscriptionLimits('user-1', 'image_generation');

            expect(result.allowed).toBe(true);
            expect(result.usageCount).toBe(350);
            expect(result.limit).toBe(1000);
        });

        it('should throw error if subscription not found', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue(null);

            await expect(checkSubscriptionLimits('user-1', 'chat')).rejects.toThrow(
                'No subscription found'
            );
        });

        it('should throw error if subscription is not active', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue({
                status: 'CANCELED',
                plan: { features: {} },
            });

            await expect(checkSubscriptionLimits('user-1', 'chat')).rejects.toThrow(
                'Subscription is canceled'
            );
        });

        it('should throw error if feature not allowed', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue({
                status: 'ACTIVE',
                plan: {
                    features: {
                        allowImageGeneration: false,
                    },
                },
            });
            (prisma.usageLog.count as any).mockResolvedValue(50);

            await expect(checkSubscriptionLimits('user-1', 'image_generation')).rejects.toThrow(
                'Image generation not available in current plan'
            );
        });

        it('should throw error if monthly limit exceeded', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue({
                status: 'ACTIVE',
                plan: {
                    features: {
                        allowImageGeneration: true,
                        maxRequestsPerMonth: 100,
                    },
                    maxRequestsPerMonth: 100,
                },
            });
            (prisma.usageLog.count as any).mockResolvedValue(100);

            await expect(checkSubscriptionLimits('user-1', 'image_generation')).rejects.toThrow(
                'Monthly request limit exceeded'
            );
        });

        it('should allow unlimited usage for null limit', async () => {
            (prisma.subscription.findUnique as any).mockResolvedValue({
                status: 'ACTIVE',
                plan: {
                    features: {
                        allowVideoGeneration: true,
                        maxRequestsPerMonth: null, // Unlimited
                    },
                    maxRequestsPerMonth: null,
                },
            });
            (prisma.usageLog.count as any).mockResolvedValue(5000);

            const result = await checkSubscriptionLimits('user-1', 'video_generation');

            expect(result.allowed).toBe(true);
            expect(result.usageCount).toBe(5000);
            expect(result.limit).toBeNull();
        });
    });

    describe('formatBillingPeriod', () => {
        it('should format billing period correctly', () => {
            const start = new Date('2025-01-01');
            const end = new Date('2025-01-31');

            const result = formatBillingPeriod(start, end);

            expect(result).toMatch(/2025/);
            expect(result).toMatch(/01/);
            expect(result).toMatch(/〜/);
        });

        it('should return "未設定" for null dates', () => {
            expect(formatBillingPeriod(null, null)).toBe('未設定');
            expect(formatBillingPeriod(new Date(), null)).toBe('未設定');
            expect(formatBillingPeriod(null, new Date())).toBe('未設定');
        });
    });

    describe('getDaysUntilBilling', () => {
        it('should return days until billing date', () => {
            const future = new Date();
            future.setDate(future.getDate() + 15);

            const result = getDaysUntilBilling(future);

            expect(result).toBeGreaterThanOrEqual(14);
            expect(result).toBeLessThanOrEqual(16);
        });

        it('should return 0 for null date', () => {
            expect(getDaysUntilBilling(null)).toBe(0);
        });

        it('should return positive days for future dates', () => {
            const future = new Date();
            future.setDate(future.getDate() + 30);

            const result = getDaysUntilBilling(future);

            expect(result).toBeGreaterThan(0);
        });
    });

    describe('calculateUsagePercentage', () => {
        it('should calculate percentage correctly', () => {
            expect(calculateUsagePercentage(50, 100)).toBe(50);
            expect(calculateUsagePercentage(75, 100)).toBe(75);
            expect(calculateUsagePercentage(100, 100)).toBe(100);
        });

        it('should cap at 100%', () => {
            expect(calculateUsagePercentage(150, 100)).toBe(100);
        });

        it('should return null for unlimited (null limit)', () => {
            expect(calculateUsagePercentage(5000, null)).toBeNull();
        });

        it('should return 100 for zero limit', () => {
            expect(calculateUsagePercentage(10, 0)).toBe(100);
        });

        it('should handle low usage', () => {
            expect(calculateUsagePercentage(1, 1000)).toBe(0);
            expect(calculateUsagePercentage(10, 1000)).toBe(1);
        });
    });
});
