/**
 * Subscription Management Utilities
 *
 * Server-side helper functions for subscription and plan management.
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 3-4
 * - Stripe Subscriptions: https://docs.stripe.com/billing/subscriptions
 */

import type { Plan, Subscription } from '@prisma/client';
import { prisma } from './prisma';

export type SubscriptionWithPlan = Subscription & {
    plan: Plan;
};

type SubscriptionDbClient = Pick<typeof prisma, 'subscription' | 'plan'>;

export type PlanFeatures = {
    allowProMode: boolean;
    allowImageGeneration: boolean;
    allowVideoGeneration: boolean;
    maxRequestsPerMonth: number | null;
    maxFileSize: number;
};

function getFallbackAdminPlan(): Plan {
    const now = new Date(0);
    const features: PlanFeatures = {
        allowProMode: true,
        allowImageGeneration: true,
        allowVideoGeneration: true,
        maxRequestsPerMonth: null,
        // Effectively unlimited; keep within Postgres int range.
        maxFileSize: 2_147_483_647,
    };

    return {
        id: 'admin-enterprise-fallback',
        name: 'ENTERPRISE',
        stripePriceId: null,
        monthlyPrice: 0,
        features,
        maxRequestsPerMonth: null,
        maxFileSize: features.maxFileSize,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Get user's active subscription with plan details
 *
 * @param userId - User ID
 * @returns Subscription with plan or null if not found
 */
export async function getUserSubscription(
    userId: string
): Promise<SubscriptionWithPlan | null> {
    return await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    });
}

/**
 * Check if user has an active subscription
 *
 * @param userId - User ID
 * @returns True if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { status: true },
    });

    return subscription?.status === 'ACTIVE';
}

/**
 * Get monthly usage count for user
 *
 * @param userId - User ID
 * @returns Number of API calls this month
 */
export async function getMonthlyUsageCount(userId: string): Promise<number> {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    return await prisma.usageLog.count({
        where: {
            userId,
            createdAt: { gte: currentMonth },
        },
    });
}

/**
 * Check subscription limits for a specific action
 * ADMIN users bypass all limits and have access to all features
 *
 * @param userId - User ID
 * @param action - Action type (e.g., 'image_generation', 'video_generation', 'chat')
 * @returns Object with allowed status, plan details, and usage count
 * @throws Error if subscription is invalid or limits exceeded (unless user is ADMIN)
 */
export async function checkSubscriptionLimits(
    userId: string,
    action: 'image_generation' | 'video_generation' | 'chat'
): Promise<{
    allowed: boolean;
    plan: Plan;
    usageCount: number;
    limit: number | null;
}> {
    // Check if user is ADMIN - admins bypass all limits
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (user?.role === 'ADMIN') {
        // Admin users have unlimited access to all features
        // Return a dummy plan with all features enabled
        const adminPlan = await prisma.plan.findFirst({
            where: { name: 'ENTERPRISE' },
        });

        return {
            allowed: true,
            plan: adminPlan || getFallbackAdminPlan(),
            usageCount: 0,
            limit: null, // Unlimited for admins
        };
    }

    const subscription = await getUserSubscription(userId);

    if (!subscription) {
        throw new Error('No subscription found');
    }

    if (subscription.status !== 'ACTIVE') {
        throw new Error(`Subscription is ${subscription.status.toLowerCase()}`);
    }

    const plan = subscription.plan;
    const features = plan.features as PlanFeatures;

    // Check action-specific permissions
    switch (action) {
        case 'image_generation':
            if (!features.allowImageGeneration) {
                throw new Error('Image generation not available in current plan');
            }
            break;
        case 'video_generation':
            if (!features.allowVideoGeneration) {
                throw new Error('Video generation not available in current plan');
            }
            break;
        case 'chat':
            // Chat is available in all plans
            break;
    }

    // Check monthly usage limits
    const usageCount = await getMonthlyUsageCount(userId);
    const limit = features.maxRequestsPerMonth;

    if (limit !== null && usageCount >= limit) {
        throw new Error('Monthly request limit exceeded');
    }

    return {
        allowed: true,
        plan,
        usageCount,
        limit,
    };
}

/**
 * Log API usage for a user
 *
 * @param userId - User ID
 * @param action - Action type
 * @param metadata - Optional metadata (resourceType will be extracted if present)
 */
export async function logUsage(
    userId: string,
    action: string,
    metadata?: Record<string, any>
): Promise<void> {
    // Extract resourceType from metadata if present
    const resourceType = metadata?.resourceType as string | undefined;
    const cleanMetadata = metadata ? { ...metadata } : {};
    if (cleanMetadata.resourceType) {
        delete cleanMetadata.resourceType;
    }

    await prisma.usageLog.create({
        data: {
            userId,
            action,
            resourceType,
            metadata: cleanMetadata,
        },
    });
}

/**
 * Format billing period for display
 *
 * @param start - Period start date
 * @param end - Period end date
 * @returns Formatted string (e.g., "2025-01-01 〜 2025-01-31")
 */
export function formatBillingPeriod(start: Date | null, end: Date | null): string {
    if (!start || !end) {
        return '未設定';
    }

    const formatter = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    return `${formatter.format(start)} 〜 ${formatter.format(end)}`;
}

/**
 * Get days until next billing date
 *
 * @param currentPeriodEnd - Current period end date
 * @returns Number of days until next billing
 */
export function getDaysUntilBilling(currentPeriodEnd: Date | null): number {
    if (!currentPeriodEnd) {
        return 0;
    }

    const now = new Date();
    const end = new Date(currentPeriodEnd);
    const diff = end.getTime() - now.getTime();

    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate usage percentage
 *
 * @param current - Current usage count
 * @param limit - Maximum limit (null = unlimited)
 * @returns Percentage (0-100) or null if unlimited
 */
export function calculateUsagePercentage(
    current: number,
    limit: number | null
): number | null {
    if (limit === null) {
        return null; // Unlimited
    }

    if (limit === 0) {
        return 100;
    }

    return Math.min(Math.round((current / limit) * 100), 100);
}

/**
 * Create default FREE plan subscription for a new user
 *
 * This function is called automatically when a new user registers.
 * It ensures every user has a subscription, even if they haven't purchased a plan yet.
 *
 * @param userId - User ID
 * @returns Created subscription
 * @throws Error if FREE plan not found or subscription already exists
 */
export async function createDefaultFreeSubscription(
    userId: string
): Promise<SubscriptionWithPlan> {
    return await createDefaultFreeSubscriptionWithClient(userId, prisma);
}

export async function createDefaultFreeSubscriptionWithClient(
    userId: string,
    db: SubscriptionDbClient
): Promise<SubscriptionWithPlan> {
    // Fast-path: if subscription already exists, return it (no FREE plan query needed).
    const existing = await db.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    });
    if (existing) return existing as SubscriptionWithPlan;

    // Find FREE plan by name (needed only for the create path).
    const freePlan = await db.plan.findUnique({
        where: { name: 'FREE' },
    });
    if (!freePlan) {
        throw new Error('FREE plan not found in database. Please run database migrations.');
    }

    // Set billing period (30 days from now)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Create-if-absent, safely (prevents race condition / unique violations on subscriptions.userId).
    // If another request created the subscription after our fast-path check, upsert returns the existing row.
    return (await db.subscription.upsert({
        where: { userId },
        update: {},
        create: {
            userId,
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
        },
        include: { plan: true },
    })) as SubscriptionWithPlan;
}
