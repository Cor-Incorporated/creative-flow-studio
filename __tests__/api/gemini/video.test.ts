/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/gemini/video/route';
import { checkSubscriptionLimits, logUsage } from '@/lib/subscription';

// Mock NextAuth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

// Mock subscription utilities
vi.mock('@/lib/subscription', () => ({
    checkSubscriptionLimits: vi.fn(),
    getMonthlyUsageCount: vi.fn().mockResolvedValue(0),
    getUserSubscription: vi.fn().mockResolvedValue({
        plan: {
            name: 'ENTERPRISE',
            features: {
                maxRequestsPerMonth: null,
            },
        },
        currentPeriodEnd: new Date('2030-01-01T00:00:00.000Z'),
    }),
    logUsage: vi.fn(),
}));

// Mock Gemini functions
vi.mock('@/lib/gemini', () => ({
    generateVideo: vi.fn().mockResolvedValue({
        name: 'projects/123/operations/456',
        done: false,
    }),
}));

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
    });

    it('should return 429 if monthly limit exceeded', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-enterprise', email: 'enterprise@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Monthly request limit exceeded')
        );

        const request = new NextRequest('http://localhost:3000/api/gemini/video', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate video' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('86400');
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

        // Should not call checkSubscriptionLimits for invalid requests
        expect(checkSubscriptionLimits).not.toHaveBeenCalled();
    });
});
