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
        },
        usageLog: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe('GET /api/admin/usage', () => {
    let GET: typeof import('@/app/api/admin/usage/route').GET;
    let getServerSession: any;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ GET } = await import('@/app/api/admin/usage/route'));
        ({ getServerSession } = await import('next-auth'));
        ({ prisma } = await import('@/lib/prisma'));
    });

    it('should return 401 for unauthenticated requests', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/usage');
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
        const request = new NextRequest('http://localhost:3000/api/admin/usage');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data).toEqual({ error: 'Forbidden: Admin access required' });
    });

    it('should return usage logs for ADMIN role', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };
        const mockLogs = [
            {
                id: 'log_1',
                userId: 'user_1',
                action: 'chat',
                resourceType: 'gemini-2.5-flash',
                metadata: { mode: 'chat' },
                createdAt: new Date('2025-11-13'),
                user: {
                    email: 'user@example.com',
                },
            },
        ];

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);
        vi.mocked(prisma.usageLog.findMany).mockResolvedValue(mockLogs as any);
        vi.mocked(prisma.usageLog.count).mockResolvedValue(1);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/usage?limit=50');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.logs).toHaveLength(1);
        expect(data.logs[0].action).toBe('chat');
        expect(data.logs[0].userEmail).toBe('user@example.com');
        expect(data.total).toBe(1);
        expect(data.limit).toBe(50);
    });

    it('should apply userId filter', async () => {
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
        vi.mocked(prisma.usageLog.findMany).mockResolvedValue([]);
        vi.mocked(prisma.usageLog.count).mockResolvedValue(0);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest(
            'http://localhost:3000/api/admin/usage?userId=cuid1234567890abcdef1234'
        );
        await GET(request);

        // Assert
        expect(prisma.usageLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: 'cuid1234567890abcdef1234',
                }),
            })
        );
    });

    it('should apply date range filter', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };
        const startDate = '2025-11-01T00:00:00.000Z';
        const endDate = '2025-11-30T23:59:59.999Z';

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);
        vi.mocked(prisma.usageLog.findMany).mockResolvedValue([]);
        vi.mocked(prisma.usageLog.count).mockResolvedValue(0);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest(
            `http://localhost:3000/api/admin/usage?startDate=${startDate}&endDate=${endDate}`
        );
        await GET(request);

        // Assert
        expect(prisma.usageLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                }),
            })
        );
    });
});
