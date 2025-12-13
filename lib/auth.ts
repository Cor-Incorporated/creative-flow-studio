import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { Role } from '@prisma/client';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { comparePassword, hashPassword } from './password';

if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('Missing required environment variable: NEXTAUTH_SECRET');
}

const hasGoogleProvider = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    // NextAuth v4 automatically detects host for multi-domain support (Cloud Run + custom domain)
    // This works with both blunaai.com and *.run.app URLs without hard-depending on NEXTAUTH_URL.
    providers: [
        ...(hasGoogleProvider
            ? [
                  GoogleProvider({
                      clientId: process.env.GOOGLE_CLIENT_ID!,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                      // Existing email may already exist with another provider.
                      // We guard this further in callbacks.signIn by requiring verified email.
                      allowDangerousEmailAccountLinking: true,
                  }),
              ]
            : []),
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'メールアドレス', type: 'email' },
                password: { label: 'パスワード', type: 'password' },
                action: { label: 'アクション', type: 'text' }, // 'login' or 'register'
                name: { label: '名前', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('メールアドレスとパスワードを入力してください');
                }

                const email = String(credentials.email).toLowerCase().trim();
                const password = String(credentials.password);
                const action = String(credentials.action || 'login');
                const name = credentials.name ? String(credentials.name) : undefined;

                if (!email) {
                    throw new Error('メールアドレスを入力してください');
                }

                // Registration flow
                if (action === 'register') {
                    const existingUser = await prisma.user.findUnique({
                        where: { email },
                        select: { id: true },
                    });

                    if (existingUser) {
                        throw new Error('このメールアドレスは既に登録されています');
                    }

                    if (password.length < 8) {
                        throw new Error('パスワードは8文字以上で入力してください');
                    }

                    const hashedPassword = await hashPassword(password);
                    const user = await prisma.user.create({
                        data: {
                            email,
                            password: hashedPassword,
                            name: name || email.split('@')[0],
                        },
                    });

                    // Create default FREE plan subscription for new user
                    try {
                        const { createDefaultFreeSubscription } = await import('./subscription');
                        await createDefaultFreeSubscription(user.id);
                    } catch (error: any) {
                        console.error('Failed to create default subscription:', error);
                        // Don't fail registration if subscription creation fails
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        role: user.role,
                    } as any;
                }

                // Login flow
                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user) {
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                if (!user.password) {
                    throw new Error(
                        'このアカウントはGoogleログインで登録されています。Googleでログインしてください。'
                    );
                }

                const isPasswordValid = await comparePassword(password, user.password);

                if (!isPasswordValid) {
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                } as any;
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    // HTTPS環境用のCookie設定
    cookies: {
        sessionToken: {
            name:
                process.env.NODE_ENV === 'production'
                    ? `__Secure-next-auth.session-token`
                    : 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        callbackUrl: {
            name:
                process.env.NODE_ENV === 'production'
                    ? `__Secure-next-auth.callback-url`
                    : 'next-auth.callback-url',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        csrfToken: {
            name:
                process.env.NODE_ENV === 'production'
                    ? `__Host-next-auth.csrf-token`
                    : 'next-auth.csrf-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            // Safety: only allow account linking if Google says the email is verified.
            if (account?.provider === 'google') {
                const emailVerified =
                    typeof (profile as any)?.email_verified === 'boolean'
                        ? (profile as any).email_verified
                        : true;
                if (!emailVerified) return false;

                // For Google OAuth: Create default FREE subscription if user is new
                if (user?.id) {
                    try {
                        const { createDefaultFreeSubscription } = await import('./subscription');
                        await createDefaultFreeSubscription(user.id);
                    } catch (error: any) {
                        console.error('Failed to create default subscription for Google OAuth user:', error);
                        // Don't fail sign-in if subscription creation fails
                    }
                }
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = (user as any).id;
                const dbUser = await prisma.user.findUnique({
                    where: { id: (user as any).id },
                    select: { role: true },
                });
                if (dbUser) {
                    token.role = dbUser.role;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token) {
                (session.user as any).id = token.id as string;
                (session.user as any).role = token.role as Role;
            }
            return session;
        },
    },
    debug: process.env.NODE_ENV === 'development',
};
