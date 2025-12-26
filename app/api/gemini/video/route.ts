import { authOptions } from '@/lib/auth';
import { ERROR_MESSAGES, VALID_VIDEO_ASPECT_RATIOS } from '@/lib/constants';
import { generateVideo } from '@/lib/gemini';
import { checkSubscriptionLimits, getMonthlyUsageCount, getUserSubscription, logUsage, PlanFeatures } from '@/lib/subscription';
import type { AspectRatio, Media } from '@/types/app';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createRequestId, jsonError } from '@/lib/api-utils';

/**
 * POST /api/gemini/video
 * Generate videos using Gemini Veo API
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ENTERPRISE plan required
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
            aspectRatio = '16:9',
            media,
            referenceImages,
        }: {
            prompt: string;
            aspectRatio?: AspectRatio;
            media?: Media; // Single image (backward compatibility)
            referenceImages?: Media[]; // Multiple images (new)
        } = body;

        if (!prompt) {
            return jsonError({
                message: 'Prompt is required',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // Validate aspect ratio
        if (!VALID_VIDEO_ASPECT_RATIOS.includes(aspectRatio as any)) {
            return jsonError({
                message: `Invalid aspect ratio: ${aspectRatio}`,
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // Normalize images: prefer referenceImages, fall back to media for backward compatibility
        const images: Media[] = referenceImages ?? (media ? [media] : []);

        // Validate reference images count (max 8)
        if (images.length > 8) {
            return jsonError({
                message: `Too many reference images: ${images.length}. Maximum is 8.`,
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // 2. Subscription limits check
        try {
            await checkSubscriptionLimits(session.user.id, 'video_generation');
        } catch (error: any) {
            // Feature not allowed in plan (Only ENTERPRISE has video generation)
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

        // 3. Generate video (with optional reference images)
        const operation = await generateVideo(prompt, aspectRatio, images.length > 0 ? images : undefined);

        // Validate operation object
        const operationName = operation?.name;
        if (!operationName) {
            throw new Error('Operation object not found in video generation response');
        }

        // 4. Log usage after successful generation
        await logUsage(session.user.id, 'video_generation', {
            aspectRatio,
            resourceType: 'veo-3.1-fast-generate-preview',
            promptLength: prompt.length,
        });

        // Return operation object + name for polling
        return NextResponse.json({ operationName, operation });
    } catch (error: any) {
        console.error('Gemini Video API Error:', error);
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
            message: ERROR_MESSAGES.VIDEO_GENERATION_FAILED,
            status: 500,
            code: 'UPSTREAM_ERROR',
            details: error.message,
            requestId,
        });
    }
}
