/**
 * Stripe Server-Side Client
 *
 * This module provides a singleton Stripe client for server-side operations.
 * ALL Stripe API calls must be made server-side to protect the secret key.
 *
 * References:
 * - Stripe API Documentation: https://docs.stripe.com/api
 * - Next.js Stripe Integration: https://docs.stripe.com/checkout/quickstart?client=next
 * - Stripe Node.js SDK: https://github.com/stripe/stripe-node
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables. ' +
            'Please add it to your .env.local file.'
    );
}

/**
 * Stripe client singleton
 *
 * IMPORTANT: This client MUST only be used in server-side code:
 * - API Routes (app/api/*)
 * - Server Components
 * - Server Actions
 *
 * NEVER import this in client components or expose the secret key.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // @ts-ignore - Using stable API version instead of latest
    // Stripe recommends using a stable version for production
    apiVersion: '2024-11-20.acacia',
    typescript: true,
    appInfo: {
        name: 'Creative Flow Studio',
        version: '1.0.0',
        url: 'https://creative-flow-studio.com',
    },
});

/**
 * Helper: Get Stripe Customer ID for a user
 *
 * If the user doesn't have a Stripe customer ID, creates one.
 * @param userId - User ID from database
 * @param email - User email
 * @param name - User name (optional)
 * @returns Stripe Customer ID
 *
 * Note: Subscription records are created by the webhook handler
 * (checkout.session.completed event), not here.
 */
export async function getOrCreateStripeCustomer(
    userId: string,
    email: string,
    name?: string | null
): Promise<string> {
    const { prisma } = await import('./prisma');

    // Check if user already has a Stripe customer ID
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { stripeCustomerId: true },
    });

    if (subscription?.stripeCustomerId) {
        return subscription.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
        email,
        name: name || undefined,
        metadata: {
            userId,
        },
    });

    // NOTE: We don't create a Subscription record here.
    // Subscriptions are created by the webhook handler when
    // checkout.session.completed event is received.
    // This ensures proper synchronization with Stripe's subscription lifecycle.

    return customer.id;
}

/**
 * Helper: Format price for display
 * @param amountInCents - Amount in cents
 * @param currency - Currency code (default: 'jpy')
 * @returns Formatted price string (e.g., '¥1,000')
 */
export function formatPrice(amountInCents: number, currency: string = 'jpy'): string {
    const amount = amountInCents / 100;

    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * Helper: Get plan details by Stripe Price ID
 * @param stripePriceId - Stripe Price ID
 * @returns Plan object or null
 */
export async function getPlanByStripePriceId(stripePriceId: string) {
    const { prisma } = await import('./prisma');

    return await prisma.plan.findUnique({
        where: { stripePriceId },
    });
}

/**
 * Helper: Get Plan ID from Stripe Subscription
 *
 * Retrieves the Stripe subscription and extracts the Plan ID
 * based on the price ID in the subscription items.
 *
 * @param stripeSubscriptionId - Stripe Subscription ID
 * @returns Plan ID from database
 * @throws Error if plan not found
 */
export async function getPlanIdFromStripeSubscription(
    stripeSubscriptionId: string
): Promise<string> {
    const { prisma } = await import('./prisma');

    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    if (!subscription.items.data || subscription.items.data.length === 0) {
        throw new Error(`No items found in subscription ${stripeSubscriptionId}`);
    }

    // Get the first item's price ID
    const priceId = subscription.items.data[0].price.id;

    // Find the plan in database
    const plan = await prisma.plan.findUnique({
        where: { stripePriceId: priceId },
        select: { id: true },
    });

    if (!plan) {
        throw new Error(`Plan not found for Stripe Price ID: ${priceId}`);
    }

    return plan.id;
}

/**
 * Helper: Check if Stripe event has already been processed
 *
 * Implements idempotency by checking if the stripeEventId already exists
 * in the PaymentEvent table.
 *
 * @param stripeEventId - Stripe Event ID
 * @returns True if event has already been processed
 */
export async function isEventProcessed(stripeEventId: string): Promise<boolean> {
    const { prisma } = await import('./prisma');

    const existingEvent = await prisma.paymentEvent.findUnique({
        where: { stripeEventId },
        select: { id: true },
    });

    return !!existingEvent;
}
