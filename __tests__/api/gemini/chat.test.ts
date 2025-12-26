/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { FinishReason } from '@google/genai';
import { POST } from '@/app/api/gemini/chat/route';
import { checkSubscriptionLimits, getMonthlyUsageCount, getUserSubscription, logUsage } from '@/lib/subscription';

// Mock NextAuth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

// Mock subscription utilities
vi.mock('@/lib/subscription', () => ({
    checkSubscriptionLimits: vi.fn(),
    logUsage: vi.fn(),
    getUserSubscription: vi.fn(),
    getMonthlyUsageCount: vi.fn(),
}));

// Mock Gemini functions - response structure must include candidates for safety check
vi.mock('@/lib/gemini', () => ({
    generateChatResponse: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Chat response' }] }, finishReason: 'STOP' }],
        text: 'Chat response',
    }),
    generateSearchGroundedResponse: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Search response' }] }, finishReason: 'STOP' }],
        text: 'Search response',
        sources: [],
    }),
    analyzeImage: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Image analysis' }] }, finishReason: 'STOP' }],
        text: 'Image analysis',
    }),
    analyzeVideo: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Video analysis' }] }, finishReason: 'STOP' }],
        text: 'Video analysis',
    }),
    analyzeMultipleImages: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Multiple images analysis' }] }, finishReason: 'STOP' }],
        text: 'Multiple images analysis',
    }),
}));

// Import mocked functions for direct access in tests
import { generateChatResponse, generateSearchGroundedResponse, analyzeMultipleImages } from '@/lib/gemini';

