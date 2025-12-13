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
                    const existingUser = await prisma.user.findUnique({
                        where: { email },
                        select: { id: true },
                    });

                    if (existingUser) {
                        console.warn('[auth][credentials] register blocked: email already exists', {
                            email,
                            userId: existingUser.id,
                        });
                        throw new Error('このメールアドレスは既に登録されています');
                    }

                    if (password.length < MIN_PASSWORD_LENGTH) {
                        console.warn('[auth][credentials] register blocked: password too short', { email });
                        throw new Error(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
                    }

                    const hashedPassword = await hashPassword(password);
                    const user = await prisma.user.create({
                        data: {
                            email,
                            password: hashedPassword,
                            name: name || email.split('@')[0],
                        },
                    });
                    console.info('[auth][credentials] register success', { email, userId: user.id });

                    // Create default FREE plan subscription for new user
                    try {
                        const { createDefaultFreeSubscription } = await import('./subscription');
                        await createDefaultFreeSubscription(user.id);
                    } catch (error: any) {
                        console.error('Failed to create default subscription:', error);
                        // Don't fail registration if subscription creation fails
                    }

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
                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user) {
                    console.warn('[auth][credentials] login failed: user not found', { email });
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                if (!user.password) {
                    console.warn('[auth][credentials] login blocked: user has no password (likely OAuth only)', {
                        email,
                        userId: user.id,
                    });
                    throw new Error('このアカウントはGoogleログインで登録されています。Googleでログインしてください。');
                }

                const isPasswordValid = await comparePassword(password, user.password);

                if (!isPasswordValid) {
                    console.warn('[auth][credentials] login failed: invalid password', { email, userId: user.id });
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
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
                            return false;
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
                try {
                    const { createDefaultFreeSubscription } = await import('./subscription');
                    await createDefaultFreeSubscription(user.id);
                } catch (error: any) {
                    console.error('Failed to create default subscription for Google OAuth user:', error);
                    // Don't fail sign-in if subscription creation fails
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
