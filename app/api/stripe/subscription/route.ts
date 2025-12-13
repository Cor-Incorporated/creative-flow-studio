import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserSubscription, getMonthlyUsageCount } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/subscription
 * Get current user's subscription details
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only access their own subscription
 *
 * Response:
 * {
 *   subscription: {
 *     id: string
 *     status: string
 *     planId: string
 *     stripeCustomerId: string | null
 *     stripeSubscriptionId: string | null
 *     currentPeriodStart: string | null
 *     currentPeriodEnd: string | null
 *     cancelAtPeriodEnd: boolean
 *     plan: {
 *       id: string
 *       name: string
 *       monthlyPrice: number
 *       features: object
 *       maxRequestsPerMonth: number | null
 *       maxFileSize: number | null
 *     }
 *   }
 *   usageCount: number
 * }
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 3.1
 */

export async function GET(request: NextRequest) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get subscription with plan details
        const subscription = await getUserSubscription(session.user.id);

        if (!subscription) {
            return NextResponse.json(
                { error: 'No subscription found' },
                { status: 404 }
            );
        }

        // 3. Get monthly usage count
        const usageCount = await getMonthlyUsageCount(session.user.id);

        // 4. Return subscription data
        return NextResponse.json({
            subscription: {
                id: subscription.id,
                status: subscription.status,
                planId: subscription.planId,
                stripeCustomerId: subscription.stripeCustomerId,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
                currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                plan: {
                    id: subscription.plan.id,
                    name: subscription.plan.name,
                    monthlyPrice: subscription.plan.monthlyPrice,
                    features: subscription.plan.features,
                    maxRequestsPerMonth: subscription.plan.maxRequestsPerMonth,
                    maxFileSize: subscription.plan.maxFileSize,
                },
            },
            usageCount,
        });
    } catch (error: any) {
        console.error('Error in GET /api/stripe/subscription:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch subscription',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
