/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/gemini/video/route';
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

// Mock Gemini functions
vi.mock('@/lib/gemini', () => ({
    generateVideo: vi.fn().mockResolvedValue({
        name: 'projects/123/operations/456',
        done: false,
    }),
}));

// Import mocked functions for direct access in tests
import { generateVideo } from '@/lib/gemini';

describe('POST /api/gemini/video', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate video' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
        expect(data.code).toBe('UNAUTHORIZED');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 403 if plan does not allow video generation', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-pro', email: 'pro@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Video generation not available in current plan')
        );

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate video' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain('not available in current plan');
        expect(data.code).toBe('FORBIDDEN_PLAN');
        expect(typeof data.requestId).toBe('string');
    });

    it('should return 429 if monthly limit exceeded', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-enterprise', email: 'enterprise@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Monthly request limit exceeded')
        );
        (getUserSubscription as any).mockResolvedValue({
            plan: { name: 'ENTERPRISE', features: { maxRequestsPerMonth: null } },
        });
        (getMonthlyUsageCount as any).mockResolvedValue(999999);

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate video' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('86400');
        const data = await response.json();
        expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(typeof data.requestId).toBe('string');
    });

    it('should generate video and log usage', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-enterprise', email: 'enterprise@example.com' },
        });

        (checkSubscriptionLimits as any).mockResolvedValue({
            allowed: true,
            plan: { name: 'ENTERPRISE' },
            usageCount: 500,
            limit: null, // Unlimited
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'A cat playing piano', aspectRatio: '9:16' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('operationName');
        expect(data.operationName).toBe('projects/123/operations/456');
        expect(data).not.toHaveProperty('result');

        // Verify checkSubscriptionLimits was called
        expect(checkSubscriptionLimits).toHaveBeenCalledWith(
            'user-enterprise',
            'video_generation'
        );

        // Verify logUsage was called
        expect(logUsage).toHaveBeenCalledWith(
            'user-enterprise',
            'video_generation',
            expect.objectContaining({
                aspectRatio: '9:16',
                resourceType: 'veo-3.1-fast-generate-preview',
                promptLength: 'A cat playing piano'.length,
            })
        );
    });

    it('should return 400 if prompt is missing', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-enterprise', email: 'enterprise@example.com' },
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ aspectRatio: '16:9' }),
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

    it('should return 400 for invalid aspect ratio', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-enterprise', email: 'enterprise@example.com' },
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate video', aspectRatio: '99:99' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid aspect ratio');
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(typeof data.requestId).toBe('string');

        // Should not call checkSubscriptionLimits for invalid requests
        expect(checkSubscriptionLimits).not.toHaveBeenCalled();
    });

    describe('Image-to-Video and safety checks', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-enterprise', email: 'enterprise@example.com' },
            });

            (checkSubscriptionLimits as any).mockResolvedValue({
                allowed: true,
                plan: { name: 'ENTERPRISE' },
                usageCount: 500,
                limit: null,
            });
        });

        it('should call generateVideo with media parameter for Image-to-Video', async () => {
            const mediaInput = {
                type: 'image',
                url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
                mimeType: 'image/jpeg',
            };

            const request = new NextRequest('http://localhost:3000/api/gemini/video', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Animate this image',
                    aspectRatio: '16:9',
                    media: mediaInput,
                }),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(vi.mocked(generateVideo)).toHaveBeenCalledWith(
                'Animate this image',
                '16:9',
                mediaInput
            );
        });

        it('should return 400 SAFETY_BLOCKED when error message contains "safety"', async () => {
            vi.mocked(generateVideo).mockRejectedValueOnce(new Error('Request blocked due to safety violation'));

            const request = new NextRequest('http://localhost:3000/api/gemini/video', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Generate harmful video content' }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('SAFETY_BLOCKED');
            expect(typeof data.requestId).toBe('string');
            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('should return 400 RECITATION_BLOCKED when error message contains "copyright"', async () => {
            vi.mocked(generateVideo).mockRejectedValueOnce(new Error('Content blocked due to copyright infringement'));

            const request = new NextRequest('http://localhost:3000/api/gemini/video', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Recreate famous movie scene' }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('RECITATION_BLOCKED');
            expect(typeof data.requestId).toBe('string');
            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('should return 400 SAFETY_BLOCKED when error message contains "policy"', async () => {
            vi.mocked(generateVideo).mockRejectedValueOnce(new Error('Request violates content policy'));

            const request = new NextRequest('http://localhost:3000/api/gemini/video', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Generate policy-violating content' }),
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('SAFETY_BLOCKED');
            expect(typeof data.requestId).toBe('string');
            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });
    });
});
