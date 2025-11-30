/**
 * Waitlist Management Utilities
 *
 * Handles user capacity limits and waitlist functionality.
 * When MAX_PAID_USERS is reached, new users are added to waitlist.
 *
 * References:
 * - MAX_PAID_USERS: 2000 (configurable in constants.ts)
 */

import { prisma } from './prisma';
import { MAX_PAID_USERS, WAITLIST_NOTIFICATION_EXPIRY_DAYS } from './constants';

export type WaitlistStats = {
    paidUsersCount: number;
    maxPaidUsers: number;
    availableSlots: number;
    waitlistCount: number;
    isCapacityReached: boolean;
};

/**
 * Get count of paid users (excluding ADMIN and FREE plan users)
 */
export async function getPaidUsersCount(): Promise<number> {
    // Count subscriptions that are:
    // 1. ACTIVE status
    // 2. NOT on FREE plan
    // 3. User is NOT ADMIN
    const count = await prisma.subscription.count({
        where: {
            status: 'ACTIVE',
            plan: {
                name: {
                    not: 'FREE',
                },
            },
            user: {
                role: {
                    not: 'ADMIN',
                },
            },
        },
    });

    return count;
}

/**
 * Check if paid user capacity has been reached
 */
export async function isCapacityReached(): Promise<boolean> {
    const paidUsersCount = await getPaidUsersCount();
    return paidUsersCount >= MAX_PAID_USERS;
}

/**
 * Check if a user can upgrade to a paid plan
 * Returns true if:
 * 1. Capacity not reached, OR
 * 2. User is already a paid subscriber (upgrading/downgrading), OR
 * 3. User has ADMIN role
 */
export async function canUpgradeToPaidPlan(userId: string): Promise<boolean> {
    // Check if user is ADMIN
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (user?.role === 'ADMIN') {
        return true;
    }

    // Check if user already has a paid subscription
    const existingSubscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    });

    if (existingSubscription && existingSubscription.plan.name !== 'FREE') {
        // Already a paid user - allow plan changes
        return true;
    }

    // Check capacity
    return !(await isCapacityReached());
}

/**
 * Get waitlist statistics
 */
export async function getWaitlistStats(): Promise<WaitlistStats> {
    const [paidUsersCount, waitlistCount] = await Promise.all([
        getPaidUsersCount(),
        prisma.waitlist.count({
            where: { status: 'PENDING' },
        }),
    ]);

    const availableSlots = Math.max(0, MAX_PAID_USERS - paidUsersCount);
    const isCapacityReached = paidUsersCount >= MAX_PAID_USERS;

    return {
        paidUsersCount,
        maxPaidUsers: MAX_PAID_USERS,
        availableSlots,
        waitlistCount,
        isCapacityReached,
    };
}

/**
 * Add user to waitlist
 */
export async function addToWaitlist(
    email: string,
    name?: string
): Promise<{ success: boolean; position?: number; error?: string }> {
    // Check if already on waitlist
    const existing = await prisma.waitlist.findUnique({
        where: { email },
    });

    if (existing) {
        if (existing.status === 'PENDING' || existing.status === 'NOTIFIED') {
            return { success: false, error: 'ALREADY_ON_WAITLIST' };
        }

        // If previously cancelled/expired, allow re-registration
        await prisma.waitlist.update({
            where: { email },
            data: {
                status: 'PENDING',
                name,
                notifiedAt: null,
            },
        });
    } else {
        await prisma.waitlist.create({
            data: {
                email,
                name,
                status: 'PENDING',
            },
        });
    }

    // Calculate position
    const position = await prisma.waitlist.count({
        where: {
            status: 'PENDING',
            createdAt: {
                lte: new Date(),
            },
        },
    });

    return { success: true, position };
}

/**
 * Get waitlist position for an email
 */
export async function getWaitlistPosition(email: string): Promise<number | null> {
    const entry = await prisma.waitlist.findUnique({
        where: { email },
    });

    if (!entry || entry.status !== 'PENDING') {
        return null;
    }

    const position = await prisma.waitlist.count({
        where: {
            status: 'PENDING',
            createdAt: {
                lte: entry.createdAt,
            },
        },
    });

    return position;
}

/**
 * Mark waitlist entry as converted (user upgraded to paid plan)
 */
