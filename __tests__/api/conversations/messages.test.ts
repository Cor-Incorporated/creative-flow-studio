import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
    prisma: {
        conversation: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        message: {
            create: vi.fn(),
        },
    },
}));

describe('POST /api/conversations/[id]/messages', () => {
    let POST: typeof import('@/app/api/conversations/[id]/messages/route').POST;
    let getServerSession: any;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ POST } = await import('@/app/api/conversations/[id]/messages/route'));
        ({ getServerSession } = await import('next-auth'));
        ({ prisma } = await import('@/lib/prisma'));
    });

    it('should create message in conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = {
            id: 'conv_1',
            userId: 'user_123',
            title: 'Test',
            mode: 'CHAT',
        };
        const mockMessage = {
            id: 'msg_1',
            conversationId: 'conv_1',
            role: 'USER',
            content: [{ text: 'Hello AI' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [{ text: 'Hello AI' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.id).toBe('msg_1');
        expect(data.message.role).toBe('USER');
        expect(data.message.content).toEqual([{ text: 'Hello AI' }]);
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'CHAT', // Default mode when not specified
                content: [{ text: 'Hello AI' }],
            },
        });
    });

    it('should create message with image content', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_2',
            conversationId: 'conv_1',
            role: 'MODEL',
            content: [
                { text: 'Here is an image' },
                {
                    media: {
                        type: 'image',
                        url: 'https://example.com/image.jpg',
                        mimeType: 'image/jpeg',
                    },
                },
            ],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'MODEL',
                content: [
                    { text: 'Here is an image' },
                    {
                        media: {
                            type: 'image',
                            url: 'https://example.com/image.jpg',
                            mimeType: 'image/jpeg',
                        },
                    },
                ],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.content).toHaveLength(2);
        expect(data.message.content[1].media.type).toBe('image');
    });

    it('should create message with sources (search results)', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_3',
            conversationId: 'conv_1',
            role: 'MODEL',
            content: [
                {
                    text: 'Based on search results...',
                    sources: [
                        { uri: 'https://example.com/article', title: 'Example Article' },
                    ],
                },
            ],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'MODEL',
                content: [
                    {
                        text: 'Based on search results...',
                        sources: [
                            { uri: 'https://example.com/article', title: 'Example Article' },
                        ],
                    },
                ],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.content[0].sources).toHaveLength(1);
        expect(data.message.content[0].sources[0].uri).toBe('https://example.com/article');
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [{ text: 'Hello' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
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
        const request = new NextRequest('http://localhost:3000/api/conversations/nonexistent/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [{ text: 'Hello' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) });
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
            userId: 'other_user', // Different user
            title: 'Test',
            mode: 'CHAT',
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [{ text: 'Hello' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
    });

    it('should return 400 on invalid role', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);

        // Act - Invalid role
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'INVALID_ROLE',
                content: [{ text: 'Hello' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
    });

    it('should return 400 on empty content', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);

        // Act - Empty content array
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
    });
});

describe('POST /api/conversations/[id]/messages - mode parameter', () => {
    let POST: typeof import('@/app/api/conversations/[id]/messages/route').POST;
    let getServerSession: any;
    let prisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        ({ POST } = await import('@/app/api/conversations/[id]/messages/route'));
        ({ getServerSession } = await import('next-auth'));
        ({ prisma } = await import('@/lib/prisma'));
    });

    it('should create message with mode=CHAT', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_1',
            conversationId: 'conv_1',
            role: 'USER',
            mode: 'CHAT',
            content: [{ text: 'Hello' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                mode: 'CHAT',
                content: [{ text: 'Hello' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.mode).toBe('CHAT');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'CHAT',
                content: [{ text: 'Hello' }],
            },
        });
    });

    it('should create message with mode=PRO', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_2',
            conversationId: 'conv_1',
            role: 'USER',
            mode: 'PRO',
            content: [{ text: 'Deep thinking query' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                mode: 'PRO',
                content: [{ text: 'Deep thinking query' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.mode).toBe('PRO');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'PRO',
                content: [{ text: 'Deep thinking query' }],
            },
        });
    });

    it('should create message with mode=SEARCH', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_3',
            conversationId: 'conv_1',
            role: 'USER',
            mode: 'SEARCH',
            content: [{ text: 'Search for latest news' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                mode: 'SEARCH',
                content: [{ text: 'Search for latest news' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.mode).toBe('SEARCH');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'SEARCH',
                content: [{ text: 'Search for latest news' }],
            },
        });
    });

    it('should create message with mode=IMAGE', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_4',
            conversationId: 'conv_1',
            role: 'USER',
            mode: 'IMAGE',
            content: [{ text: 'Generate an image of a cat' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                mode: 'IMAGE',
                content: [{ text: 'Generate an image of a cat' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.mode).toBe('IMAGE');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'IMAGE',
                content: [{ text: 'Generate an image of a cat' }],
            },
        });
    });

    it('should create message with mode=VIDEO', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_5',
            conversationId: 'conv_1',
            role: 'USER',
            mode: 'VIDEO',
            content: [{ text: 'Create a video of ocean waves' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                mode: 'VIDEO',
                content: [{ text: 'Create a video of ocean waves' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.mode).toBe('VIDEO');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'VIDEO',
                content: [{ text: 'Create a video of ocean waves' }],
            },
        });
    });

    it('should default to CHAT when mode not provided', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_6',
            conversationId: 'conv_1',
            role: 'USER',
            mode: 'CHAT',
            content: [{ text: 'Hello without mode' }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act - No mode provided in request body
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'USER',
                content: [{ text: 'Hello without mode' }],
            }),
        });
        const response = await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.message.mode).toBe('CHAT');
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: {
                conversationId: 'conv_1',
                role: 'USER',
                mode: 'CHAT', // Default value applied
                content: [{ text: 'Hello without mode' }],
            },
        });
    });

    it('should pass mode to prisma.message.create', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = { id: 'conv_1', userId: 'user_123' };
        const mockMessage = {
            id: 'msg_7',
            conversationId: 'conv_1',
            role: 'MODEL',
            mode: 'SEARCH',
            content: [{ text: 'Search results', sources: [{ uri: 'https://example.com' }] }],
            createdAt: new Date('2025-11-13'),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findUnique).mockResolvedValue(mockConversation as any);
        vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any);
        vi.mocked(prisma.conversation.update).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations/conv_1/messages', {
            method: 'POST',
            body: JSON.stringify({
                role: 'MODEL',
                mode: 'SEARCH',
                content: [{ text: 'Search results', sources: [{ uri: 'https://example.com' }] }],
            }),
        });
        await POST(request, { params: Promise.resolve({ id: 'conv_1' }) });

        // Assert - Verify prisma.message.create was called with correct mode
        expect(prisma.message.create).toHaveBeenCalledTimes(1);
        const createCall = vi.mocked(prisma.message.create).mock.calls[0][0];
        expect(createCall.data.mode).toBe('SEARCH');
        expect(createCall.data).toEqual({
            conversationId: 'conv_1',
            role: 'MODEL',
            mode: 'SEARCH',
            content: [{ text: 'Search results', sources: [{ uri: 'https://example.com' }] }],
        });
    });
});
