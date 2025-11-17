import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Debug: Log DATABASE_URL (masked) to verify it's being read correctly
if (process.env.DATABASE_URL) {
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
    console.log('[Prisma] DATABASE_URL is set:', maskedUrl.substring(0, 50) + '...');
} else {
    console.error('[Prisma] ERROR: DATABASE_URL is not set!');
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
