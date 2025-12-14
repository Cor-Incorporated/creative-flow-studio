/**
 * Migration Script: Create FREE plan subscriptions for existing users
 *
 * This script creates default FREE plan subscriptions for all users
 * who don't have a subscription yet.
 *
 * Usage:
 *   npx tsx scripts/create-missing-subscriptions.ts
 *
 * Or with environment variables:
 *   DATABASE_URL="..." npx tsx scripts/create-missing-subscriptions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration: Create missing subscriptions...');

    // Find FREE plan
    const freePlan = await prisma.plan.findUnique({
        where: { name: 'FREE' },
    });

    if (!freePlan) {
        throw new Error('FREE plan not found. Please run database migrations first.');
    }

    console.log(`Found FREE plan: ${freePlan.id}`);

    // Find all users without subscriptions
    const usersWithoutSubscriptions = await prisma.user.findMany({
        where: {
            subscription: null,
        },
        select: {
            id: true,
            email: true,
            name: true,
        },
    });

    console.log(`Found ${usersWithoutSubscriptions.length} users without subscriptions`);

    if (usersWithoutSubscriptions.length === 0) {
        console.log('No users need subscriptions. Migration complete.');
        return;
    }

    // Create subscriptions for each user
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    let created = 0;
    let errors = 0;

    for (const user of usersWithoutSubscriptions) {
        try {
            await prisma.subscription.create({
                data: {
                    userId: user.id,
                    planId: freePlan.id,
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                },
            });
            created++;
            console.log(`✓ Created subscription for user: ${user.email} (${user.id})`);
        } catch (error: any) {
            errors++;
            console.error(`✗ Failed to create subscription for user: ${user.email} (${user.id})`, error.message);
        }
    }

    console.log('\nMigration complete!');
    console.log(`  Created: ${created}`);
    console.log(`  Errors: ${errors}`);
}

main()
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });




