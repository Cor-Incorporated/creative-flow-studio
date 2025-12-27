import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    generateChatResponse,
    generateSearchGroundedResponse,
    analyzeImage,
    analyzeVideo,
    analyzeMultipleImages,
} from '@/lib/gemini';
import { checkSubscriptionLimits, logUsage, getUserSubscription, getMonthlyUsageCount, PlanFeatures } from '@/lib/subscription';
import { ERROR_MESSAGES } from '@/lib/constants';
import type { GenerationMode, Media } from '@/types/app';
import { createRequestId, jsonError } from '@/lib/api-utils';
import { checkResponseSafety, blockReasonToErrorCode } from '@/lib/gemini-safety';
import { safeErrorForLog } from '@/lib/utils';

/**
 * POST /api/gemini/chat
 * Generate chat/search responses using Gemini API
 *
 * Authentication: Required (NextAuth session)
 * Authorization: Subscription limits enforced based on plan
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 4.2
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
        const {
            prompt,
            history = [],
            mode = 'chat',
            systemInstruction,
            temperature,
            media,
            mediaList,
        }: {
            prompt: string;
            history?: any[];
            mode?: GenerationMode;
            systemInstruction?: string;
            temperature?: number;
            media?: Media;
            mediaList?: Media[];
        } = body;

        if (!prompt) {
            return jsonError({
                message: 'Prompt is required',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // Validate mediaList: max 8 images, images only
        if (mediaList && mediaList.length > 0) {
            if (mediaList.length > 8) {
                return jsonError({
                    message: '画像は最大8枚までです',
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    requestId,
                });
            }
            // Ensure all items are images
            const nonImages = mediaList.filter((m) => m.type !== 'image');
            if (nonImages.length > 0) {
                return jsonError({
                    message: '複数メディア分析は画像のみ対応しています',
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    requestId,
                });
            }
        }

        // 2. Subscription limits check
        try {
            await checkSubscriptionLimits(session.user.id, 'chat');
        } catch (error: any) {
            // Feature not allowed in plan (e.g., Pro mode in FREE plan)
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

        // 3. Generate response
        let result;
        let resourceType = '';

        // Handle multiple images (mediaList takes priority over single media)
        if (mediaList && mediaList.length > 0) {
            result = await analyzeMultipleImages(prompt, mediaList, systemInstruction);
            resourceType = 'gemini-3-flash-multimodal';
        }
        // Handle single image upload (multimodal input)
        else if (media && media.type === 'image') {
            result = await analyzeImage(prompt, media.url, media.mimeType, systemInstruction);
            resourceType = 'gemini-3-flash-multimodal';
        }
        // Handle video upload (multimodal input)
        else if (media && media.type === 'video') {
            result = await analyzeVideo(prompt, media.url, media.mimeType, systemInstruction);
            resourceType = 'gemini-3-flash-video';
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
                    resourceType = 'gemini-3-flash';
                    break;
                case 'search':
                    result = await generateSearchGroundedResponse(
                        history,
                        prompt,
                        systemInstruction,
                        temperature
                    );
                    resourceType = 'gemini-3-flash-grounded';
                    break;
                default:
                    return NextResponse.json(
                        { error: `Unsupported mode: ${mode}` },
                        { status: 400 }
                    );
            }
        }

        // 3.5. Check for safety/policy blocks in response
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

        // 4. Log usage after successful generation
        await logUsage(session.user.id, 'chat', {
            mode,
            resourceType,
            promptLength: prompt.length,
            hasMedia: !!media || (mediaList && mediaList.length > 0),
            mediaCount: mediaList?.length || (media ? 1 : 0),
        });

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Gemini Chat API Error', { requestId, error: safeErrorForLog(error) });

        // Handle specific error cases
        if (error.message?.includes('API_KEY')) {
            return jsonError({
                message: ERROR_MESSAGES.API_KEY_NOT_FOUND,
                status: 401,
                code: 'GEMINI_API_KEY_NOT_FOUND',
                requestId,
            });
        }

        return jsonError({
            message: ERROR_MESSAGES.GENERIC_ERROR,
            status: 500,
            code: 'UPSTREAM_ERROR',
            details: error.message,
            requestId,
        });
    }
}
