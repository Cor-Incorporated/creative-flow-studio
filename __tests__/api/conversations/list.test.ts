import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/conversations/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth');
vi.mock('@/lib/prisma', () => ({
    prisma: {
        conversation: {
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
        },
    },
}));

describe('GET /api/conversations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return user conversations with pagination', async () => {
        // Arrange
        const mockSession = {
            user: { id: 'user_123', email: 'test@example.com' },
            expires: '2025-12-31',
        };
        const mockConversations = [
            {
                id: 'conv_1',
                title: 'Test Conversation',
                mode: 'CHAT',
                createdAt: new Date('2025-11-13'),
                updatedAt: new Date('2025-11-13'),
                _count: { messages: 5 },
            },
        ];

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findMany).mockResolvedValue(mockConversations as any);
        vi.mocked(prisma.conversation.count).mockResolvedValue(1);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations?limit=20&offset=0');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.conversations).toHaveLength(1);
        expect(data.conversations[0].id).toBe('conv_1');
        expect(data.total).toBe(1);
        expect(prisma.conversation.findMany).toHaveBeenCalledWith({
            where: { userId: 'user_123' },
            select: expect.any(Object),
            orderBy: { updatedAt: 'desc' },
            take: 20,
            skip: 0,
        });
    });

    it('should support mode filtering', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
        vi.mocked(prisma.conversation.count).mockResolvedValue(0);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations?mode=IMAGE');
        await GET(request);

        // Assert
        expect(prisma.conversation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: 'user_123', mode: 'IMAGE' },
            })
        );
    });

    it('should limit results to max 100', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
        vi.mocked(prisma.conversation.count).mockResolvedValue(0);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations?limit=200');
        await GET(request);

        // Assert
        expect(prisma.conversation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 100, // Max limit enforced
            })
        );
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 500 on database error', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.findMany).mockRejectedValue(
            new Error('Database connection failed')
        );

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations');
        const response = await GET(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(data).toMatchObject({
            error: 'Failed to fetch conversations',
        });
    });
});

describe('POST /api/conversations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create new conversation', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = {
            id: 'conv_new',
            title: 'New Chat',
            mode: 'CHAT',
            userId: 'user_123',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.create).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: 'New Chat', mode: 'CHAT' }),
        });
        const response = await POST(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.conversation.id).toBe('conv_new');
        expect(data.conversation.title).toBe('New Chat');
        expect(prisma.conversation.create).toHaveBeenCalledWith({
            data: {
                title: 'New Chat',
                mode: 'CHAT',
                userId: 'user_123',
            },
        });
    });

    it('should create conversation with default mode', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        const mockConversation = {
            id: 'conv_new',
            title: null,
            mode: 'CHAT',
            userId: 'user_123',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
        vi.mocked(prisma.conversation.create).mockResolvedValue(mockConversation as any);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const response = await POST(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.conversation.mode).toBe('CHAT');
    });

    it('should return 401 if not authenticated', async () => {
        // Arrange
        vi.mocked(getServerSession).mockResolvedValue(null);

        // Act
        const request = new NextRequest('http://localhost:3000/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: 'Test' }),
        });
        const response = await POST(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(401);
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('should return 400 on invalid input', async () => {
        // Arrange
        const mockSession = { user: { id: 'user_123' }, expires: '2025-12-31' };
        vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

        // Act - Title too long (>200 chars)
        const longTitle = 'a'.repeat(201);
        const request = new NextRequest('http://localhost:3000/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: longTitle }),
        });
        const response = await POST(request);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data).toMatchObject({
            error: 'Invalid request body',
        });
    });
});
