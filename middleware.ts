import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { shouldRedirectToCanonicalHost } from '@/lib/canonicalHost';

/**
 * Middleware for Role-Based Access Control (RBAC)
 *
 * Protects /admin routes by requiring ADMIN role.
 * Runs before routes are rendered.
 *
 * References:
 * - Next.js Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
 * - NextAuth JWT: https://next-auth.js.org/configuration/nextjs#getToken
 * - docs/implementation-plan.md Phase 6
 */

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Canonical host redirect (prevents OAuth state cookie mismatch & 308 self-loop in proxy env)
    // Set CANONICAL_HOST=blunaai.com in Cloud Run for custom domain.
    const canonicalCheck = shouldRedirectToCanonicalHost({
        headers: request.headers,
        canonicalHost: process.env.CANONICAL_HOST,
    });
    if (canonicalCheck.shouldRedirect && canonicalCheck.canonicalHost) {
        const url = request.nextUrl.clone();
        url.hostname = canonicalCheck.canonicalHost;
        url.port = '';
        return NextResponse.redirect(url, 308);
    }

    // Admin route protection
    if (pathname.startsWith('/admin')) {
        try {
            // Check if NEXTAUTH_SECRET is configured
            if (!process.env.NEXTAUTH_SECRET) {
                console.error('NEXTAUTH_SECRET is not configured');
                return new NextResponse(
                    JSON.stringify({
                        error: 'Configuration Error',
                        message: 'Authentication is not properly configured',
                    }),
                    {
                        status: 500,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }

            const token = await getToken({
                req: request,
                secret: process.env.NEXTAUTH_SECRET,
            });

            // No session - redirect to login
            if (!token) {
                const loginUrl = new URL('/api/auth/signin', request.url);
                loginUrl.searchParams.set('callbackUrl', pathname);
                return NextResponse.redirect(loginUrl);
            }

            // Not an admin - return 403 Forbidden
            if (token.role !== 'ADMIN') {
                return new NextResponse(
                    JSON.stringify({
                        error: 'Forbidden',
                        message: 'You do not have permission to access this resource',
                    }),
                    {
                        status: 403,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
            }

            // Admin user - allow access
            return NextResponse.next();
        } catch (error: any) {
            console.error('Error in admin middleware:', error);
            return new NextResponse(
                JSON.stringify({
                    error: 'Internal Server Error',
                    message: 'An error occurred while checking authentication',
                }),
                {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    }

    // All other routes - continue
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
