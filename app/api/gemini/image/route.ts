import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateImage, editImage } from '@/lib/gemini';
import { checkSubscriptionLimits, logUsage } from '@/lib/subscription';
import { ERROR_MESSAGES, VALID_IMAGE_ASPECT_RATIOS } from '@/lib/constants';
import type { AspectRatio, Media } from '@/types/app';

/**
 * POST /api/gemini/image
 * Generate or edit images using Gemini/Imagen API
 *
 * Authentication: Required (NextAuth session)
 * Authorization: PRO or ENTERPRISE plan required
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 4.2
 */

export async function POST(request: NextRequest) {
    let originalImage: Media | undefined;

    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // 2. Subscription limits check
        try {
            await checkSubscriptionLimits(session.user.id, 'image_generation');
        } catch (error: any) {
            // Feature not allowed in plan (FREE plan doesn't have image generation)
            if (error.message.includes('not available in current plan')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 403 }
                );
            }

            // Monthly limit exceeded
            if (error.message.includes('Monthly request limit exceeded')) {
                return NextResponse.json(
                    { error: error.message },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': '86400', // 24 hours in seconds
                        },
                    }
                );
            }

            // Other subscription errors
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        // 3. Generate or edit image
        let result;
        const isEditing = !!originalImage;

        // Image editing mode
        if (originalImage) {
            result = await editImage(prompt, originalImage);
        }
        // Image generation mode
        else {
            result = await generateImage(prompt, aspectRatio);
        }

        // 4. Log usage after successful generation
        await logUsage(session.user.id, 'image_generation', {
            isEditing,
            aspectRatio,
            resourceType: isEditing ? 'gemini-2.5-flash-image' : 'imagen-4.0',
            promptLength: prompt.length,
        });

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
