import { authOptions } from '@/lib/auth';
import { ERROR_MESSAGES } from '@/lib/constants';
import { pollVideoOperation } from '@/lib/gemini';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

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
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            return NextResponse.json({ error: 'Operation or operationName is required' }, { status: 400 });
        }

        const operation = await pollVideoOperation(operationToPoll);
        const responseOperationName = operationToPoll?.name || operation?.name || operationName || null;

        return NextResponse.json({ operation, operationName: responseOperationName });
    } catch (error: any) {
        console.error('Gemini Video Status API Error:', error);

        if (error.message?.includes('API_KEY')) {
            return NextResponse.json({ error: ERROR_MESSAGES.API_KEY_NOT_FOUND }, { status: 401 });
        }

        return NextResponse.json(
            { error: ERROR_MESSAGES.VIDEO_GENERATION_FAILED, details: error.message },
            { status: 500 }
        );
    }
}
