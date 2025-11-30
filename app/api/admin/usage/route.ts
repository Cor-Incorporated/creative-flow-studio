import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminUsageQuerySchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/usage
 * Retrieve usage logs with filtering and pagination
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ADMIN role required (Defense in Depth)
 *
 * Query Parameters:
 * - limit (optional, max 100, default: 50): Number of logs to return
 * - offset (optional, default: 0): Pagination offset
 * - userId (optional): Filter by user ID
 * - action (optional): Filter by action type (chat, image_generation, etc.)
 * - resourceType (optional): Filter by resource (gemini-2.5-flash, imagen-4.0, etc.)
 * - startDate (optional, ISO string): Filter logs after this date
 * - endDate (optional, ISO string): Filter logs before this date
 *
 * Response:
 * {
 *   logs: Array<{
 *     id: string
 *     userId: string
 *     userEmail: string
 *     action: string
 *     resourceType: string | null
 *     metadata: Json | null
 *     createdAt: string
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
            userId: searchParams.get('userId'),
            action: searchParams.get('action'),
            resourceType: searchParams.get('resourceType'),
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        };

        const validatedParams = adminUsageQuerySchema.parse(queryParams);

        // 4. Build Prisma query with filters
        const where: any = {};

        // User filter
        if (validatedParams.userId) {
            where.userId = validatedParams.userId;
        }

        // Action filter
        if (validatedParams.action) {
            where.action = validatedParams.action;
        }

        // Resource type filter
        if (validatedParams.resourceType) {
            where.resourceType = validatedParams.resourceType;
        }

        // Date range filter
        if (validatedParams.startDate || validatedParams.endDate) {
            where.createdAt = {};
            if (validatedParams.startDate) {
                where.createdAt.gte = new Date(validatedParams.startDate);
            }
            if (validatedParams.endDate) {
                where.createdAt.lte = new Date(validatedParams.endDate);
            }
        }

        // 5. Fetch usage logs with user email
        const [logs, total] = await Promise.all([
            prisma.usageLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: validatedParams.limit ?? 50,
                skip: validatedParams.offset ?? 0,
            }),
            prisma.usageLog.count({ where }),
        ]);

        // 6. Format response
        const formattedLogs = logs.map(log => ({
            id: log.id,
            userId: log.userId,
            userEmail: (log as any).user.email,
            action: log.action,
            resourceType: log.resourceType,
            metadata: log.metadata,
            createdAt: log.createdAt.toISOString(),
        }));

        // 7. Log to AuditLog
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'admin.usage.list',
                resource: 'UsageLog',
                metadata: {
                    filters: validatedParams,
                    resultsCount: logs.length,
                },
                ipAddress: request.headers.get('x-forwarded-for'),
                userAgent: request.headers.get('user-agent'),
            },
        });

        // 8. Return response
        return NextResponse.json({
            logs: formattedLogs,
            total,
            limit: validatedParams.limit ?? 50,
            offset: validatedParams.offset ?? 0,
        });
    } catch (error: any) {
        console.error('Error in GET /api/admin/usage:', error);

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
                error: 'Failed to fetch usage logs',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
