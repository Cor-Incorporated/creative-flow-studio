import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

// Validate required environment variables
if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Missing required environment variable: GOOGLE_CLIENT_ID');
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing required environment variable: GOOGLE_CLIENT_SECRET');
}
if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('Missing required environment variable: NEXTAUTH_SECRET');
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    session: {
        strategy: 'database',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours
    },
    // HTTPS環境用のCookie設定
    cookies: {
        sessionToken: {
            name: `__Secure-next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: true, // HTTPS環境では true
            },
        },
        callbackUrl: {
            name: `__Secure-next-auth.callback-url`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: true,
            },
        },
        csrfToken: {
            name: `__Host-next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: true,
            },
        },
    },
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
                // Fetch full user data including role
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { id: true, email: true, name: true, image: true, role: true },
                });
                if (dbUser) {
                    session.user.role = dbUser.role;
                }
            }
            return session;
        },
    },
    debug: process.env.NODE_ENV === 'development',
};
