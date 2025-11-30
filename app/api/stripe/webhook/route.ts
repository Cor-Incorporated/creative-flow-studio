import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, getPlanIdFromStripeSubscription, isEventProcessed } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { MAX_PAID_USERS } from '@/lib/constants';
import { addToWaitlist } from '@/lib/waitlist';
import Stripe from 'stripe';

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events for subscription lifecycle
 *
 * Authentication: Stripe signature verification (NOT NextAuth)
 * Authorization: Webhook signing secret verification
 *
 * Implemented Events:
 * - checkout.session.completed - Create subscription after successful checkout
 * - invoice.paid - Update subscription status and period
 * - invoice.payment_failed - Mark subscription as past due
 * - customer.subscription.updated - Update subscription details
 * - customer.subscription.deleted - Mark subscription as canceled
 *
 * References:
 * - Stripe Webhooks: https://docs.stripe.com/webhooks
 * - Webhook Signature Verification: https://docs.stripe.com/webhooks/signatures
 * - Subscription Lifecycle: https://docs.stripe.com/billing/subscriptions/webhooks
 * - docs/stripe-integration-plan.md Phase 2
 *
 * IMPORTANT:
 * - This endpoint receives raw body (not JSON parsed)
 * - Signature verification requires raw request body
 * - NextAuth is NOT used (Stripe signature verification only)
 * - Implements idempotency via stripeEventId uniqueness
 */

export async function POST(request: NextRequest) {
    try {
        // 1. Get raw body for signature verification
        const body = await request.text();

        // 2. Get Stripe signature from headers
        const headersList = await headers();
        const signature = headersList.get('stripe-signature');

        if (!signature) {
            console.error('Missing stripe-signature header');
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
        }

        // 3. Verify webhook signature
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('STRIPE_WEBHOOK_SECRET is not configured');
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err: any) {
            console.error('Webhook signature verification failed:', err.message);
            return NextResponse.json(
                {
                    error: 'Webhook signature verification failed',
                    details: err.message,
                },
                { status: 400 }
            );
        }

        // 4. Handle different event types
        console.log(`Received Stripe webhook: ${event.type} (ID: ${event.id})`);

        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event);
                break;

            case 'invoice.paid':
                await handleInvoicePaid(event);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // 5. Return 200 to acknowledge receipt
        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Error in POST /api/stripe/webhook:', error);
        return NextResponse.json(
            {
                error: 'Webhook processing failed',
                details: error.message,
            },
            { status: 500 }
        );
    }
}

