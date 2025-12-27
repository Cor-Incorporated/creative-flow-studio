import { authOptions } from '@/lib/auth';
import { ERROR_MESSAGES, VALID_IMAGE_ASPECT_RATIOS } from '@/lib/constants';
import { editImage, generateImage } from '@/lib/gemini';
import { checkSubscriptionLimits, getMonthlyUsageCount, getUserSubscription, logUsage, PlanFeatures } from '@/lib/subscription';
import type { AspectRatio, Media } from '@/types/app';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, jsonError } from '@/lib/api-utils';
import { safeErrorForLog } from '@/lib/utils';
import { checkResponseSafety, blockReasonToErrorCode } from '@/lib/gemini-safety';

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
    const requestId = createRequestId();

    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return jsonError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED', requestId });
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
            return jsonError({
                message: 'Prompt is required',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // Validate aspect ratio
        if (!VALID_IMAGE_ASPECT_RATIOS.includes(aspectRatio as any)) {
            return jsonError({
                message: `Invalid aspect ratio: ${aspectRatio}`,
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // 2. Subscription limits check
        try {
            await checkSubscriptionLimits(session.user.id, 'image_generation');
        } catch (error: any) {
            // Feature not allowed in plan (FREE plan doesn't have image generation)
            if (error.message.includes('not available in current plan')) {
                return jsonError({
                    message: error.message,
                    status: 403,
                    code: 'FORBIDDEN_PLAN',
                    requestId,
                });
            }

            // Monthly limit exceeded - return detailed info
            if (error.message.includes('Monthly request limit exceeded')) {
                const subscription = await getUserSubscription(session.user.id);
                const usageCount = await getMonthlyUsageCount(session.user.id);
                const features = subscription?.plan.features as PlanFeatures | undefined;
                const limit = features?.maxRequestsPerMonth ?? null;

                return NextResponse.json(
                    {
                        error: error.message,
                        code: 'RATE_LIMIT_EXCEEDED',
                        requestId,
                        planName: subscription?.plan.name || 'FREE',
                        usage: {
                            current: usageCount,
                            limit,
                        },
                        resetDate: subscription?.currentPeriodEnd?.toISOString() || null,
                    },
                    {
                        status: 429,
                        headers: {
                            'X-Request-Id': requestId,
                            'Retry-After': '86400', // 24 hours in seconds
                        },
                    }
                );
            }

            // Other subscription errors
            return jsonError({
                message: error.message,
                status: 403,
                code: 'FORBIDDEN_PLAN',
                requestId,
            });
        }

        // 3. Generate or edit image
        let imageUrl: string | undefined;
        const isEditing = !!originalImage;

        // Image editing mode
        if (originalImage) {
            const result = await editImage(prompt, originalImage);

            // Check for safety/policy blocks in edit response
            const safetyResult = checkResponseSafety(result);
            if (safetyResult.isBlocked) {
                const errorCode = blockReasonToErrorCode(safetyResult.reason || 'OTHER');
                const errorMessage = safetyResult.reason === 'SAFETY'
                    ? ERROR_MESSAGES.SAFETY_BLOCKED
                    : safetyResult.reason === 'RECITATION'
                        ? ERROR_MESSAGES.RECITATION_BLOCKED
                        : ERROR_MESSAGES.CONTENT_POLICY_VIOLATION;

                return jsonError({
                    message: errorMessage,
                    status: 400,
                    code: errorCode,
                    requestId,
                });
            }

            // Extract image from edit response (same as alpha)
            if (!result.candidates || result.candidates.length === 0) {
                throw new Error('No candidates found in edit response');
            }
            const candidate = result.candidates[0];
            if (!candidate?.content?.parts) {
                throw new Error('No content parts found in edit response');
            }
            for (const part of candidate.content.parts) {
                const inlineData = part.inlineData;
                if (inlineData?.data && typeof inlineData.data === 'string') {
                    imageUrl = `data:image/png;base64,${inlineData.data}`;
                    break;
                }
            }
            if (!imageUrl) {
                throw new Error('No image found in edit response');
            }
        }
        // Image generation mode
        else {
            // generateImage now returns data URL directly (same as alpha)
            imageUrl = await generateImage(prompt, aspectRatio);
        }

        // 4. Log usage after successful generation
        await logUsage(session.user.id, 'image_generation', {
            isEditing,
            aspectRatio,
            resourceType: 'gemini-3-pro-image', // Unified model for generation and editing
            promptLength: prompt.length,
        });

        return NextResponse.json({ imageUrl });
    } catch (error: any) {
        console.error('Gemini Image API Error', { requestId, error: safeErrorForLog(error) });
        const errorMessage = error.message?.toLowerCase() || '';

        if (error.message?.includes('API_KEY')) {
            return jsonError({
                message: ERROR_MESSAGES.API_KEY_NOT_FOUND,
                status: 401,
                code: 'GEMINI_API_KEY_NOT_FOUND',
                requestId,
            });
        }

        // Check for safety/policy related errors in error message
        if (errorMessage.includes('safety') || errorMessage.includes('policy')) {
            return jsonError({
                message: ERROR_MESSAGES.SAFETY_BLOCKED,
                status: 400,
                code: 'SAFETY_BLOCKED',
                requestId,
            });
        }

        if (errorMessage.includes('copyright') || errorMessage.includes('recitation')) {
            return jsonError({
                message: ERROR_MESSAGES.RECITATION_BLOCKED,
                status: 400,
                code: 'RECITATION_BLOCKED',
                requestId,
            });
        }

        return jsonError({
            message: originalImage
                ? ERROR_MESSAGES.IMAGE_EDIT_NO_IMAGE
                : ERROR_MESSAGES.IMAGE_GENERATION_FAILED,
            status: 500,
            code: 'UPSTREAM_ERROR',
            details: error.message,
            requestId,
        });
    }
}
