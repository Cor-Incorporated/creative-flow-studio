import { NextRequest, NextResponse } from 'next/server';
import { generateImage, editImage } from '@/lib/gemini';
import { ERROR_MESSAGES, VALID_IMAGE_ASPECT_RATIOS } from '@/lib/constants';
import type { AspectRatio, Media } from '@/types/app';

export async function POST(request: NextRequest) {
    let originalImage: Media | undefined;

    try {
        const body = await request.json();
        const {
            prompt,
            aspectRatio = '1:1',
            originalImage: originalImageFromBody,
        }: {
            prompt: string;
            aspectRatio?: AspectRatio;
            originalImage?: Media;
        } = body;

        originalImage = originalImageFromBody;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Validate aspect ratio
        if (!VALID_IMAGE_ASPECT_RATIOS.includes(aspectRatio as any)) {
            return NextResponse.json(
                { error: `Invalid aspect ratio: ${aspectRatio}` },
                { status: 400 }
            );
        }

        let result;

        // Image editing mode
        if (originalImage) {
            result = await editImage(prompt, originalImage);
        }
        // Image generation mode
        else {
            result = await generateImage(prompt, aspectRatio);
        }

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Gemini Image API Error:', error);

        if (error.message?.includes('API_KEY')) {
            return NextResponse.json({ error: ERROR_MESSAGES.API_KEY_NOT_FOUND }, { status: 401 });
        }

        return NextResponse.json(
            {
                error: originalImage
                    ? ERROR_MESSAGES.IMAGE_EDIT_NO_IMAGE
                    : ERROR_MESSAGES.IMAGE_GENERATION_FAILED,
                details: error.message,
            },
            { status: 500 }
        );
    }
}
