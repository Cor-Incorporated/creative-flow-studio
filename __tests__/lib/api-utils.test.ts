import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import {
    requireAuth,
    requireAdmin,
    handleSubscriptionLimitError,
    errorResponse,
    handleValidationError,
} from '@/lib/api-utils';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock next-auth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}));

// Mock auth options
vi.mock('@/lib/auth', () => ({
    authOptions: {},
}));

describe('API Utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('requireAuth', () => {
        it('should return session when authenticated', async () => {
            const mockSession = {
                user: { id: 'user-123', email: 'test@example.com' },
            };
            vi.mocked(getServerSession).mockResolvedValue(mockSession);

            const result = await requireAuth();

            expect(result.session).toEqual(mockSession);
            expect(result.errorResponse).toBeNull();
        });

        it('should return 401 error when no session', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null);

            const result = await requireAuth();

            expect(result.session).toBeNull();
            expect(result.errorResponse).toBeInstanceOf(NextResponse);

            const response = result.errorResponse as NextResponse;
            expect(response.status).toBe(401);

            const body = await response.json();
            expect(body.error).toBe('Unauthorized');
        });

        it('should return 401 error when session has no user id', async () => {
            vi.mocked(getServerSession).mockResolvedValue({ user: {} });

            const result = await requireAuth();

            expect(result.session).toBeNull();
            expect(result.errorResponse).not.toBeNull();
        });
    });

    describe('requireAdmin', () => {
        it('should return isAdmin: true for admin users', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                role: 'ADMIN',
            } as any);

            const result = await requireAdmin('user-123');

            expect(result.isAdmin).toBe(true);
            expect(result.errorResponse).toBeNull();
        });

        it('should return 403 for non-admin users', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                role: 'USER',
            } as any);

            const result = await requireAdmin('user-123');

            expect(result.isAdmin).toBe(false);
            expect(result.errorResponse).toBeInstanceOf(NextResponse);

            const response = result.errorResponse as NextResponse;
            expect(response.status).toBe(403);

            const body = await response.json();
            expect(body.error).toBe('Forbidden: Admin access required');
        });

        it('should return 403 when user not found', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            const result = await requireAdmin('user-123');

            expect(result.isAdmin).toBe(false);
            expect(result.errorResponse).not.toBeNull();
        });
    });

    describe('handleSubscriptionLimitError', () => {
        it('should return 403 for feature not available', () => {
            const error = new Error('Feature not available in current plan');

            const response = handleSubscriptionLimitError(error);

            expect(response.status).toBe(403);
        });

        it('should return 429 for monthly limit exceeded', async () => {
            const error = new Error('Monthly request limit exceeded');

            const response = handleSubscriptionLimitError(error);

            expect(response.status).toBe(429);
            expect(response.headers.get('Retry-After')).toBe('86400');

            const body = await response.json();
            expect(body.error).toBe('Monthly request limit exceeded');
        });

        it('should return 403 for other subscription errors', () => {
            const error = new Error('No active subscription');

            const response = handleSubscriptionLimitError(error);

            expect(response.status).toBe(403);
        });
    });

    describe('errorResponse', () => {
        it('should create error response without details', async () => {
            const response = errorResponse('Something went wrong', 500);

            expect(response.status).toBe(500);

            const body = await response.json();
            expect(body.error).toBe('Something went wrong');
            expect(body.details).toBeUndefined();
        });

        it('should create error response with details', async () => {
            const response = errorResponse('Validation failed', 400, 'Missing field');

            expect(response.status).toBe(400);

            const body = await response.json();
            expect(body.error).toBe('Validation failed');
            expect(body.details).toBe('Missing field');
        });
    });

    describe('handleValidationError', () => {
        it('should handle Zod errors', async () => {
            const zodError = {
                name: 'ZodError',
                errors: [{ path: ['email'], message: 'Invalid email' }],
            };

            const response = handleValidationError(zodError);

            expect(response.status).toBe(400);

            const body = await response.json();
            expect(body.error).toBe('Invalid request parameters');
            expect(body.details).toEqual([{ path: ['email'], message: 'Invalid email' }]);
        });

        it('should re-throw non-Zod errors', () => {
            const regularError = new Error('Something else');

            expect(() => handleValidationError(regularError)).toThrow('Something else');
        });
    });
});
