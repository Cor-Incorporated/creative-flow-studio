import { NextRequest, NextResponse } from 'next/server';
import { expireOldNotifications } from '@/lib/waitlist';

/**
 * GET /api/cron/expire-waitlist
 * Expire old waitlist notifications that weren't acted upon
 *
 * This endpoint should be called by a cron job (e.g., Vercel Cron, GCP Cloud Scheduler)
 * Recommended: Run daily at midnight UTC
 *
 * Authentication: Cron secret verification
 *
 * Vercel Cron setup (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/expire-waitlist",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 *
 * GCP Cloud Scheduler setup:
 * - Target: HTTP
 * - URL: https://your-app.com/api/cron/expire-waitlist
 * - HTTP method: GET
 * - Headers: { "x-cron-secret": "your-secret" }
 * - Schedule: 0 0 * * *
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret to prevent unauthorized access
        const cronSecret = process.env.CRON_SECRET;
        const providedSecret = request.headers.get('x-cron-secret');
        const vercelCron = request.headers.get('x-vercel-cron');

        // In production, require authentication
        if (process.env.NODE_ENV === 'production') {
            // If CRON_SECRET is not configured, only allow Vercel Cron
            if (!cronSecret && !vercelCron) {
                console.error('CRON_SECRET not configured and not a Vercel cron request');
                return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
            }
        }

        // Require either valid secret or Vercel's internal header
        if (!vercelCron && (!cronSecret || providedSecret !== cronSecret)) {
            console.error('Unauthorized cron request - invalid or missing secret');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Expire old notifications
        const expiredCount = await expireOldNotifications();

        console.log(`Cron: Expired ${expiredCount} waitlist notifications`);

        return NextResponse.json({
            success: true,
            expiredCount,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Error in cron/expire-waitlist:', error);
        return NextResponse.json(
            {
                error: 'Failed to expire waitlist notifications',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
