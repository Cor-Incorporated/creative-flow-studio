import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/conversations/[id]/messages/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth');
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
    beforeEach(() => {
        vi.clearAllMocks();
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
        const response = await POST(request, { params: { id: 'conv_1' } });
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
        const response = await POST(request, { params: { id: 'conv_1' } });
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
        const response = await POST(request, { params: { id: 'conv_1' } });
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
        const response = await POST(request, { params: { id: 'conv_1' } });
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
        const response = await POST(request, { params: { id: 'nonexistent' } });
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
        const response = await POST(request, { params: { id: 'conv_1' } });
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
        const response = await POST(request, { params: { id: 'conv_1' } });
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
        const response = await POST(request, { params: { id: 'conv_1' } });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request body');
    });
});
