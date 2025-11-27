import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pollVideoOperation } from '@/lib/gemini';
import { ERROR_MESSAGES } from '@/lib/constants';

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
        const { operationName }: { operationName: string } = body;

        if (!operationName) {
            return NextResponse.json({ error: 'Operation name is required' }, { status: 400 });
        }

        const operation = await pollVideoOperation(operationName);

        return NextResponse.json({ operation });
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
