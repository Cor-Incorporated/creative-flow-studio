/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/stripe/subscription/route';
import { prisma } from '@/lib/prisma';

// Mock NextAuth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

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

describe('GET /api/stripe/subscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/stripe/subscription');
        const response = await GET(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if subscription not found', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/stripe/subscription');
        const response = await GET(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('No subscription found');
    });

    it('should return subscription data with usage count', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        const mockSubscription = {
            id: 'sub-1',
            userId: 'user-1',
            planId: 'plan-1',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
            status: 'ACTIVE',
            currentPeriodStart: new Date('2025-01-01'),
            currentPeriodEnd: new Date('2025-01-31'),
            cancelAtPeriodEnd: false,
            plan: {
                id: 'plan-1',
                name: 'PRO',
                monthlyPrice: 198000,
                features: { allowProMode: true },
                maxRequestsPerMonth: 1000,
                maxFileSize: 50,
            },
        };

        (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
        (prisma.usageLog.count as any).mockResolvedValue(350);

        const request = new NextRequest('http://localhost:3000/api/stripe/subscription');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data).toHaveProperty('subscription');
        expect(data).toHaveProperty('usageCount');
        expect(data.subscription.id).toBe('sub-1');
        expect(data.subscription.status).toBe('ACTIVE');
        expect(data.subscription.plan.name).toBe('PRO');
        expect(data.usageCount).toBe(350);
    });

    it('should handle subscription with null billing dates', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        const mockSubscription = {
            id: 'sub-1',
            userId: 'user-1',
            planId: 'plan-free',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            status: 'INACTIVE',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            plan: {
                id: 'plan-free',
                name: 'FREE',
                monthlyPrice: 0,
                features: {},
                maxRequestsPerMonth: 100,
                maxFileSize: 5,
            },
        };

        (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
        (prisma.usageLog.count as any).mockResolvedValue(25);

        const request = new NextRequest('http://localhost:3000/api/stripe/subscription');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.subscription.currentPeriodStart).toBeNull();
        expect(data.subscription.currentPeriodEnd).toBeNull();
        expect(data.usageCount).toBe(25);
    });

    it('should handle database errors gracefully', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockRejectedValue(
            new Error('Database connection failed')
        );

        const request = new NextRequest('http://localhost:3000/api/stripe/subscription');
        const response = await GET(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to fetch subscription');
        expect(data.details).toBe('Database connection failed');
    });

    it('should return subscription with unlimited plan', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-enterprise', email: 'enterprise@example.com' },
        });

        const mockSubscription = {
            id: 'sub-enterprise',
            userId: 'user-enterprise',
            planId: 'plan-enterprise',
            stripeCustomerId: 'cus_enterprise',
            stripeSubscriptionId: 'sub_enterprise',
            status: 'ACTIVE',
            currentPeriodStart: new Date('2025-01-01'),
            currentPeriodEnd: new Date('2025-01-31'),
            cancelAtPeriodEnd: false,
            plan: {
                id: 'plan-enterprise',
                name: 'ENTERPRISE',
                monthlyPrice: 980000,
                features: { allowProMode: true, allowVideoGeneration: true },
                maxRequestsPerMonth: null, // Unlimited
                maxFileSize: 500,
            },
        };

        (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
        (prisma.usageLog.count as any).mockResolvedValue(5000);

        const request = new NextRequest('http://localhost:3000/api/stripe/subscription');
        const response = await GET(request);

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.subscription.plan.maxRequestsPerMonth).toBeNull();
        expect(data.usageCount).toBe(5000);
    });
});
