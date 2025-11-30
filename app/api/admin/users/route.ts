import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminUsersQuerySchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * List all users with subscription and usage statistics
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ADMIN role required (Defense in Depth)
 *
 * Query Parameters:
 * - limit (optional, max 100, default: 20): Number of users to return
 * - offset (optional, default: 0): Pagination offset
 * - search (optional): Search by email or name
 * - role (optional): Filter by role (USER | PRO | ENTERPRISE | ADMIN)
 * - plan (optional): Filter by plan name (FREE | PRO | ENTERPRISE)
 * - status (optional): Filter by subscription status
 *
 * Response:
 * {
 *   users: Array<{
 *     id: string
 *     email: string
 *     name: string | null
 *     role: Role
 *     createdAt: string
 *     subscription: {
 *       planName: string
 *       status: SubscriptionStatus
 *       currentPeriodEnd: string | null
 *     } | null
 *     usageStats: {
 *       totalRequests: number
 *       currentMonthRequests: number
 *     }
 *     lastActiveAt: string | null
 *   }>
 *   total: number
 *   limit: number
 *   offset: number
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

        // 3. Parse and validate query parameters
        const { searchParams } = request.nextUrl;
        const queryParams = {
            limit: searchParams.get('limit'),
            offset: searchParams.get('offset'),
            search: searchParams.get('search'),
            role: searchParams.get('role'),
            plan: searchParams.get('plan'),
            status: searchParams.get('status'),
        };

        const validatedParams = adminUsersQuerySchema.parse(queryParams);

        // 4. Build Prisma query with filters
        const where: any = {};

        // Search filter (email or name)
        if (validatedParams.search) {
            where.OR = [
                { email: { contains: validatedParams.search, mode: 'insensitive' } },
                { name: { contains: validatedParams.search, mode: 'insensitive' } },
            ];
        }

        // Role filter
        if (validatedParams.role) {
            where.role = validatedParams.role;
        }

        // Plan filter (via subscription)
        if (validatedParams.plan) {
            where.subscription = {
                plan: {
                    name: validatedParams.plan,
                },
            };
        }

        // Status filter (via subscription)
        if (validatedParams.status) {
            where.subscription = {
                ...where.subscription,
                status: validatedParams.status,
            };
        }

        // 5. Get current month start for usage stats
        const currentMonthStart = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
        );

        // 6. Fetch users with related data
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true,
                    subscription: {
                        select: {
                            plan: {
                                select: {
                                    name: true,
                                },
                            },
                            status: true,
                            currentPeriodEnd: true,
                        },
                    },
                    _count: {
                        select: {
                            usageLogs: true,
                        },
                    },
                    usageLogs: {
                        where: {
                            createdAt: {
                                gte: currentMonthStart,
                            },
                        },
                        select: {
                            id: true,
                            createdAt: true,
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        take: 1,
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: validatedParams.limit ?? 20,
                skip: validatedParams.offset ?? 0,
            }),
            prisma.user.count({ where }),
        ]);

        // 7. Get current month usage counts for all users in a single query
        const userIds = users.map(user => user.id);
        const currentMonthUsageMap = new Map<string, number>();

        if (userIds.length > 0) {
            const currentMonthUsageCounts = await prisma.usageLog.groupBy({
                by: ['userId'],
                where: {
                    userId: {
                        in: userIds,
                    },
                    createdAt: {
                        gte: currentMonthStart,
                    },
                },
                _count: {
                    _all: true,
                },
            });

            currentMonthUsageCounts.forEach(item => {
                currentMonthUsageMap.set(item.userId, item._count._all);
            });
        }

        // 8. Format response
        const formattedUsers = users.map(user => {
            const userWithRelations = user as any;
            const currentMonthRequests = currentMonthUsageMap.get(user.id) ?? 0;
            return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                createdAt: user.createdAt.toISOString(),
                subscription: userWithRelations.subscription
                    ? {
                          planName: userWithRelations.subscription.plan.name,
                          status: userWithRelations.subscription.status,
                          currentPeriodEnd:
                              userWithRelations.subscription.currentPeriodEnd?.toISOString() ||
                              null,
                      }
                    : null,
                usageStats: {
                    totalRequests: userWithRelations._count.usageLogs,
                    currentMonthRequests,
                },
                lastActiveAt: userWithRelations.usageLogs[0]?.createdAt.toISOString() || null,
            };
        });

        // 9. Log to AuditLog
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'admin.users.list',
                resource: 'User',
                metadata: {
                    filters: validatedParams,
                    resultsCount: users.length,
                },
                ipAddress: request.headers.get('x-forwarded-for'),
                userAgent: request.headers.get('user-agent'),
            },
        });

        // 10. Return response
        return NextResponse.json({
            users: formattedUsers,
            total,
            limit: validatedParams.limit ?? 20,
            offset: validatedParams.offset ?? 0,
        });
    } catch (error: any) {
        console.error('Error in GET /api/admin/users:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
            return NextResponse.json(
                {
                    error: 'Invalid query parameters',
                    details: error.errors,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to fetch users',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
