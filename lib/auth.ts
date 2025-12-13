import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { Role } from '@prisma/client';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { comparePassword, hashPassword } from './password';
import { MIN_PASSWORD_LENGTH } from './constants';

function isBuildTime(): boolean {
    // Next.js sets NEXT_PHASE during build (e.g. "phase-production-build").
    // We intentionally do NOT fail the build when runtime-only secrets are absent.
    return process.env.NEXT_PHASE === 'phase-production-build';
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (value && value.length > 0) {
        return value;
    }
    if (isBuildTime()) {
        // Build-time placeholder. Runtime must still provide real values.
        return `__MISSING_${name}__`;
    }
    throw new Error(`Missing required environment variable: ${name}`);
}

const GOOGLE_CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = requireEnv('GOOGLE_CLIENT_SECRET');
const NEXTAUTH_SECRET = requireEnv('NEXTAUTH_SECRET');

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    // NextAuth v4 automatically detects host for multi-domain support (Cloud Run + custom domain)
    // This works with both blunaai.com and *.run.app URLs without hard-depending on NEXTAUTH_URL.
    providers: [
        GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            // Allow linking Google OAuth to an existing user with the same email.
            // This prevents OAuthAccountNotLinked when a user originally registered with credentials.
            //
            // Safety: We only allow sign-in if Google reports the email is verified.
            allowDangerousEmailAccountLinking: true,
        }),
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
                    console.warn('[auth][credentials] missing email or password');
                    throw new Error('メールアドレスとパスワードを入力してください');
                }

                const email = String(credentials.email).toLowerCase().trim();
                const password = String(credentials.password);
                const action = String(credentials.action || 'login');
                const name = credentials.name ? String(credentials.name) : undefined;

                if (!email) {
                    throw new Error('メールアドレスを入力してください');
                }
                // Never log passwords.
                console.info('[auth][credentials] attempt', { email, action });

                // Registration flow
                if (action === 'register') {
                    // Case-insensitive existence check to support legacy mixed-case rows.
                    const existingUser = await prisma.user.findFirst({
                        where: { email: { equals: email, mode: 'insensitive' } },
                        select: { id: true, email: true },
                    });

                    if (existingUser) {
                        console.warn('[auth][credentials] register blocked: email already exists', {
                            email,
                            userId: existingUser.id,
                        });
                        // Avoid email enumeration by returning a generic message.
                        throw new Error('登録に失敗しました。入力内容をご確認ください。');
                    }

                    if (password.length < MIN_PASSWORD_LENGTH) {
                        console.warn('[auth][credentials] register blocked: password too short', { email });
                        throw new Error(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
                    }

                    const hashedPassword = await hashPassword(password);
                    const user = await prisma.$transaction(async tx => {
                        const created = await tx.user.create({
                            data: {
                                email,
                                password: hashedPassword,
                                name: name || email.split('@')[0],
                            },
                        });

                        const { createDefaultFreeSubscriptionWithClient } = await import('./subscription');
                        await createDefaultFreeSubscriptionWithClient(created.id, tx);
                        return created;
                    });

                    console.info('[auth][credentials] register success', { email, userId: user.id });

                    const createdUser = {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        role: user.role,
                    } satisfies {
                        id: string;
                        email: string;
                        name: string | null;
                        image: string | null;
                        role: Role;
                    };
                    return createdUser;
                }

                // Login flow
                // Case-insensitive lookup to support legacy mixed-case rows.
                // We use findFirst (not findUnique) because Prisma's unique lookup is case-sensitive in Postgres.
                const user = await prisma.user.findFirst({
                    where: { email: { equals: email, mode: 'insensitive' } },
                });

                // Avoid account enumeration by returning a generic error for all failures.
                if (!user || !user.password) {
                    console.warn('[auth][credentials] login failed', {
                        email,
                        reason: !user ? 'user_not_found' : 'no_password',
                        userId: user?.id,
                    });
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                const isPasswordValid = await comparePassword(password, user.password);

                if (!isPasswordValid) {
                    console.warn('[auth][credentials] login failed: invalid password', { email, userId: user.id });
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                // Best-effort: normalize legacy mixed-case emails on successful login.
                if (user.email && user.email !== email) {
                    try {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { email },
                        });
                    } catch (error) {
                        console.error('Failed to normalize legacy user email on credentials login', {
                            userId: user.id,
                            fromEmail: user.email,
                            toEmail: email,
                            error,
                        });
                    }
                }

                console.info('[auth][credentials] login success', { email, userId: user.id });
                const loggedInUser = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                } satisfies {
                    id: string;
                    email: string;
                    name: string | null;
                    image: string | null;
                    role: Role;
                };
                return loggedInUser;
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
            // Safety check for OAuth email verification
            if (account?.provider === 'google') {
                const emailVerified = (profile as any)?.email_verified;
                if (emailVerified !== true) {
                    console.error('Google OAuth sign-in blocked: email not verified', {
                        email: (profile as any)?.email,
                    });
                    return false;
                }
            }

            // Normalize email casing for existing users (prevents duplicate users / login issues).
            // Prisma middleware also enforces lowercase on writes; this handles legacy rows.
            if (user?.id && user.email) {
                const normalizedEmail = String(user.email).toLowerCase().trim();
                if (normalizedEmail && normalizedEmail !== user.email) {
                    try {
                        const existing = await prisma.user.findUnique({
                            where: { email: normalizedEmail },
                            select: { id: true },
                        });
                        if (existing && existing.id !== user.id) {
                            console.error('Email normalization conflict detected for OAuth sign-in', {
                                userId: user.id,
                                fromEmail: user.email,
                                toEmail: normalizedEmail,
                                conflictingUserId: existing.id,
                            });
                            return '/auth/error?error=EmailNormalizationConflict';
                        }
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { email: normalizedEmail },
                        });
                    } catch (error) {
                        console.error('Failed to normalize user email on sign-in', {
                            userId: user.id,
                            email: user.email,
                            error,
                        });
                    }
                }
            }

            // For Google OAuth: Create default FREE subscription if user is new
            if (account?.provider === 'google' && user?.id) {
                // If a subscription already exists, don't block sign-in due to subscription init.
                // (This also avoids unnecessary writes and reduces risk of transient failures.)
                try {
                    const existing = await prisma.subscription.findUnique({
                        where: { userId: user.id },
                        select: { id: true },
                    });
                    if (existing) {
                        return true;
                    }
                } catch (error) {
                    console.error('Failed to check existing subscription during Google sign-in', {
                        userId: user.id,
                        error,
                    });
                }

                try {
                    const { createDefaultFreeSubscription } = await import('./subscription');
                    await createDefaultFreeSubscription(user.id);
                } catch (error: any) {
                    console.error('Failed to create default subscription for Google OAuth user:', error);
                    // If we cannot ensure a subscription exists, fail sign-in with a user-friendly error.
                    try {
                        const existing = await prisma.subscription.findUnique({
                            where: { userId: user.id },
                            select: { id: true },
                        });
                        if (existing) {
                            return true;
                        }
                    } catch {
                        // ignore secondary errors
                    }
                    return '/auth/error?error=SubscriptionInitFailed';
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
    debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === 'true',
    secret: NEXTAUTH_SECRET,
};
