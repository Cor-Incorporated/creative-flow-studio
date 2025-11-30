import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    generateChatResponse,
    generateProResponse,
    generateSearchGroundedResponse,
    analyzeImage,
} from '@/lib/gemini';
import { checkSubscriptionLimits, logUsage, getUserSubscription, getMonthlyUsageCount, PlanFeatures } from '@/lib/subscription';
import { ERROR_MESSAGES } from '@/lib/constants';
import type { GenerationMode, Media } from '@/types/app';

/**
 * POST /api/gemini/chat
 * Generate chat/pro/search responses using Gemini API
 *
 * Authentication: Required (NextAuth session)
 * Authorization: Subscription limits enforced based on plan
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
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // 2. Subscription limits check
        try {
            // Determine action based on mode
            let action: 'chat' | 'pro_mode' | 'chat' = 'chat';
            if (mode === 'pro') {
                action = 'pro_mode';
            }

            await checkSubscriptionLimits(session.user.id, action);
        } catch (error: any) {
            // Feature not allowed in plan (e.g., Pro mode in FREE plan)
            if (error.message.includes('not available in current plan')) {
                return NextResponse.json({ error: error.message }, { status: 403 });
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

        // 3. Generate response
        let result;
        let resourceType = '';

        // Handle image upload (multimodal input)
        if (media && media.type === 'image') {
            result = await analyzeImage(prompt, media.url, media.mimeType, systemInstruction);
            resourceType = 'gemini-2.5-flash-multimodal';
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
                    resourceType = 'gemini-2.5-flash';
                    break;
                case 'pro':
                    result = await generateProResponse(prompt, systemInstruction, temperature);
                    resourceType = 'gemini-2.5-pro';
                    break;
                case 'search':
                    result = await generateSearchGroundedResponse(
                        prompt,
                        systemInstruction,
                        temperature
                    );
                    resourceType = 'gemini-2.5-flash-grounded';
                    break;
                default:
                    return NextResponse.json(
                        { error: `Unsupported mode: ${mode}` },
                        { status: 400 }
                    );
            }
        }

        // 4. Log usage after successful generation
        await logUsage(session.user.id, mode === 'pro' ? 'pro_mode' : 'chat', {
            mode,
            resourceType,
            promptLength: prompt.length,
            hasMedia: !!media,
        });

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Gemini Chat API Error:', error);

        // Handle specific error cases
        if (error.message?.includes('API_KEY')) {
            return NextResponse.json({ error: ERROR_MESSAGES.API_KEY_NOT_FOUND }, { status: 401 });
        }

        return NextResponse.json(
            { error: ERROR_MESSAGES.GENERIC_ERROR, details: error.message },
            { status: 500 }
        );
    }
}
