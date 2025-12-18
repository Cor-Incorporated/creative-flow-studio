import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserSubscription, getMonthlyUsageCount, PlanFeatures } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/usage
 * Get current user's usage statistics and plan limits
 *
 * Authentication: Required (NextAuth session)
 *
 * Response:
 * {
 *   plan: { name, features }
 *   usage: { current, limit, percentage, remaining }
 *   isLimitReached: boolean
 *   resetDate: string (ISO date of next billing period)
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // 2. Check if ADMIN (unlimited access)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (user?.role === 'ADMIN') {
            return NextResponse.json({
                plan: {
                    name: 'ADMIN',
                    features: {
                        allowProMode: true,
                        allowImageGeneration: true,
                        allowVideoGeneration: true,
                        maxRequestsPerMonth: null,
                    },
                },
                usage: {
                    current: 0,
                    limit: null,
                    percentage: null,
                    remaining: null,
                },
                isLimitReached: false,
                isAdmin: true,
                resetDate: null,
            });
        }

        // 3. Get subscription and usage
        const subscription = await getUserSubscription(userId);

        if (!subscription) {
            return NextResponse.json(
                { error: 'No subscription found' },
                { status: 404 }
            );
        }

        const features = subscription.plan.features as PlanFeatures;
        const usageCount = await getMonthlyUsageCount(userId);
        const limit = features.maxRequestsPerMonth;

        // Calculate usage stats
        const isLimitReached = limit !== null && usageCount >= limit;
        const percentage = limit !== null ? Math.min(Math.round((usageCount / limit) * 100), 100) : null;
        const remaining = limit !== null ? Math.max(0, limit - usageCount) : null;

        return NextResponse.json({
            plan: {
                name: subscription.plan.name,
                features: {
                    allowProMode: features.allowProMode,
                    allowImageGeneration: features.allowImageGeneration,
                    allowVideoGeneration: features.allowVideoGeneration,
                    maxRequestsPerMonth: limit,
                },
            },
            usage: {
                current: usageCount,
                limit,
                percentage,
                remaining,
            },
            isLimitReached,
            isAdmin: false,
            resetDate: subscription.currentPeriodEnd?.toISOString() || null,
            subscriptionStatus: subscription.status,
        });
    } catch (error: any) {
        console.error('Error in GET /api/usage:', error);
        return NextResponse.json(
            { error: 'Failed to get usage data', details: error.message },
            { status: 500 }
        );
    }
}
