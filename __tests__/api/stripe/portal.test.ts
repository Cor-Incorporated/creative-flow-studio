/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/stripe/portal/route';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

// Mock NextAuth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        subscription: {
            findUnique: vi.fn(),
        },
    },
}));

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
    stripe: {
        billingPortal: {
            sessions: {
                create: vi.fn(),
            },
        },
    },
}));

describe('POST /api/stripe/portal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 if subscription not found', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('No Stripe customer found');
    });

    it('should return 404 if stripeCustomerId is missing', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            stripeCustomerId: null, // No Stripe customer ID
        });

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('No Stripe customer found');
    });

    it('should create portal session and return URL', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
        });

        (stripe.billingPortal.sessions.create as any).mockResolvedValue({
            url: 'https://billing.stripe.com/session/test_session_id',
        });

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.url).toBe('https://billing.stripe.com/session/test_session_id');

        // Verify Stripe API was called with correct parameters
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: 'cus_123',
            return_url: 'http://localhost:3000/dashboard',
        });
    });

    it('should use custom return URL if provided', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            stripeCustomerId: 'cus_123',
        });

        (stripe.billingPortal.sessions.create as any).mockResolvedValue({
            url: 'https://billing.stripe.com/session/test_session_id',
        });

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({ returnUrl: 'https://example.com/custom-return' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);

        // Verify custom return URL was used
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: 'cus_123',
            return_url: 'https://example.com/custom-return',
        });
    });

    it('should handle malformed JSON body gracefully', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            stripeCustomerId: 'cus_123',
        });

        (stripe.billingPortal.sessions.create as any).mockResolvedValue({
            url: 'https://billing.stripe.com/session/test_session_id',
        });

        // Create request with no body
        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        // Should fall back to default return URL
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: 'cus_123',
            return_url: 'http://localhost:3000/dashboard',
        });
    });

    it('should handle Stripe API errors', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            stripeCustomerId: 'cus_123',
        });

        const stripeError = new Error('Customer not found');
        (stripeError as any).type = 'StripeInvalidRequestError';
        (stripe.billingPortal.sessions.create as any).mockRejectedValue(stripeError);

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Invalid Stripe request');
        expect(data.details).toBe('Customer not found');
    });

    it('should handle database errors gracefully', async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
        });

        (prisma.subscription.findUnique as any).mockRejectedValue(
            new Error('Database connection failed')
        );

        const request = new NextRequest('http://localhost:3000/api/stripe/portal', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Failed to create portal session');
        expect(data.details).toBe('Database connection failed');
    });
});
