import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function normalizeDatabaseUrl(dbUrl: string): { normalized: string; changed: boolean } {
    // Fix a common misconfiguration for Cloud SQL unix socket URLs:
    // `?host=/cloudsql/<INSTANCE_CONNECTION_NAME>:5432`
    // The socket path must NOT include a port suffix.
    try {
        const url = new URL(dbUrl);
        const hostParam = url.searchParams.get('host');
        if (hostParam && hostParam.startsWith('/cloudsql/') && hostParam.endsWith(':5432')) {
            url.searchParams.set('host', hostParam.replace(/:5432$/, ''));
            return { normalized: url.toString(), changed: true };
        }
    } catch {
        // Ignore parse errors and fall through
    }
    return { normalized: dbUrl, changed: false };
}

// Debug: Log DATABASE_URL (masked) to verify it's being read correctly
// Log in runtime (both development and production)
if (typeof window === 'undefined') {
    const rawDbUrl = process.env.DATABASE_URL;
    const dbUrl = rawDbUrl ? normalizeDatabaseUrl(rawDbUrl).normalized : rawDbUrl;
    if (rawDbUrl && dbUrl !== rawDbUrl) {
        process.env.DATABASE_URL = dbUrl;
        console.warn('[Prisma] Normalized DATABASE_URL host for Cloud SQL unix socket (removed :5432 suffix).');
    }
    console.log('[Prisma] Initializing Prisma Client...');
    console.log('[Prisma] NODE_ENV:', process.env.NODE_ENV);
    if (dbUrl) {
        const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
        console.log('[Prisma] DATABASE_URL is set:', maskedUrl.substring(0, 100) + '...');
        // Check if it's pointing to localhost (which would be wrong in Cloud Run)
        if (dbUrl.includes('localhost:5432')) {
            console.error('[Prisma] ERROR: DATABASE_URL is pointing to localhost:5432! This is wrong for Cloud Run.');
            console.error('[Prisma] Full DATABASE_URL (masked):', maskedUrl);
        }
    } else {
        console.error('[Prisma] ERROR: DATABASE_URL is not set!');
        console.error('[Prisma] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DB')).join(', '));
        console.error('[Prisma] All env vars starting with DATABASE:', Object.keys(process.env).filter(k => k.toUpperCase().includes('DATABASE')).join(', '));
    }
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
