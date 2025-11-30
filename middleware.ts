import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

    // Admin route protection
    if (pathname.startsWith('/admin')) {
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
