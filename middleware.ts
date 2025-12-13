import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getEffectiveHostname } from '@/lib/canonicalHost';

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
    // ------------------------------------------------------------
    // Canonical host redirect (prevents NextAuth state-cookie mismatch)
    //
    // Symptom: OAuthCallbackError "State cookie was missing."
    // Root cause: user starts OAuth flow on the Cloud Run default domain (*.run.app),
    // but Google redirects back to NEXTAUTH_URL (custom domain). The OAuth state cookie
    // is scoped to the origin where sign-in started, so the callback cannot find it.
    //
    // Fix: Always redirect traffic to the canonical host (NEXTAUTH_URL) before any
    // auth flow starts, so sign-in and callback share the same origin.
    // ------------------------------------------------------------
    const canonicalBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (canonicalBaseUrl) {
        try {
            const canonical = new URL(canonicalBaseUrl);
            // IMPORTANT:
            // - Use hostname (without port) for comparisons because some platforms/proxies
            //   may report internal ports (e.g. :8080) in request.nextUrl.host.
            // - Never redirect users to :8080 on a public domain.
            // Also: Prefer x-forwarded-host because Cloud Run domain mappings / proxies can
            // set Host to the underlying *.run.app service while preserving the original
            // domain in X-Forwarded-Host. Using NextRequest.nextUrl alone can cause an
            // infinite 308 loop (Location points to the same public URL).
            const currentHostname = getEffectiveHostname(request.headers, request.nextUrl.hostname);
            const canonicalHostname = canonical.hostname;

            if (canonicalHostname && currentHostname && canonicalHostname !== currentHostname) {
                const url = request.nextUrl.clone();
                url.protocol = canonical.protocol;
                url.hostname = canonical.hostname;
                // Explicitly clear port to avoid leaking internal port (e.g. 8080) to the client.
                url.port = canonical.port;
                return NextResponse.redirect(url, 308);
            }
        } catch (error) {
            // Ignore invalid canonical URL; do not block requests.
            console.warn('[middleware] Invalid NEXTAUTH_URL configuration:', canonicalBaseUrl, error);
        }
    }

    const { pathname } = request.nextUrl;

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
