import { authOptions } from '@/lib/auth';
import { ERROR_MESSAGES, VALID_VIDEO_ASPECT_RATIOS } from '@/lib/constants';
import { generateVideo } from '@/lib/gemini';
import { checkSubscriptionLimits, getMonthlyUsageCount, getUserSubscription, logUsage, PlanFeatures } from '@/lib/subscription';
import type { AspectRatio } from '@/types/app';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

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
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // 2. Subscription limits check
        try {
            await checkSubscriptionLimits(session.user.id, 'video_generation');
        } catch (error: any) {
            // Feature not allowed in plan (Only ENTERPRISE has video generation)
            if (error.message.includes('not available in current plan')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 403 }
                );
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
                            'Retry-After': '86400', // 24 hours in seconds
                        },
                    }
                );
            }

            // Other subscription errors
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        // 3. Generate video
        const operation = await generateVideo(prompt, aspectRatio);

        // Validate operation object
        if (!operation || !operation.name) {
            throw new Error('Operation object not found in video generation response');
        }

        // 4. Log usage after successful generation
        await logUsage(session.user.id, 'video_generation', {
            aspectRatio,
            resourceType: 'veo-3.1-fast-generate-preview',
            promptLength: prompt.length,
        });

        // Return operation object (same as alpha implementation)
        // Frontend will use operation.name for polling
        return NextResponse.json({ operation });
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
