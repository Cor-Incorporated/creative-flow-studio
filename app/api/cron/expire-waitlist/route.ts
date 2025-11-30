import { expireOldNotifications } from '@/lib/waitlist';
import { NextRequest, NextResponse } from 'next/server';

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
        const isVercelCron = !!request.headers.get('x-vercel-cron');
        const cronSecret = process.env.CRON_SECRET;
        const providedSecret = request.headers.get('x-cron-secret');
        const isProduction = process.env.NODE_ENV === 'production';

        // In production, require authentication
        if (isProduction) {
            // Allow either Vercel's internal header OR valid secret
            if (!isVercelCron && (!cronSecret || providedSecret !== cronSecret)) {
                console.error('Unauthorized cron request - invalid or missing secret');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        } else {
            // In development, allow without secret for testing, but warn if secret is not configured
            if (!isVercelCron && cronSecret && providedSecret !== cronSecret) {
                console.error('Unauthorized cron request - invalid secret');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            // If CRON_SECRET is not set in dev, allow but warn
            if (!isVercelCron && !cronSecret) {
                console.warn('CRON_SECRET not configured in development - allowing request for testing. Set CRON_SECRET for production-like testing.');
            }
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
