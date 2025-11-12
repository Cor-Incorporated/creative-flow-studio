import { NextRequest, NextResponse } from 'next/server';
import {
    generateChatResponse,
    generateProResponse,
    generateSearchGroundedResponse,
    analyzeImage,
} from '@/lib/gemini';
import { ERROR_MESSAGES } from '@/lib/constants';
import type { GenerationMode, Media } from '@/types/app';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            prompt,
            history = [],
            mode = 'chat',
            systemInstruction,
            temperature,
            media,
        }: {
            prompt: string;
            history?: any[];
            mode?: GenerationMode;
            systemInstruction?: string;
            temperature?: number;
            media?: Media;
        } = body;

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        let result;

        // Handle image upload (multimodal input)
        if (media && media.type === 'image') {
            result = await analyzeImage(
                prompt,
                media.url,
                media.mimeType,
                systemInstruction
            );
        }
        // Text-only generation
        else {
            switch (mode) {
                case 'chat':
                    result = await generateChatResponse(
                        history,
                        prompt,
                        systemInstruction,
                        temperature
                    );
                    break;
                case 'pro':
                    result = await generateProResponse(
                        prompt,
                        systemInstruction,
                        temperature
                    );
                    break;
                case 'search':
                    result = await generateSearchGroundedResponse(
                        prompt,
                        systemInstruction,
                        temperature
                    );
                    break;
                default:
                    return NextResponse.json(
                        { error: `Unsupported mode: ${mode}` },
                        { status: 400 }
                    );
            }
        }

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Gemini Chat API Error:', error);

        // Handle specific error cases
        if (error.message?.includes('API_KEY')) {
            return NextResponse.json(
                { error: ERROR_MESSAGES.API_KEY_NOT_FOUND },
                { status: 401 }
            );
        }

        return NextResponse.json(
            { error: ERROR_MESSAGES.GENERIC_ERROR, details: error.message },
            { status: 500 }
        );
    }
}
