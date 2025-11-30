import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    getWaitlistStats,
    getWaitlistEntries,
    notifyNextInWaitlist,
    expireOldNotifications,
} from '@/lib/waitlist';
import {
    adminWaitlistQuerySchema,
    adminWaitlistPostSchema,
} from '@/lib/validators';

/**
 * GET /api/admin/waitlist
 * Get waitlist entries with pagination and filtering
 *
 * Authentication: Required (ADMIN role)
 *
 * Query params:
 * - status: PENDING | NOTIFIED | CONVERTED | EXPIRED | CANCELLED
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 *
 * Response:
 * {
 *   entries: Array<WaitlistEntry>
 *   total: number
 *   stats: WaitlistStats
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Authentication & Authorization
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore - role is added by NextAuth callbacks
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // 2. Parse and validate query parameters
        const { searchParams } = new URL(request.url);
        const queryParams = {
            status: searchParams.get('status') || undefined,
            limit: searchParams.get('limit') || undefined,
            offset: searchParams.get('offset') || undefined,
        };
        const validationResult = adminWaitlistQuerySchema.safeParse(queryParams);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid query parameters', details: validationResult.error.format() },
                { status: 400 }
            );
        }
        const { status, limit, offset } = validationResult.data;
        // Convert null to undefined for getWaitlistEntries
        const statusParam = status ?? undefined;
        const limitParam = limit ?? undefined;
        const offsetParam = offset ?? undefined;

        // 3. Get waitlist data
        const [{ entries, total }, stats] = await Promise.all([
            getWaitlistEntries({ status: statusParam, limit: limitParam, offset: offsetParam }),
            getWaitlistStats(),
        ]);

        return NextResponse.json({
            entries,
            total,
            stats,
        });
    } catch (error: any) {
        console.error('Error in GET /api/admin/waitlist:', error);
        return NextResponse.json(
            { error: 'Failed to get waitlist entries', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/waitlist
 * Admin actions on waitlist
 *
 * Authentication: Required (ADMIN role)
 *
 * Request Body:
 * {
 *   action: 'notify' | 'expire'
 *   count?: number  // For 'notify' action
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authentication & Authorization
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // @ts-ignore - role is added by NextAuth callbacks
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // 2. Parse and validate request body
        const body = await request.json();
        const validationResult = adminWaitlistPostSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: validationResult.error.format() },
                { status: 400 }
            );
        }
        const { action, count } = validationResult.data;
        // Ensure count is not null
        const countValue = count ?? 1;

        let result: number;

        if (action === 'notify') {
            // Notify next users in waitlist
            result = await notifyNextInWaitlist(countValue);
            return NextResponse.json({
                success: true,
                message: `${result} users notified`,
                notifiedCount: result,
            });
        } else if (action === 'expire') {
            // Expire old notifications
            result = await expireOldNotifications();
            return NextResponse.json({
                success: true,
                message: `${result} notifications expired`,
                expiredCount: result,
            });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in POST /api/admin/waitlist:', error);
        return NextResponse.json(
            { error: 'Failed to perform waitlist action', details: error.message },
            { status: 500 }
        );
    }
}
