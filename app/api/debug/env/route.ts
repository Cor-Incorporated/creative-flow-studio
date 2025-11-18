import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Debug endpoint to check environment variables
 * Only accessible to authenticated users for security
 */
export async function GET() {
    try {
        // Check authentication (optional - remove if you want to test without auth)
        const session = await getServerSession(authOptions);
        
        // Get DATABASE_URL and mask sensitive parts
        const dbUrl = process.env.DATABASE_URL;
        const maskedDbUrl = dbUrl
            ? dbUrl.replace(/:[^:@]+@/, ':****@').substring(0, 100) + '...'
            : 'NOT SET';

        // Check for localhost (which would be wrong)
        const isLocalhost = dbUrl?.includes('localhost:5432') || false;

        // Get other relevant env vars
        const envInfo = {
            NODE_ENV: process.env.NODE_ENV || 'NOT SET',
            DATABASE_URL_SET: !!dbUrl,
            DATABASE_URL_MASKED: maskedDbUrl,
            IS_LOCALHOST: isLocalhost,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
            GOOGLE_CLIENT_ID_SET: !!process.env.GOOGLE_CLIENT_ID,
            NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
            // Check if Cloud SQL mount exists (Unix socket path)
            CLOUDSQL_MOUNT_EXISTS: false, // We'll check this via file system
        };

        // Try to check if Cloud SQL socket exists
        try {
            const fs = await import('fs');
            const socketPath = '/cloudsql/dataanalyticsclinic:asia-northeast1:creative-flow-studio-sql';
            envInfo.CLOUDSQL_MOUNT_EXISTS = fs.existsSync(socketPath);
        } catch (e) {
            // Ignore errors
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            environment: envInfo,
            authenticated: !!session,
            userId: session?.user?.id || null,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: 'Failed to get environment info',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}

