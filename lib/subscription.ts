/**
 * Subscription Management Utilities
 *
 * Server-side helper functions for subscription and plan management.
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 3-4
 * - Stripe Subscriptions: https://docs.stripe.com/billing/subscriptions
 */

import { prisma } from './prisma';
import type { Subscription, Plan } from '@prisma/client';

export type SubscriptionWithPlan = Subscription & {
    plan: Plan;
};

export type PlanFeatures = {
    allowProMode: boolean;
    allowImageGeneration: boolean;
    allowVideoGeneration: boolean;
    maxRequestsPerMonth: number | null;
    maxFileSize: number;
};

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
 *
 * @param userId - User ID
 * @param action - Action type (e.g., 'image_generation', 'video_generation', 'pro_mode')
 * @returns Object with allowed status, plan details, and usage count
 * @throws Error if subscription is invalid or limits exceeded
 */
export async function checkSubscriptionLimits(
    userId: string,
    action: 'image_generation' | 'video_generation' | 'pro_mode' | 'chat'
): Promise<{
    allowed: boolean;
    plan: Plan;
    usageCount: number;
    limit: number | null;
}> {
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
        case 'pro_mode':
            if (!features.allowProMode) {
                throw new Error('Pro mode not available in current plan');
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
 * @param metadata - Optional metadata
 */
export async function logUsage(
    userId: string,
    action: string,
    metadata?: Record<string, any>
): Promise<void> {
    await prisma.usageLog.create({
        data: {
            userId,
            action,
            metadata: metadata || {},
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
