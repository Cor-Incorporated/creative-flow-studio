import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        subscription: {
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        usageLog: {
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        conversation: {
            count: vi.fn(),
        },
        message: {
            count: vi.fn(),
        },
        plan: {
            findMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe('GET /api/admin/stats', () => {
    let GET: typeof import('@/app/api/admin/stats/route').GET;
    let getServerSession: any;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ GET } = await import('@/app/api/admin/stats/route'));
        ({ getServerSession } = await import('next-auth'));
        ({ prisma } = await import('@/lib/prisma'));
    });

    it('should return 401 for unauthenticated requests', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/stats');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 403 for non-ADMIN users', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'user_123' },
            expires: '2025-12-31',
        };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'user_123',
            role: 'USER',
        } as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/stats');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data).toEqual({ error: 'Forbidden: Admin access required' });
    });

    it('should return system statistics for ADMIN role', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };

        // Mock all parallel queries
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);
        vi.mocked(prisma.user.count)
            .mockResolvedValueOnce(100) // Total users
            .mockResolvedValueOnce(10); // New users this month
        vi.mocked(prisma.user.groupBy).mockResolvedValue([
            { role: 'USER', _count: 80 },
            { role: 'PRO', _count: 15 },
            { role: 'ADMIN', _count: 5 },
        ] as any);
        vi.mocked(prisma.subscription.count).mockResolvedValue(50);
        vi.mocked(prisma.subscription.groupBy)
            .mockResolvedValueOnce([
                { planId: 'plan_free', _count: 30 },
                { planId: 'plan_pro', _count: 20 },
            ] as any) // By plan
            .mockResolvedValueOnce([
                { status: 'ACTIVE', _count: 40 },
                { status: 'CANCELED', _count: 10 },
            ] as any); // By status
        vi.mocked(prisma.usageLog.count)
            .mockResolvedValueOnce(5000) // Total usage logs
            .mockResolvedValueOnce(500); // Usage logs this month
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([
            { action: 'chat', _count: 3000 },
            { action: 'image_generation', _count: 2000 },
        ] as any);
        vi.mocked(prisma.conversation.count).mockResolvedValue(200);
        vi.mocked(prisma.message.count).mockResolvedValue(1000);
        vi.mocked(prisma.plan.findMany).mockResolvedValue([
            { id: 'plan_free', name: 'FREE' },
            { id: 'plan_pro', name: 'PRO' },
        ] as any);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/stats');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('users');
        expect(data).toHaveProperty('subscriptions');
        expect(data).toHaveProperty('usage');
        expect(data).toHaveProperty('conversations');
        expect(data.users.total).toBe(100);
        expect(data.users.newThisMonth).toBe(10);
        expect(data.subscriptions.active).toBe(50);
        expect(data.usage.totalRequests).toBe(5000);
        expect(data.usage.requestsThisMonth).toBe(500);
        expect(data.conversations.total).toBe(200);
        expect(data.conversations.totalMessages).toBe(1000);
        expect(data.conversations.averageMessagesPerConversation).toBe(5); // 1000/200
    });

    it('should log audit entry on stats view', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);

        // Mock minimal data for other queries
        vi.mocked(prisma.user.count).mockResolvedValue(0);
        vi.mocked(prisma.user.groupBy).mockResolvedValue([]);
        vi.mocked(prisma.subscription.count).mockResolvedValue(0);
        vi.mocked(prisma.subscription.groupBy).mockResolvedValue([]);
        vi.mocked(prisma.usageLog.count).mockResolvedValue(0);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([]);
        vi.mocked(prisma.conversation.count).mockResolvedValue(0);
        vi.mocked(prisma.message.count).mockResolvedValue(0);
        vi.mocked(prisma.plan.findMany).mockResolvedValue([]);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/stats');
        await GET(request);

        // Assert
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'admin_123',
                action: 'admin.stats.view',
                resource: 'SystemStats',
            }),
        });
    });

    it('should handle zero conversations gracefully', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);

        // Mock zero conversations
        vi.mocked(prisma.user.count).mockResolvedValue(0);
        vi.mocked(prisma.user.groupBy).mockResolvedValue([]);
        vi.mocked(prisma.subscription.count).mockResolvedValue(0);
        vi.mocked(prisma.subscription.groupBy).mockResolvedValue([]);
        vi.mocked(prisma.usageLog.count).mockResolvedValue(0);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([]);
        vi.mocked(prisma.conversation.count).mockResolvedValue(0); // Zero conversations
        vi.mocked(prisma.message.count).mockResolvedValue(0);
        vi.mocked(prisma.plan.findMany).mockResolvedValue([]);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/stats');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversations.total).toBe(0);
        expect(data.conversations.averageMessagesPerConversation).toBe(0); // Should not divide by zero
    });
});
