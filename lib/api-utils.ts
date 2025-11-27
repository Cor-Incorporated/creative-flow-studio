import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';

/**
 * API Utilities for common patterns across route handlers
 *
 * Usage:
 * ```typescript
 * const { session, errorResponse } = await requireAuth();
 * if (errorResponse) return errorResponse;
 * // session is guaranteed to be valid here
 * ```
 */

export interface AuthResult {
    session: Session & { user: { id: string; email: string } };
    errorResponse: null;
}

export interface AuthError {
    session: null;
    errorResponse: NextResponse;
}

/**
 * Require authentication for API routes
 * Returns either a valid session or an error response
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return {
            session: null,
            errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    return {
        session: session as AuthResult['session'],
        errorResponse: null,
    };
}

/**
 * Require admin role for API routes
 * Must be called after requireAuth()
 */
export async function requireAdmin(
    userId: string
): Promise<{ isAdmin: true; errorResponse: null } | { isAdmin: false; errorResponse: NextResponse }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
        return {
            isAdmin: false,
            errorResponse: NextResponse.json(
                { error: 'Forbidden: Admin access required' },
                { status: 403 }
            ),
        };
    }

    return { isAdmin: true, errorResponse: null };
}

/**
 * Handle subscription limit errors with appropriate HTTP status codes
 */
export function handleSubscriptionLimitError(error: Error): NextResponse {
    const message = error.message;

    // Feature not allowed in plan
    if (message.includes('not available in current plan')) {
        return NextResponse.json({ error: message }, { status: 403 });
    }

    // Monthly limit exceeded
    if (message.includes('Monthly request limit exceeded')) {
        return NextResponse.json(
            { error: message },
            {
                status: 429,
                headers: {
                    'Retry-After': '86400', // 24 hours
                },
            }
        );
    }

    // Generic subscription error
    return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Create a JSON error response with consistent format
 */
export function errorResponse(
    message: string,
    status: number,
    details?: string
): NextResponse {
    const body: { error: string; details?: string } = { error: message };
    if (details) {
        body.details = details;
    }
    return NextResponse.json(body, { status });
}

/**
 * Handle Zod validation errors
 */
export function handleValidationError(error: any): NextResponse {
    if (error.name === 'ZodError') {
        return NextResponse.json(
            {
                error: 'Invalid request parameters',
                details: error.errors,
            },
            { status: 400 }
        );
    }
    throw error; // Re-throw if not a Zod error
}
