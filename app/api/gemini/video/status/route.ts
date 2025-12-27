import { authOptions } from '@/lib/auth';
import { ERROR_MESSAGES } from '@/lib/constants';
import { pollVideoOperation } from '@/lib/gemini';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, jsonError } from '@/lib/api-utils';
import { safeErrorForLog } from '@/lib/utils';

/**
 * POST /api/gemini/video/status
 * Poll the status of a video generation operation
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ENTERPRISE plan required (implicitly, since only ENTERPRISE can generate videos)
 *
 * Request body: { operationName: string }
 * Response: { operation: GenerateVideosOperation }
 */

export async function POST(request: NextRequest) {
    const requestId = createRequestId();
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return jsonError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED', requestId });
        }

        const body = await request.json();
        const { operation: operationFromBody, operationName }: { operation?: any; operationName?: string } = body;

        // Support both operation object and operationName string (for backward compatibility)
        let operationToPoll: any;
        if (operationFromBody) {
            operationToPoll = operationFromBody;
        } else if (operationName) {
            // If only operationName is provided, create a minimal operation object
            operationToPoll = { name: operationName };
        } else {
            return jsonError({
                message: 'Operation or operationName is required',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        const operation = await pollVideoOperation(operationToPoll);
        const responseOperationName = operationToPoll?.name || operation?.name || operationName || null;

        return NextResponse.json({ operation, operationName: responseOperationName });
    } catch (error: any) {
        console.error('Gemini Video Status API Error', { requestId, error: safeErrorForLog(error) });

        if (error.message?.includes('API_KEY')) {
            return jsonError({
                message: ERROR_MESSAGES.API_KEY_NOT_FOUND,
                status: 401,
                code: 'GEMINI_API_KEY_NOT_FOUND',
                requestId,
            });
        }

        return jsonError({
            message: ERROR_MESSAGES.VIDEO_GENERATION_FAILED,
            status: 500,
            code: 'UPSTREAM_ERROR',
            details: error.message,
            requestId,
        });
    }
}
