import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';

export type ApiErrorCode =
    | 'UNAUTHORIZED'
    | 'VALIDATION_ERROR'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'FORBIDDEN_PLAN'
    | 'FORBIDDEN_ADMIN'
    | 'RATE_LIMIT_EXCEEDED'
    | 'GEMINI_API_KEY_NOT_FOUND'
    | 'UPSTREAM_ERROR'
    | 'INTERNAL_ERROR'
    // Content policy/safety errors
    | 'CONTENT_POLICY_VIOLATION'
    | 'SAFETY_BLOCKED'
    | 'RECITATION_BLOCKED';

export type ApiErrorBody = {
    error: string;
    code?: ApiErrorCode | string;
    details?: any;
    requestId?: string;
    [key: string]: any;
};

export function createRequestId(): string {
    try {
        // Node 18+ / modern runtimes
        if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
            return (globalThis.crypto as any).randomUUID();
        }
    } catch {
        // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Create a JSON error response with consistent format (code + requestId + optional details/extra fields).
 * Prefer this over ad-hoc NextResponse.json({ error }) for user-facing APIs.
 */
export function jsonError(input: {
    message: string;
    status: number;
    code?: ApiErrorCode | string;
    details?: any;
    requestId?: string;
    headers?: Record<string, string>;
    extra?: Record<string, any>;
}): NextResponse {
    const requestId = input.requestId || createRequestId();
    const body: ApiErrorBody = {
        error: input.message,
        code: input.code,
        requestId,
        ...(input.extra || {}),
    };
    if (typeof input.details !== 'undefined') {
        body.details = input.details;
    }

    const headers: Record<string, string> = {
        'X-Request-Id': requestId,
        ...(input.headers || {}),
    };

    return NextResponse.json(body, { status: input.status, headers });
}

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
            errorResponse: jsonError({
                message: 'Unauthorized',
                status: 401,
                code: 'UNAUTHORIZED',
            }),
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
            errorResponse: jsonError({
                message: 'Forbidden: Admin access required',
                status: 403,
                code: 'FORBIDDEN_ADMIN',
            }),
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
        return jsonError({ message, status: 403, code: 'FORBIDDEN_PLAN' });
    }

    // Monthly limit exceeded
    if (message.includes('Monthly request limit exceeded')) {
        return jsonError({
            message,
            status: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            headers: {
                'Retry-After': '86400', // 24 hours
            },
        });
    }

    // Generic subscription error
    return jsonError({ message, status: 403, code: 'FORBIDDEN_PLAN' });
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