/**
 * Handle checkout.session.completed event
 *
 * This event fires when a customer successfully completes a Checkout Session.
 * We create or update the Subscription record in our database.
 *
 * References:
 * - Event: https://docs.stripe.com/api/events/types#event_types-checkout.session.completed
 * - docs/stripe-integration-plan.md Section 2.2
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    // Check idempotency
    if (await isEventProcessed(event.id)) {
        console.log(`Event ${event.id} already processed, skipping`);
        return;
    }

    const { metadata, customer, subscription } = session;
    const userId = metadata?.userId;

    if (!userId) {
        console.error('checkout.session.completed: Missing userId in metadata');
        return;
    }

    if (!customer || !subscription) {
        console.error('checkout.session.completed: Missing customer or subscription');
        return;
    }

    const stripeCustomerId = typeof customer === 'string' ? customer : customer.id;
    const stripeSubscriptionId = typeof subscription === 'string' ? subscription : subscription.id;

    try {
        // Get plan ID from Stripe subscription
        const planId = await getPlanIdFromStripeSubscription(stripeSubscriptionId);

        // Get the plan to check if it's a paid plan
        const plan = await prisma.plan.findUnique({
            where: { id: planId },
            select: { name: true },
        });

        const isPaidPlan = plan && plan.name !== 'FREE';

        // Use transaction to prevent race condition when capacity is limited
        await prisma.$transaction(async (tx) => {
            // Check if user already has a subscription (plan change, not new signup)
            const existingSubscription = await tx.subscription.findUnique({
                where: { userId },
                include: { plan: true },
            });

            const isExistingPaidUser = existingSubscription && existingSubscription.plan.name !== 'FREE';

            // Only check capacity for NEW paid users (not existing paid users changing plans)
            if (isPaidPlan && !isExistingPaidUser) {
                // Count current paid users within transaction
                const paidUsersCount = await tx.subscription.count({
                    where: {
                        status: 'ACTIVE',
                        plan: { name: { not: 'FREE' } },
                        user: { role: { not: 'ADMIN' } },
                    },
                });

                if (paidUsersCount >= MAX_PAID_USERS) {
                    // Capacity reached - this shouldn't happen if checkout check worked
                    // but this is a safety net for race conditions
                    console.error(`Capacity exceeded during checkout completion for user ${userId}`);
                    throw new Error('CAPACITY_EXCEEDED');
                }
            }

            // Create or update subscription within transaction
            await tx.subscription.upsert({
                where: { userId },
                update: {
                    stripeCustomerId,
                    stripeSubscriptionId,
                    status: 'ACTIVE',
                    planId,
                },
                create: {
                    userId,
                    planId,
                    stripeCustomerId,
                    stripeSubscriptionId,
                    status: 'ACTIVE',
                },
            });
        });

        // Record payment event
        await prisma.paymentEvent.create({
            data: {
                subscription: {
                    connect: { stripeSubscriptionId },
                },
                stripeEventId: event.id,
                type: 'checkout.session.completed',
                amount: session.amount_total || 0,
                status: 'succeeded',
                metadata: {
                    sessionId: session.id,
                    customerId: stripeCustomerId,
                },
            },
        });

        console.log(`Subscription created/updated for user ${userId}`);
    } catch (error: any) {
        console.error('Error handling checkout.session.completed:', error);

        // Handle capacity exceeded error specially
        if (error.message === 'CAPACITY_EXCEEDED') {
            // Get user email for waitlist
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, name: true },
            });

            if (user?.email) {
                // Add user to waitlist
                await addToWaitlist(user.email, user.name || undefined);
                console.log(`User ${userId} added to waitlist due to capacity limit`);
            }

            // Record failed checkout in AuditLog (PaymentEvent requires subscription)
            try {
                await prisma.auditLog.create({
                    data: {
                        userId,
                        action: 'checkout.capacity_exceeded',
                        resource: 'subscription',
                        metadata: {
                            stripeEventId: event.id,
                            sessionId: session.id,
                            customerId: stripeCustomerId,
                            amount: session.amount_total || 0,
                            error: 'CAPACITY_EXCEEDED',
                        },
                    },
                });
            } catch (recordError) {
                console.error('Failed to record capacity exceeded event:', recordError);
            }

            // TODO: Trigger refund via Stripe API
            // const paymentIntent = session.payment_intent;
            // if (paymentIntent) {
            //     await stripe.refunds.create({ payment_intent: paymentIntent as string });
            // }

            // Return 200 to Stripe to prevent retries (the payment is handled, just capacity issue)
            // The error will be logged but won't cause webhook retries
            return;
        }

        throw error;
    }
}

/**
 * Handle invoice.paid event
 *
 * This event fires when an invoice payment succeeds.
 * We update the subscription status and billing period.
 *
 * References:
 * - Event: https://docs.stripe.com/api/events/types#event_types-invoice.paid
 * - docs/stripe-integration-plan.md Section 2.2
 */
async function handleInvoicePaid(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    // Check idempotency
    if (await isEventProcessed(event.id)) {
        console.log(`Event ${event.id} already processed, skipping`);
        return;
    }

    const subscriptionId = (invoice as any).subscription;

    if (!subscriptionId) {
        console.log('invoice.paid: Not a subscription invoice, skipping');
        return;
    }

    const stripeSubscriptionId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id;

    try {
        // Update subscription
        await prisma.subscription.update({
            where: { stripeSubscriptionId },
            data: {
                status: 'ACTIVE',
                currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
                currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
            },
        });

        // Record payment event
        await prisma.paymentEvent.create({
            data: {
                subscription: {
                    connect: { stripeSubscriptionId },
                },
                stripeEventId: event.id,
                type: 'invoice.paid',
                amount: invoice.amount_paid || 0,
                status: 'paid',
                metadata: {
                    invoiceId: invoice.id,
                    billingReason: invoice.billing_reason,
                },
            },
        });

        console.log(`Invoice paid for subscription ${stripeSubscriptionId}`);
    } catch (error: any) {
        console.error('Error handling invoice.paid:', error);
        throw error;
    }
}

/**
 * Handle invoice.payment_failed event
 *
 * This event fires when an invoice payment fails.
 * We update the subscription status to PAST_DUE.
 *
 * References:
 * - Event: https://docs.stripe.com/api/events/types#event_types-invoice.payment_failed
 * - docs/stripe-integration-plan.md Phase 2
 */
