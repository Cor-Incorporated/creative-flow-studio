import { NextRequest, NextResponse } from 'next/server';
import { pollVideoOperation } from '@/lib/gemini';
import { ERROR_MESSAGES } from '@/lib/constants';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { operationName }: { operationName: string } = body;

        if (!operationName) {
            return NextResponse.json({ error: 'Operation name is required' }, { status: 400 });
        }

        const result = await pollVideoOperation(operationName);

        return NextResponse.json({ result });
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
