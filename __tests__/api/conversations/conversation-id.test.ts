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

const conversationId = 'cmj6pyr3q000hs60dy4vst56s';
const otherConversationId = 'cmj6pyr3q000hs60dy4vst56t';

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
            id: conversationId,
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
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`);
        const response = await GET(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversation.id).toBe(conversationId);
        expect(data.conversation.messages).toHaveLength(2);
        expect(data.conversation.messages[0].role).toBe('USER');
        expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
            where: { id: conversationId },
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
        expect(prisma.$queryRaw.mock.calls[0][1]).toBe(conversationId);

        const sqlParts = prisma.$queryRaw.mock.calls[0][0] as unknown as string[];
        const sql = sqlParts.join('').replace(/\s+/g, ' ').trim();
        expect(sql).toContain('FROM \"messages\"');
        expect(sql).toContain('WHERE \"conversationId\" =');
        expect(sql).toContain('ORDER BY \"createdAt\" ASC');
    });

    it('should return 400 for invalid conversation id', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/not-a-cuid');
        const response = await GET(request, { params: Promise.resolve({ id: 'not-a-cuid' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid conversation id');
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`);
        const response = await GET(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(data.code).toBe('UNAUTHORIZED');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 404 if conversation not found', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${otherConversationId}`);
        const response = await GET(request, { params: Promise.resolve({ id: otherConversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data.error).toBe('Conversation not found');
        expect(data.code).toBe('NOT_FOUND');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 403 if user does not own conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = {
            id: conversationId,
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
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`);
        const response = await GET(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
        expect(data.code).toBe('FORBIDDEN');
        expect(typeof data.requestId).toBe('string');
    });
});

describe('PATCH /api/conversations/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update conversation title', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockExisting = { id: conversationId, userId: 'user_123' };
        const mockUpdated = {
            id: conversationId,
            title: 'Updated Title',
            mode: 'CHAT',
            updatedAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockUpdated as any);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Updated Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversation.title).toBe('Updated Title');
        expect(prisma.conversation.update).toHaveBeenCalledWith({
            where: { id: conversationId },
            data: { title: 'Updated Title' },
            select: expect.any(Object),
        });
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(data.code).toBe('UNAUTHORIZED');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 404 if conversation not found', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${otherConversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: otherConversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data.error).toBe('Conversation not found');
        expect(data.code).toBe('NOT_FOUND');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 403 if user does not own conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockExisting = { id: conversationId, userId: 'other_user' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting as any);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'New Title' }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
        expect(data.code).toBe('FORBIDDEN');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 400 on invalid title (too long)', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockExisting = { id: conversationId, userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockExisting as any);

        // Act - Title too long (>200 chars)
        const longTitle = 'a'.repeat(201);
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: longTitle }),
        });
        const response = await PATCH(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(typeof data.requestId).toBe('string');
    });
});

describe('DELETE /api/conversations/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delete conversation and cascade messages', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: conversationId, userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.conversation.delete).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.deletedId).toBe(conversationId);
        expect(prisma.conversation.delete).toHaveBeenCalledWith({
            where: { id: conversationId },
        });
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(data.code).toBe('UNAUTHORIZED');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 404 if conversation not found', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${otherConversationId}`, {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: otherConversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data.error).toBe('Conversation not found');
        expect(data.code).toBe('NOT_FOUND');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 403 if user does not own conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: conversationId, userId: 'other_user' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest(`http://localhost:3000/api/conversations/${conversationId}`, {
            method: 'DELETE',
        });
        const response = await DELETE(request, { params: Promise.resolve({ id: conversationId }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
        expect(data.code).toBe('FORBIDDEN');
        expect(typeof data.requestId).toBe('string');
    });
});
