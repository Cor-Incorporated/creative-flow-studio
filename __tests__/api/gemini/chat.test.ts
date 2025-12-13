/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
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

// Mock Gemini functions
vi.mock('@/lib/gemini', () => ({
    generateChatResponse: vi.fn().mockResolvedValue({ text: 'Chat response' }),
    generateProResponse: vi.fn().mockResolvedValue({
        text: 'Pro response',
        thinking: 'Thinking process',
    }),
    generateSearchGroundedResponse: vi.fn().mockResolvedValue({
        text: 'Search response',
        sources: [],
    }),
    analyzeImage: vi.fn().mockResolvedValue({ text: 'Image analysis' }),
}));

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
    });

    it('should return 403 if plan does not allow Pro mode', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (checkSubscriptionLimits as any).mockRejectedValue(
            new Error('Pro mode not available in current plan')
        );

        const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Hello', mode: 'pro' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain('not available in current plan');
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
                resourceType: 'gemini-2.5-flash',
            })
        );
    });

    it('should generate Pro response and log usage', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-pro', email: 'pro@example.com' },
        });

        (checkSubscriptionLimits as any).mockResolvedValue({
            allowed: true,
            plan: { name: 'PRO' },
            usageCount: 100,
            limit: 1000,
        });

        const request = new NextRequest('http://localhost:3000/api/gemini/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Complex question', mode: 'pro' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);

        // Verify checkSubscriptionLimits was called with pro_mode
        expect(checkSubscriptionLimits).toHaveBeenCalledWith('user-pro', 'pro_mode');

        // Verify logUsage was called with pro_mode
        expect(logUsage).toHaveBeenCalledWith(
            'user-pro',
            'pro_mode',
            expect.objectContaining({
                mode: 'pro',
                resourceType: 'gemini-2.5-pro',
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

        // Should not call checkSubscriptionLimits for invalid requests
        expect(checkSubscriptionLimits).not.toHaveBeenCalled();
    });
});
