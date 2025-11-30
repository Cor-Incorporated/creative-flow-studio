import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { canUpgradeToPaidPlan, getWaitlistStats } from '@/lib/waitlist';
import { ERROR_MESSAGES } from '@/lib/constants';
import { z } from 'zod';

/**
 * POST /api/stripe/checkout
 * Create a Stripe Checkout Session for subscription purchase
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User must be logged in
 *
 * Request Body:
 * {
 *   priceId: string        // Stripe Price ID (e.g., 'price_...')
 *   successUrl?: string    // Optional custom success URL
 *   cancelUrl?: string     // Optional custom cancel URL
 * }
 *
 * Response:
 * {
 *   sessionId: string
 *   url: string            // Redirect URL to Stripe Checkout
 * }
 *
 * References:
 * - Stripe Checkout Session: https://docs.stripe.com/api/checkout/sessions/create
 * - Next.js Stripe Integration: https://docs.stripe.com/checkout/quickstart?client=next
 * - docs/stripe-integration-plan.md Phase 1.1
 */

const checkoutRequestSchema = z.object({
    priceId: z.string().startsWith('price_', 'Invalid Stripe Price ID'),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse and validate request body
        const body = await request.json();
        const validationResult = checkoutRequestSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: 'Invalid request body',
                    details: validationResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { priceId, successUrl, cancelUrl } = validationResult.data;

        // 3. Check if user can upgrade to paid plan (capacity check)
        const canUpgrade = await canUpgradeToPaidPlan(session.user.id);
        if (!canUpgrade) {
            const stats = await getWaitlistStats();
            return NextResponse.json(
                {
                    error: ERROR_MESSAGES.CAPACITY_REACHED,
                    capacityReached: true,
                    waitlistCount: stats.waitlistCount,
                    maxPaidUsers: stats.maxPaidUsers,
                },
                { status: 403 }
            );
        }

        // 4. Get base URL for redirect
        const requestOrigin = request.headers.get('origin');
        const appUrl = (requestOrigin && requestOrigin.startsWith('http')
            ? requestOrigin
            : process.env.NEXT_PUBLIC_APP_URL || 'https://blunaai.com'
        ).replace(/\/$/, '');

        // 5. Get or create Stripe customer
        const stripeCustomerId = await getOrCreateStripeCustomer(
            session.user.id,
            session.user.email,
            session.user.name
        );

        // 6. Create Checkout Session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl || `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${appUrl}/pricing`,
            metadata: {
                userId: session.user.id,
            },
            // Allow promotional codes
            allow_promotion_codes: true,
            // Collect billing address
            billing_address_collection: 'auto',
            // Automatically assign customer to subscription
            customer_update: {
                address: 'auto',
                name: 'auto',
            },
        });

        // 7. Return session URL
        return NextResponse.json({
            sessionId: checkoutSession.id,
            url: checkoutSession.url,
        });
    } catch (error: any) {
        console.error('Error in POST /api/stripe/checkout:', error);

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
                error: 'Failed to create checkout session',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
