/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/gemini/image/route';
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
            name: 'PRO',
            features: {
                maxRequestsPerMonth: 1000,
            },
        },
        currentPeriodEnd: new Date('2030-01-01T00:00:00.000Z'),
    }),
    logUsage: vi.fn(),
}));

// Mock Gemini functions
vi.mock('@/lib/gemini', () => ({
    generateImage: vi.fn().mockResolvedValue('data:image/png;base64,base64ImageData'),
    editImage: vi.fn().mockResolvedValue({
        candidates: [
            {
                content: {
                    parts: [
                        {
                            inlineData: {
                                data: 'base64EditedImageData',
                            },
                        },
                    ],
                },
            },
        ],
    }),
}));

describe('POST /api/gemini/image', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/gemini/image', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate image' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if plan does not allow image generation', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-free', email: 'free@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Image generation not available in current plan')
        );

        const request = new NextRequest('http://localhost:3000/api/gemini/image', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate image' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain('not available in current plan');
    });

    it('should return 429 if monthly limit exceeded', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-pro', email: 'pro@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Monthly request limit exceeded')
        );

        const request = new NextRequest('http://localhost:3000/api/gemini/image', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate image' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('86400');
    });

    it('should generate image and log usage', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-pro', email: 'pro@example.com' },
        });

        (checkSubscriptionLimits as any).mockResolvedValue({
            allowed: true,
            plan: { name: 'PRO' },
            usageCount: 100,
            limit: 1000,
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/image', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'A beautiful sunset', aspectRatio: '16:9' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('imageUrl');
        expect(data.imageUrl).toContain('data:image/png;base64,');
        expect(data).not.toHaveProperty('result');

        // Verify checkSubscriptionLimits was called
        expect(checkSubscriptionLimits).toHaveBeenCalledWith('user-pro', 'image_generation');

        // Verify logUsage was called for image generation
        expect(logUsage).toHaveBeenCalledWith(
            'user-pro',
            'image_generation',
            expect.objectContaining({
                isEditing: false,
                aspectRatio: '16:9',
                resourceType: 'imagen-4.0',
            })
        );
    });

    it('should edit image and log usage', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-pro', email: 'pro@example.com' },
        });

        (checkSubscriptionLimits as any).mockResolvedValue({
            allowed: true,
            plan: { name: 'PRO' },
            usageCount: 150,
            limit: 1000,
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/image', {
            method: 'POST',
            body: JSON.stringify({
                prompt: 'Add more clouds',
                originalImage: {
                    type: 'image',
                    url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
                    mimeType: 'image/jpeg',
                },
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);

        // Verify logUsage was called for image editing
        expect(logUsage).toHaveBeenCalledWith(
            'user-pro',
            'image_generation',
            expect.objectContaining({
                isEditing: true,
                resourceType: 'gemini-2.5-flash-image',
            })
        );
    });

    it('should return 400 for invalid aspect ratio', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-pro', email: 'pro@example.com' },
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/image', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate image', aspectRatio: '99:99' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Invalid aspect ratio');

        // Should not call checkSubscriptionLimits for invalid requests
        expect(checkSubscriptionLimits).not.toHaveBeenCalled();
    });
});
