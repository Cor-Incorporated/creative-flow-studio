import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/stats
 * Get detailed system statistics
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ADMIN role required (Defense in Depth)
 *
 * Response:
 * {
 *   users: {
 *     total: number
 *     byRole: Record<Role, number>
 *     newThisMonth: number
 *   }
 *   subscriptions: {
 *     active: number
 *     byPlan: Record<string, number>
 *     byStatus: Record<SubscriptionStatus, number>
 *   }
 *   usage: {
 *     totalRequests: number
 *     requestsThisMonth: number
 *     byAction: Record<string, number>
 *   }
 *   conversations: {
 *     total: number
 *     totalMessages: number
 *     averageMessagesPerConversation: number
 *   }
 * }
 *
 * References:
 * - docs/admin-api-design.md (Phase 6 Step 2)
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Authorization: Verify ADMIN role (Defense in Depth)
        const adminUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (adminUser?.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: Admin access required' },
                { status: 403 }
            );
        }

        // 3. Get current month start for filtering
        const currentMonthStart = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
        );

        // 4. Run parallel Prisma queries for statistics
        const [
            totalUsers,
            usersByRole,
            newUsersThisMonth,
            activeSubscriptions,
            subscriptionsByPlan,
            subscriptionsByStatus,
            totalUsageLogs,
            usageLogsThisMonth,
            usageLogsByAction,
            totalConversations,
            totalMessages,
        ] = await Promise.all([
            // User statistics
            prisma.user.count(),
            prisma.user.groupBy({
                by: ['role'],
                _count: true,
            }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: currentMonthStart,
                    },
                },
            }),

            // Subscription statistics
            prisma.subscription.count({
                where: {
                    status: 'ACTIVE',
                },
            }),
            prisma.subscription.groupBy({
                by: ['planId'],
                _count: true,
                where: {
                    status: 'ACTIVE',
                },
            }),
            prisma.subscription.groupBy({
                by: ['status'],
                _count: true,
            }),

            // Usage statistics
            prisma.usageLog.count(),
            prisma.usageLog.count({
                where: {
                    createdAt: {
                        gte: currentMonthStart,
                    },
                },
            }),
            prisma.usageLog.groupBy({
                by: ['action'],
                _count: true,
                orderBy: {
                    _count: {
                        action: 'desc',
                    },
                },
                take: 10, // Top 10 actions
            }),

            // Conversation statistics
            prisma.conversation.count(),
            prisma.message.count(),
        ]);

        // 5. Get plan names for subscription statistics
        const planIds = subscriptionsByPlan.map(sub => sub.planId);
        const plans = await prisma.plan.findMany({
            where: {
                id: {
                    in: planIds,
                },
            },
            select: {
                id: true,
                name: true,
            },
        });

        const planIdToName = Object.fromEntries(plans.map(plan => [plan.id, plan.name]));

        // 6. Format statistics
        const stats = {
            users: {
                total: totalUsers,
                byRole: Object.fromEntries(
                    usersByRole.map(group => [group.role, group._count])
                ),
                newThisMonth: newUsersThisMonth,
            },
            subscriptions: {
                active: activeSubscriptions,
                byPlan: Object.fromEntries(
                    subscriptionsByPlan.map(group => [
                        planIdToName[group.planId] || group.planId,
                        group._count,
                    ])
                ),
                byStatus: Object.fromEntries(
                    subscriptionsByStatus.map(group => [group.status, group._count])
                ),
            },
            usage: {
                totalRequests: totalUsageLogs,
                requestsThisMonth: usageLogsThisMonth,
                byAction: Object.fromEntries(
                    usageLogsByAction.map(group => [group.action, group._count])
                ),
            },
            conversations: {
                total: totalConversations,
                totalMessages,
                averageMessagesPerConversation:
                    totalConversations > 0
                        ? Math.round((totalMessages / totalConversations) * 100) / 100
                        : 0,
            },
        };

        // 7. Log to AuditLog
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'admin.stats.view',
                resource: 'SystemStats',
                metadata: {
                    statsRetrieved: Object.keys(stats),
                },
                ipAddress: request.headers.get('x-forwarded-for'),
                userAgent: request.headers.get('user-agent'),
            },
        });

        // 8. Return response
        return NextResponse.json(stats);
    } catch (error: any) {
        console.error('Error in GET /api/admin/stats:', error);

        return NextResponse.json(
            {
                error: 'Failed to fetch statistics',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
