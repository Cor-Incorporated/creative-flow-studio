import { NextRequest, NextResponse } from 'next/server';
import { generateVideo } from '@/lib/gemini';
import { ERROR_MESSAGES, VALID_VIDEO_ASPECT_RATIOS } from '@/lib/constants';
import type { AspectRatio } from '@/types/app';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, aspectRatio = '16:9' }: { prompt: string; aspectRatio?: AspectRatio } =
            body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Validate aspect ratio
        if (!VALID_VIDEO_ASPECT_RATIOS.includes(aspectRatio as any)) {
            return NextResponse.json(
                { error: `Invalid aspect ratio: ${aspectRatio}` },
                { status: 400 }
            );
        }

        const result = await generateVideo(prompt, aspectRatio);

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Gemini Video API Error:', error);

        if (error.message?.includes('API_KEY')) {
            return NextResponse.json({ error: ERROR_MESSAGES.API_KEY_NOT_FOUND }, { status: 401 });
        }

        return NextResponse.json(
            { error: ERROR_MESSAGES.VIDEO_GENERATION_FAILED, details: error.message },
            { status: 500 }
        );
    }
}
