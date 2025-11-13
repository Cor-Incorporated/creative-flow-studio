import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscription';

/**
 * POST /api/stripe/portal
 * Create a Stripe Customer Portal session
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User must have an active subscription
 *
 * Request Body:
 * {
 *   returnUrl?: string  // Optional return URL (defaults to /dashboard)
 * }
 *
 * Response:
 * {
 *   url: string  // Redirect URL to Stripe Customer Portal
 * }
 *
 * Features (via Customer Portal):
 * - Update payment method
 * - View billing history
 * - Change subscription plan
 * - Cancel subscription
 *
 * References:
 * - Stripe Customer Portal: https://docs.stripe.com/billing/subscriptions/integrating-customer-portal
 * - docs/stripe-integration-plan.md Phase 3.2
 */

export async function POST(request: NextRequest) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get user's subscription
        const subscription = await getUserSubscription(session.user.id);

        if (!subscription?.stripeCustomerId) {
            return NextResponse.json(
                { error: 'No Stripe customer found' },
                { status: 404 }
            );
        }

        // 3. Parse request body
        const body = await request.json().catch(() => ({}));
        const returnUrl =
            body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;

        // 4. Create Customer Portal session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: returnUrl,
        });

        // 5. Return portal URL
        return NextResponse.json({
            url: portalSession.url,
        });
    } catch (error: any) {
        console.error('Error in POST /api/stripe/portal:', error);

        // Handle Stripe-specific errors
        if (error.type === 'StripeInvalidRequestError') {
            return NextResponse.json(
                {
                    error: 'Invalid Stripe request',
                    details: error.message,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to create portal session',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
