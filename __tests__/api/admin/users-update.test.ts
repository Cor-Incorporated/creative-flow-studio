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
            update: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

describe('PATCH /api/admin/users/[id]', () => {
    let PATCH: typeof import('@/app/api/admin/users/[id]/route').PATCH;
    let getServerSession: any;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ PATCH } = await import('@/app/api/admin/users/[id]/route'));
        ({ getServerSession } = await import('next-auth'));
        ({ prisma } = await import('@/lib/prisma'));
    });

    it('should return 401 for unauthenticated requests', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users/user_1', {
            method: 'PATCH',
            body: JSON.stringify({ role: 'PRO' }),
        });
        const response = await PATCH(request, { params: { id: 'user_1' } });
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
        const request = new NextRequest('http://localhost:3000/api/admin/users/user_1', {
            method: 'PATCH',
            body: JSON.stringify({ role: 'PRO' }),
        });
        const response = await PATCH(request, { params: { id: 'user_1' } });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data).toEqual({ error: 'Forbidden: Admin access required' });
    });

    it('should update user role for ADMIN', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };
        const mockTargetUser = {
            id: 'user_1',
            email: 'user@example.com',
            role: 'USER',
        };
        const mockUpdatedUser = {
            id: 'user_1',
            email: 'user@example.com',
            role: 'PRO',
            updatedAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique)
            .mockResolvedValueOnce({ id: 'admin_123', role: 'ADMIN' } as any) // First call: admin check
            .mockResolvedValueOnce(mockTargetUser as any); // Second call: target user check
        vi.mocked(prisma.user.update).mockResolvedValue(mockUpdatedUser as any);
        vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users/user_1', {
            method: 'PATCH',
            body: JSON.stringify({ role: 'PRO' }),
        });
        const response = await PATCH(request, { params: { id: 'user_1' } });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.user.role).toBe('PRO');
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user_1' },
            data: { role: 'PRO' },
            select: expect.any(Object),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'admin_123',
                action: 'admin.users.update_role',
                resource: 'User:user_1',
                metadata: expect.objectContaining({
                    previousRole: 'USER',
                    newRole: 'PRO',
                }),
            }),
        });
    });

    it('should return 404 if target user not found', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'admin_123' },
            expires: '2025-12-31',
        };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.user.findUnique)
            .mockResolvedValueOnce({ id: 'admin_123', role: 'ADMIN' } as any)
            .mockResolvedValueOnce(null); // Target user not found

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users/nonexistent', {
            method: 'PATCH',
            body: JSON.stringify({ role: 'PRO' }),
        });
        const response = await PATCH(request, { params: { id: 'nonexistent' } });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data).toEqual({ error: 'User not found' });
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid role value', async () => {
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

        // Act
        const request = new NextRequest('http://localhost:3000/api/admin/users/user_1', {
            method: 'PATCH',
            body: JSON.stringify({ role: 'INVALID_ROLE' }),
        });
        const response = await PATCH(request, { params: { id: 'user_1' } });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});