async function handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;

    // Check idempotency
    if (await isEventProcessed(event.id)) {
        console.log(`Event ${event.id} already processed, skipping`);
        return;
    }

    const subscriptionId = (invoice as any).subscription;

    if (!subscriptionId) {
        console.log('invoice.payment_failed: Not a subscription invoice, skipping');
        return;
    }

    const stripeSubscriptionId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id;

    try {
        // Update subscription status to PAST_DUE
        await prisma.subscription.update({
            where: { stripeSubscriptionId },
            data: {
                status: 'PAST_DUE',
            },
        });

        // Record payment event
        await prisma.paymentEvent.create({
            data: {
                subscription: {
                    connect: { stripeSubscriptionId },
                },
                stripeEventId: event.id,
                type: 'invoice.payment_failed',
                amount: invoice.amount_due || 0,
                status: 'failed',
                metadata: {
                    invoiceId: invoice.id,
                    attemptCount: invoice.attempt_count,
                    nextPaymentAttempt: invoice.next_payment_attempt,
                },
            },
        });

        console.log(`Payment failed for subscription ${stripeSubscriptionId}`);
    } catch (error: any) {
        console.error('Error handling invoice.payment_failed:', error);
        throw error;
    }
}

/**
 * Handle customer.subscription.updated event
 *
 * This event fires when a subscription is updated (e.g., plan change, cancellation scheduled).
 * We sync the subscription status with Stripe.
 *
 * References:
 * - Event: https://docs.stripe.com/api/events/types#event_types-customer.subscription.updated
 * - docs/stripe-integration-plan.md Phase 2
 */
async function handleSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;

    // Check idempotency (for subscription updates, we use a different approach)
    // Since subscriptions can update multiple times, we don't skip based on event ID
    // but we still log it
    console.log(`Processing subscription.updated: ${subscription.id}`);

    try {
        // Map Stripe status to our SubscriptionStatus enum
        let status: 'ACTIVE' | 'INACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' = 'INACTIVE';

        switch (subscription.status) {
            case 'active':
                status = 'ACTIVE';
                break;
            case 'trialing':
                status = 'TRIALING';
                break;
            case 'past_due':
                status = 'PAST_DUE';
                break;
            case 'canceled':
                status = 'CANCELED';
                break;
            case 'unpaid':
                status = 'UNPAID';
                break;
            default:
                status = 'INACTIVE';
        }

        // Update subscription
        const subscriptionData = subscription as any;
        await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
                status,
                currentPeriodStart: subscriptionData.current_period_start
                    ? new Date(subscriptionData.current_period_start * 1000)
                    : undefined,
                currentPeriodEnd: subscriptionData.current_period_end
                    ? new Date(subscriptionData.current_period_end * 1000)
                    : undefined,
                cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
            },
        });

        console.log(`Subscription updated: ${subscription.id} (status: ${status})`);
    } catch (error: any) {
        // If subscription doesn't exist in our DB yet, it might be created by checkout.session.completed later
        if (error.code === 'P2025') {
            console.log(`Subscription ${subscription.id} not found in database, skipping update`);
            return;
        }

        console.error('Error handling customer.subscription.updated:', error);
        throw error;
    }
}

/**
 * Handle customer.subscription.deleted event
 *
 * This event fires when a subscription is canceled and deleted.
 * We update the subscription status to CANCELED.
 *
 * References:
 * - Event: https://docs.stripe.com/api/events/types#event_types-customer.subscription.deleted
 * - docs/stripe-integration-plan.md Phase 2
 */
async function handleSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;

    // Check idempotency
    if (await isEventProcessed(event.id)) {
        console.log(`Event ${event.id} already processed, skipping`);
        return;
    }

    try {
        // Update subscription status to CANCELED
        await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
                status: 'CANCELED',
                cancelAtPeriodEnd: false,
            },
        });

        // Record cancellation event
        await prisma.paymentEvent.create({
            data: {
                subscription: {
                    connect: { stripeSubscriptionId: subscription.id },
                },
                stripeEventId: event.id,
                type: 'customer.subscription.deleted',
                status: 'canceled',
                metadata: {
                    subscriptionId: subscription.id,
                    canceledAt: subscription.canceled_at,
                },
            },
        });

        console.log(`Subscription deleted: ${subscription.id}`);
    } catch (error: any) {
        console.error('Error handling customer.subscription.deleted:', error);
        throw error;
    }
}
