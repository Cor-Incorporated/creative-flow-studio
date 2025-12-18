import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    addToWaitlist,
    getWaitlistStats,
    getWaitlistPosition,
    cancelWaitlistRegistration,
} from '@/lib/waitlist';
import { ERROR_MESSAGES } from '@/lib/constants';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/waitlist
 * Get waitlist status and statistics
 *
 * Query params:
 * - email (optional): Get position for specific email
 *
 * Response:
 * {
 *   stats: { paidUsersCount, maxPaidUsers, availableSlots, waitlistCount, isCapacityReached }
 *   position?: number  // If email provided
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        const stats = await getWaitlistStats();

        let position: number | null = null;
        if (email) {
            position = await getWaitlistPosition(email);
        }

        return NextResponse.json({
            stats,
            position,
        });
    } catch (error: any) {
        console.error('Error in GET /api/waitlist:', error);
        return NextResponse.json(
            { error: 'Failed to get waitlist status', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/waitlist
 * Register for waitlist
 *
 * Request Body:
 * {
 *   email: string
 *   name?: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   position?: number
 *   message?: string
 * }
 */
const waitlistRequestSchema = z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    name: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validationResult = waitlistRequestSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: 'Invalid request body',
                    details: validationResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { email, name } = validationResult.data;

        // Check if capacity is actually reached
        const stats = await getWaitlistStats();
        if (!stats.isCapacityReached) {
            return NextResponse.json(
                {
                    error: '現在ウェイトリストは必要ありません。直接プランをお申し込みいただけます。',
                    availableSlots: stats.availableSlots,
                },
                { status: 400 }
            );
        }

        const result = await addToWaitlist(email, name);

        if (!result.success) {
            if (result.error === 'ALREADY_ON_WAITLIST') {
                const position = await getWaitlistPosition(email);
                return NextResponse.json(
                    {
                        error: ERROR_MESSAGES.ALREADY_ON_WAITLIST,
                        position,
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            position: result.position,
            message: ERROR_MESSAGES.WAITLIST_REGISTRATION_SUCCESS,
        });
    } catch (error: any) {
        console.error('Error in POST /api/waitlist:', error);
        return NextResponse.json(
            { error: 'Failed to register for waitlist', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/waitlist
 * Cancel waitlist registration
 *
 * Query params:
 * - email: Email to cancel
 *
 * Response:
 * {
 *   success: boolean
 * }
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Only allow users to cancel their own registration or admins to cancel any
        if (session?.user?.email !== email && session?.user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const success = await cancelWaitlistRegistration(email);

        if (!success) {
            return NextResponse.json(
                { error: 'No active waitlist registration found for this email' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DELETE /api/waitlist:', error);
        return NextResponse.json(
            { error: 'Failed to cancel waitlist registration', details: error.message },
            { status: 500 }
        );
    }
}