describe('POST /api/gemini/chat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Hello' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
        expect(data.code).toBe('UNAUTHORIZED');
        expect(typeof data.requestId).toBe('string');
        expect(response.headers.get('X-Request-Id')).toBeTruthy();
    });

    it('should return 429 if monthly limit exceeded', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Monthly request limit exceeded')
        );
        (getUserSubscription as any).mockResolvedValue({
            plan: { name: 'FREE', features: { maxRequestsPerMonth: 1000 } },
        });
        (getMonthlyUsageCount as any).mockResolvedValue(1000);

        const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Hello' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('86400');
        const data = await response.json();
        expect(data.error).toContain('Monthly request limit exceeded');
        expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(typeof data.requestId).toBe('string');
        expect(response.headers.get('X-Request-Id')).toBeTruthy();
    });

    it('should generate chat response and log usage', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (checkSubscriptionLimits as any).mockResolvedValue({
            allowed: true,
            plan: { name: 'PRO' },
            usageCount: 50,
            limit: 1000,
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Hello', mode: 'chat' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.result).toHaveProperty('text');

        // Verify checkSubscriptionLimits was called
        expect(checkSubscriptionLimits).toHaveBeenCalledWith('user-1', 'chat');

        // Verify logUsage was called
        expect(logUsage).toHaveBeenCalledWith(
            'user-1',
            'chat',
            expect.objectContaining({
                mode: 'chat',
                resourceType: 'gemini-3-flash', // Gemini 3
            })
        );
    });

    it('should return 400 if prompt is missing', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
            method: 'POST',
            body: JSON.stringify({ mode: 'chat' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Prompt is required');
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(typeof data.requestId).toBe('string');

        // Should not call checkSubscriptionLimits for invalid requests
        expect(checkSubscriptionLimits).not.toHaveBeenCalled();
    });

    describe('Safety checks', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });

            (checkSubscriptionLimits as any).mockResolvedValue({
                allowed: true,
                plan: { name: 'PRO' },
                usageCount: 50,
                limit: 1000,
            });
        });

        it('should return 400 SAFETY_BLOCKED when response has finishReason=SAFETY', async () => {
            vi.mocked(generateChatResponse).mockResolvedValueOnce({
                candidates: [{ content: { parts: [{ text: '' }] }, finishReason: FinishReason.SAFETY }],
                text: '',
            } as any);

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Generate harmful content', mode: 'chat' }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('SAFETY_BLOCKED');
            expect(typeof data.requestId).toBe('string');
            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('should return 400 RECITATION_BLOCKED when response has finishReason=RECITATION', async () => {
            vi.mocked(generateChatResponse).mockResolvedValueOnce({
                candidates: [{ content: { parts: [{ text: '' }] }, finishReason: FinishReason.RECITATION }],
                text: '',
            } as any);

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Copy this book verbatim', mode: 'chat' }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('RECITATION_BLOCKED');
            expect(typeof data.requestId).toBe('string');
            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('should return error when response has no candidates', async () => {
            vi.mocked(generateChatResponse).mockResolvedValueOnce({
                candidates: [],
                text: '',
            } as any);

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Test prompt', mode: 'chat' }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('CONTENT_POLICY_VIOLATION');
            expect(typeof data.requestId).toBe('string');
        });

        it('should include requestId in error response and X-Request-Id header', async () => {
            vi.mocked(generateChatResponse).mockResolvedValueOnce({
                candidates: [{ content: { parts: [{ text: '' }] }, finishReason: FinishReason.SAFETY }],
                text: '',
            } as any);

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Test prompt', mode: 'chat' }),
            });

            const response = await POST(request);
            const data = await response.json();

            // Verify requestId is present and matches header
            expect(typeof data.requestId).toBe('string');
            expect(data.requestId.length).toBeGreaterThan(0);
            expect(response.headers.get('X-Request-Id')).toBe(data.requestId);
        });
    });

    describe('Search mode with history', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });

            (checkSubscriptionLimits as any).mockResolvedValue({
                allowed: true,
                plan: { name: 'PRO' },
                usageCount: 50,
                limit: 1000,
            });
        });

        it('should pass history to generateSearchGroundedResponse for context', async () => {
            const conversationHistory = [
                { role: 'user', parts: [{ text: 'What is the latest Google AI model?' }] },
                { role: 'model', parts: [{ text: 'The latest is Gemini 2.0 Flash.' }] },
            ];

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Is that really the most recent one?',
                    mode: 'search',
                    history: conversationHistory,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);

            // Verify generateSearchGroundedResponse was called with history as first parameter
            expect(generateSearchGroundedResponse).toHaveBeenCalledWith(
                conversationHistory,
                'Is that really the most recent one?',
                undefined, // systemInstruction
                undefined  // temperature
            );
        });

        it('should pass empty history array when no history provided', async () => {
            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Search for latest news',
                    mode: 'search',
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);

            // Verify generateSearchGroundedResponse was called with empty history
            expect(generateSearchGroundedResponse).toHaveBeenCalledWith(
                [], // empty history (default)
                'Search for latest news',
                undefined, // systemInstruction
                undefined  // temperature
            );
        });

        it('should pass systemInstruction and temperature to search mode', async () => {
            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Search query',
                    mode: 'search',
                    history: [],
                    systemInstruction: 'Be concise',
                    temperature: 0.5,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);

            expect(generateSearchGroundedResponse).toHaveBeenCalledWith(
                [],
                'Search query',
                'Be concise',
                0.5
            );
        });
    });

    describe('Multiple images analysis (mediaList)', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });

            (checkSubscriptionLimits as any).mockResolvedValue({
                allowed: true,
                plan: { name: 'PRO' },
                usageCount: 50,
                limit: 1000,
            });
        });

        it('should analyze multiple images when mediaList is provided', async () => {
            const mediaList = [
                { type: 'image' as const, url: 'data:image/png;base64,abc123', mimeType: 'image/png' },
                { type: 'image' as const, url: 'data:image/jpeg;base64,def456', mimeType: 'image/jpeg' },
            ];

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Compare these images',
                    mode: 'chat',
                    mediaList,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(analyzeMultipleImages).toHaveBeenCalledWith(
                'Compare these images',
                mediaList,
                undefined
            );
        });

        it('should return 400 if mediaList exceeds 8 images', async () => {
            const mediaList = Array(9).fill(null).map((_, i) => ({
                type: 'image' as const,
                url: `data:image/png;base64,image${i}`,
                mimeType: 'image/png',
            }));

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Analyze these images',
                    mode: 'chat',
                    mediaList,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toContain('8枚');
        });

        it('should return 400 if mediaList contains non-image media', async () => {
            const mediaList = [
                { type: 'image' as const, url: 'data:image/png;base64,abc123', mimeType: 'image/png' },
                { type: 'video' as const, url: 'data:video/mp4;base64,xyz789', mimeType: 'video/mp4' },
            ];

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Analyze these',
                    mode: 'chat',
                    mediaList,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toContain('画像のみ');
        });

        it('should prioritize mediaList over single media', async () => {
            const mediaList = [
                { type: 'image' as const, url: 'data:image/png;base64,list1', mimeType: 'image/png' },
                { type: 'image' as const, url: 'data:image/png;base64,list2', mimeType: 'image/png' },
            ];
            const singleMedia = {
                type: 'image' as const,
                url: 'data:image/png;base64,single',
                mimeType: 'image/png',
            };

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Analyze',
                    mode: 'chat',
                    media: singleMedia,
                    mediaList,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            // Should call analyzeMultipleImages, not analyzeImage
            expect(analyzeMultipleImages).toHaveBeenCalledWith(
                'Analyze',
                mediaList,
                undefined
            );
        });

        it('should log usage with correct mediaCount for mediaList', async () => {
            const mediaList = [
                { type: 'image' as const, url: 'data:image/png;base64,abc123', mimeType: 'image/png' },
                { type: 'image' as const, url: 'data:image/png;base64,def456', mimeType: 'image/png' },
                { type: 'image' as const, url: 'data:image/png;base64,ghi789', mimeType: 'image/png' },
            ];

            const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Analyze these 3 images',
                    mode: 'chat',
                    mediaList,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(logUsage).toHaveBeenCalledWith(
                'user-1',
                'chat',
                expect.objectContaining({
                    hasMedia: true,
                    mediaCount: 3,
                })
            );
        });
    });
});
