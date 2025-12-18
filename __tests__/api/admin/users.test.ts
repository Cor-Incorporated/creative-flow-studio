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
            findMany: vi.fn(),
            count: vi.fn(),
        },
        usageLog: {
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe('GET /api/admin/users', () => {
    let GET: typeof import('@/app/api/admin/users/route').GET;
    let getServerSession: any;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ GET } = await import('@/app/api/admin/users/route'));
        ({ getServerSession } = await import('next-auth'));
        ({ prisma } = await import('@/lib/prisma'));
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([] as any);
    });

    it('should return 401 for unauthenticated requests', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should return 403 for non-ADMIN users', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'user_123', email: 'user@example.com' },
            expires: '2025-12-31',
        };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'user_123',
            role: 'USER', // Not ADMIN
        } as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data).toEqual({ error: 'Forbidden: Admin access required' });
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should return users list for ADMIN role', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123', email: 'admin@example.com' },
            expires: '2025-12-31',
        };
        const mockUsers = [
            {
                id: 'user_1',
                email: 'user1@example.com',
                name: 'User One',
                role: 'USER',
                createdAt: new Date('2025-11-13'),
                subscription: {
                    plan: { name: 'FREE' },
                    status: 'ACTIVE',
                    currentPeriodEnd: new Date('2025-12-31'),
                },
                _count: { usageLogs: 50 },
                usageLogs: [{ id: 'log_1', createdAt: new Date('2025-11-13') }],
            },
        ];

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);
        vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
        vi.mocked(prisma.user.count).mockResolvedValue(1);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([
            {
                userId: 'user_1',
                _count: {
                    _all: 10,
                },
            },
        ] as any);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users?limit=20&offset=0');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.users).toHaveLength(1);
        expect(data.users[0].email).toBe('user1@example.com');
        expect(data.total).toBe(1);
        expect(data.limit).toBe(20);
        expect(data.offset).toBe(0);
        expect(prisma.usageLog.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ['userId'],
                where: expect.objectContaining({
                    userId: {
                        in: ['user_1'],
                    },
                }),
            })
        );

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'admin_123',
                action: 'admin.users.list',
                resource: 'User',
            }),
        });
    });

    it('should aggregate monthly usage with a single groupBy call', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123', email: 'admin@example.com' },
            expires: '2025-12-31',
        };
        const mockUsers = [
            {
                id: 'user_1',
                email: 'user1@example.com',
                name: 'User One',
                role: 'USER',
                createdAt: new Date('2025-11-01'),
                subscription: null,
                _count: { usageLogs: 15 },
                usageLogs: [{ id: 'log_1', createdAt: new Date('2025-11-10') }],
            },
            {
                id: 'user_2',
                email: 'user2@example.com',
                name: 'User Two',
                role: 'PRO',
                createdAt: new Date('2025-11-05'),
                subscription: null,
                _count: { usageLogs: 30 },
                usageLogs: [{ id: 'log_2', createdAt: new Date('2025-11-11') }],
            },
        ];

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'admin_123',
            role: 'ADMIN',
        } as any);
        vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);
        vi.mocked(prisma.user.count).mockResolvedValue(2);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([
            { userId: 'user_1', _count: { _all: 5 } },
            { userId: 'user_2', _count: { _all: 8 } },
        ] as any);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.users).toHaveLength(2);
        expect(prisma.usageLog.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.usageLog.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ['userId'],
                where: expect.objectContaining({
                    userId: {
                        in: ['user_1', 'user_2'],
                    },
                }),
            })
        );
        expect(data.users[0].usageStats.currentMonthRequests).toBe(5);
        expect(data.users[1].usageStats.currentMonthRequests).toBe(8);
    });

    it('should apply search filter', async () => {
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
        vi.mocked(prisma.user.findMany).mockResolvedValue([]);
        vi.mocked(prisma.user.count).mockResolvedValue(0);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([] as any);

        // Act
        const request = new NextRequest(
            'http://localhost:3000/api/admin/users?search=john'
        );
        await GET(request);

        // Assert
        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    OR: [
                        { email: { contains: 'john', mode: 'insensitive' } },
                        { name: { contains: 'john', mode: 'insensitive' } },
                    ],
                }),
            })
        );
    });

    it('should apply role filter', async () => {
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
        vi.mocked(prisma.user.findMany).mockResolvedValue([]);
        vi.mocked(prisma.user.count).mockResolvedValue(0);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([] as any);

        // Act
        const request = new NextRequest(
            'http://localhost:3000/api/admin/users?role=PRO'
        );
        await GET(request);

        // Assert
        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    role: 'PRO',
                }),
            })
        );
    });

    it('should enforce max limit of 100', async () => {
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
        vi.mocked(prisma.user.findMany).mockResolvedValue([]);
        vi.mocked(prisma.user.count).mockResolvedValue(0);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
        vi.mocked(prisma.usageLog.groupBy).mockResolvedValue([] as any);

        // Act
        const request = new NextRequest(
            'http://localhost:3000/api/admin/users?limit=200'
        );
        await GET(request);

        // Assert
        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 100, // Max limit enforced
            })
        );
    });
});