export async function markWaitlistConverted(email: string): Promise<void> {
    await prisma.waitlist.updateMany({
        where: {
            email,
            status: { in: ['PENDING', 'NOTIFIED'] },
        },
        data: {
            status: 'CONVERTED',
        },
    });
}

/**
 * Cancel waitlist registration
 */
export async function cancelWaitlistRegistration(email: string): Promise<boolean> {
    const result = await prisma.waitlist.updateMany({
        where: {
            email,
            status: 'PENDING',
        },
        data: {
            status: 'CANCELLED',
        },
    });

    return result.count > 0;
}

/**
 * Get waitlist entries for admin
 * Optimized to avoid N+1 queries by fetching all PENDING entries once
 * and calculating positions in-memory
 */
export async function getWaitlistEntries(options: {
    status?: 'PENDING' | 'NOTIFIED' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
    limit?: number;
    offset?: number;
}): Promise<{
    entries: Array<{
        id: string;
        email: string;
        name: string | null;
        status: string;
        position: number | null;
        notifiedAt: Date | null;
        createdAt: Date;
    }>;
    total: number;
}> {
    const { status, limit = 50, offset = 0 } = options;

    const where = status ? { status } : {};

    // Only fetch all PENDING entries if we need to calculate positions
    const needsPositionCalculation = !status || status === 'PENDING';

    const [entries, total, allPendingEntries] = await Promise.all([
        prisma.waitlist.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: limit,
            skip: offset,
        }),
        prisma.waitlist.count({ where }),
        // Get all PENDING entries once to calculate positions in-memory (only if needed)
        needsPositionCalculation
            ? prisma.waitlist.findMany({
                  where: { status: 'PENDING' },
                  select: { id: true, createdAt: true },
                  orderBy: { createdAt: 'asc' },
              })
            : Promise.resolve([]),
    ]);

    // Calculate positions in-memory for PENDING entries
    const entriesWithPosition = entries.map((entry) => {
        let position: number | null = null;
        if (entry.status === 'PENDING' && allPendingEntries.length > 0) {
            // Find position in the sorted array of all pending entries
            const index = allPendingEntries.findIndex((e) => e.id === entry.id);
            position = index >= 0 ? index + 1 : null;
        }
        return {
            id: entry.id,
            email: entry.email,
            name: entry.name,
            status: entry.status,
            position,
            notifiedAt: entry.notifiedAt,
            createdAt: entry.createdAt,
        };
    });

    return { entries: entriesWithPosition, total };
}

/**
 * Notify next users in waitlist when spots become available
 * This would typically be called by a cron job or webhook
 */
export async function notifyNextInWaitlist(spotsAvailable: number): Promise<number> {
    const pendingEntries = await prisma.waitlist.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: spotsAvailable,
    });

    if (pendingEntries.length === 0) {
        return 0;
    }

    // Update status to NOTIFIED
    await prisma.waitlist.updateMany({
        where: {
            id: { in: pendingEntries.map((e: { id: string }) => e.id) },
        },
        data: {
            status: 'NOTIFIED',
            notifiedAt: new Date(),
        },
    });

    // TODO: Implement email notifications
    // Integration required with email service (Resend, SendGrid, or AWS SES)
    //
    // Suggested implementation:
    // 1. Add email service client (e.g., npm install resend)
    // 2. Create email template for waitlist notification
    // 3. Send emails with retry logic and delivery tracking
    // 4. Consider using a job queue for bulk notifications
    //
    // Example with Resend:
    // ```
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // for (const entry of pendingEntries) {
    //   await resend.emails.send({
    //     from: 'noreply@creative-flow.studio',
    //     to: entry.email,
    //     subject: 'Your spot is ready!',
    //     html: `<p>You can now upgrade to a paid plan...</p>`
    //   });
    // }
    // ```
    console.log(`Notified ${pendingEntries.length} users from waitlist (email integration pending)`);

    return pendingEntries.length;
}

/**
 * Expire old notifications that weren't acted upon
 */
export async function expireOldNotifications(): Promise<number> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - WAITLIST_NOTIFICATION_EXPIRY_DAYS);

    const result = await prisma.waitlist.updateMany({
        where: {
            status: 'NOTIFIED',
            notifiedAt: { lt: expiryDate },
        },
        data: {
            status: 'EXPIRED',
        },
    });

    return result.count;
}
