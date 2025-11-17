import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Debug: Log DATABASE_URL (masked) to verify it's being read correctly
// Only log in runtime, not during build
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
        console.log('[Prisma] DATABASE_URL is set:', maskedUrl.substring(0, 80) + '...');
        // Check if it's pointing to localhost (which would be wrong in Cloud Run)
        if (dbUrl.includes('localhost:5432')) {
            console.error('[Prisma] ERROR: DATABASE_URL is pointing to localhost:5432! This is wrong for Cloud Run.');
            console.error('[Prisma] Full DATABASE_URL (masked):', maskedUrl);
        }
    } else {
        console.error('[Prisma] ERROR: DATABASE_URL is not set!');
        console.error('[Prisma] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DB')).join(', '));
    }
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
