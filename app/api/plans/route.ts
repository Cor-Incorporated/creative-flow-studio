import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/plans
 * Get all available subscription plans with Stripe Price IDs
 *
 * Public endpoint (no authentication required for viewing plans)
 *
 * Response:
 * Array of plans with id, name, monthlyPrice, stripePriceId
 */

export async function GET() {
    try {
        const plans = await prisma.plan.findMany({
            select: {
                id: true,
                name: true,
                monthlyPrice: true,
                stripePriceId: true,
                features: true,
                maxRequestsPerMonth: true,
            },
            orderBy: {
                monthlyPrice: 'asc',
            },
        });

        return NextResponse.json(plans);
    } catch (error: any) {
        console.error('Error fetching plans:', error);
        return NextResponse.json(
            { error: 'Failed to fetch plans', details: error.message },
            { status: 500 }
        );
    }
}
