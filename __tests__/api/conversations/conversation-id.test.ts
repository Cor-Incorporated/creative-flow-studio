import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        $queryRaw: vi.fn(),
        conversation: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));

let GET: typeof import('@/app/api/conversations/[id]/route').GET;
let PATCH: typeof import('@/app/api/conversations/[id]/route').PATCH;
let DELETE: typeof import('@/app/api/conversations/[id]/route').DELETE;
let getServerSession: any;
let prisma: any;

beforeEach(async () => {
    vi.clearAllMocks();
    ({ GET, PATCH, DELETE } = await import('@/app/api/conversations/[id]/route'));
    ({ getServerSession } = await import('next-auth'));
    ({ prisma } = await import('@/lib/prisma'));
});

describe('GET /api/conversations/[id]', () => {
    beforeEach(() => {
        // already loaded in top-level beforeEach
    });

    it('should return conversation with messages', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = {
            id: 'conv_1',
            userId: 'user_123',
            title: 'Test Conversation',
            mode: 'CHAT',
            createdAt: new Date('2025-11-13'),
            updatedAt: new Date('2025-11-13'),
        };
        const mockMessages = [
            {
                id: 'msg_1',
                role: 'USER',
                mode: 'CHAT',
                content: [{ text: 'Hello' }],
                createdAt: new Date('2025-11-13'),
            },
            {
                id: 'msg_2',
                role: 'MODEL',
                mode: 'CHAT',
                content: [{ text: 'Hi there!' }],
                createdAt: new Date('2025-11-13'),
            },
        ];

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.$queryRaw).mockResolvedValue(mockMessages as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1');
        const response = await GET(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversation.id).toBe('conv_1');
        expect(data.conversation.messages).toHaveLength(2);
        expect(data.conversation.messages[0].role).toBe('USER');
        expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
            where: { id: 'conv_1' },
            select: {
                id: true,
                title: true,
                mode: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw.mock.calls[0][1]).toBe('conv_1');
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1');
        const response = await GET(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if conversation not found', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/nonexistent');
        const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data).toEqual({ error: 'Conversation not found' });
    });

    it('should return 403 if user does not own conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = {
            id: 'conv_1',
            userId: 'other_user',
            title: 'Test',
            mode: 'CHAT',
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1');
        const response = await GET(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
    });
});

describe('PATCH /api/conversations/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update conversation title', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockExisting = { id: 'conv_1', userId: 'user_123' };
        const mockUpdated = {
            id: 'conv_1',
            title: 'Updated Title',
            mode: 'CHAT',
            updatedAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockUpdated as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Updated Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversation.title).toBe('Updated Title');
        expect(prisma.conversation.update).toHaveBeenCalledWith({
            where: { id: 'conv_1' },
            data: { title: 'Updated Title' },
            select: expect.any(Object),
        });
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if conversation not found', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/nonexistent', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: 'nonexistent' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data).toEqual({ error: 'Conversation not found' });
    });

    it('should return 403 if user does not own conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockExisting = { id: 'conv_1', userId: 'other_user' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
    });

    it('should return 400 on invalid title (too long)', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockExisting = { id: 'conv_1', userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting as any);

        // Act - Title too long (>200 chars)
        const longTitle = 'a'.repeat(201);
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'PATCH',
            body: JSON.stringify({ title: longTitle }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
    });
});

describe('DELETE /api/conversations/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delete conversation and cascade messages', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.conversation.delete).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.deletedId).toBe('conv_1');
        expect(prisma.conversation.delete).toHaveBeenCalledWith({
            where: { id: 'conv_1' },
        });
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if conversation not found', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/nonexistent', {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data).toEqual({ error: 'Conversation not found' });
    });

    it('should return 403 if user does not own conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'other_user' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1', {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
    });
});
