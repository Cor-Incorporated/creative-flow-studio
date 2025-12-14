import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { Role } from '@prisma/client';
import { createHash } from 'crypto';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { MAX_PASSWORD_LENGTH, MIN_AUTH_RESPONSE_TIME_MS, MIN_PASSWORD_LENGTH } from './constants';
import { comparePassword, hashPassword, needsRehash } from './password';
import { prisma } from './prisma';
import { createDefaultFreeSubscriptionWithClient } from './subscription';

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

// Declare extended type for the user object passed to createUser event
type NextAuthUser = {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
};

function emailLogId(email: string): string {
    // Non-reversible identifier for logs to avoid storing PII.
    return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

function sanitizeDisplayName(input: string | undefined, fallbackEmail: string): string {
    const raw = (input || '').trim();
    const normalized = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalized.length >= 1) {
        return normalized.slice(0, 100);
    }
    const prefix = fallbackEmail.split('@')[0] || 'ユーザー';
    const safePrefix = prefix.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (safePrefix || 'ユーザー').slice(0, 100);
}

async function ensureMinDelay(startMs: number, minMs: number): Promise<void> {
    const elapsed = Date.now() - startMs;
    const remaining = minMs - elapsed;
    if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
    }
}

function safeErrorForLog(error: any): { name?: string; code?: string; message?: string } {
    if (!error || typeof error !== 'object') {
        return { message: String(error) };
    }
    return {
        name: (error as any).name,
        code: (error as any).code,
        message: (error as any).message,
    };
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    // NextAuth v4 automatically detects host for multi-domain support (Cloud Run + custom domain)
    // This works with both blunaai.com and *.run.app URLs without hard-depending on NEXTAUTH_URL.
    providers: [
        GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            // NOTE:
            // We intentionally do NOT enable allowDangerousEmailAccountLinking here.
            // Without a credentials email verification flow, automatic linking can enable
            // account pre-hijacking (someone registers credentials with a victim email, then
            // victim later signs in with Google and lands in that account).
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
                const start = Date.now();
                if (!credentials?.email || !credentials?.password) {
                    console.warn('[auth][credentials] missing email or password');
                    throw new Error('メールアドレスとパスワードを入力してください');
                }

                const email = String(credentials.email).toLowerCase().trim();
                const emailId = emailLogId(email);
                const password = String(credentials.password);
                const action = String(credentials.action || 'login');
                const name = credentials.name ? String(credentials.name) : undefined;

                if (action !== 'login' && action !== 'register') {
                    console.warn('[auth][credentials] invalid action', { emailId, action });
                    await ensureMinDelay(start, MIN_AUTH_RESPONSE_TIME_MS);
                    throw new Error('登録に失敗しました。入力内容をご確認ください。');
                }

                if (password.length > MAX_PASSWORD_LENGTH) {
                    console.warn('[auth][credentials] blocked: password too long', { emailId, action });
                    await ensureMinDelay(start, MIN_AUTH_RESPONSE_TIME_MS);
                    if (action === 'register') {
                        throw new Error(`パスワードは${MAX_PASSWORD_LENGTH}文字以下で入力してください`);
                    }
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                if (!email) {
                    throw new Error('メールアドレスを入力してください');
                }
                // Never log passwords.
                console.info('[auth][credentials] attempt', { emailId, action });

                // Registration flow
                if (action === 'register') {
                    // Case-insensitive existence check to support legacy mixed-case rows.
                    const existingUser = await prisma.user.findFirst({
                        where: { email: { equals: email, mode: 'insensitive' } },
                        select: { id: true, email: true },
                    });

                    if (existingUser) {
                        console.warn('[auth][credentials] register blocked: email already exists', {
                            emailId,
                            userId: existingUser.id,
                        });
                        // Avoid email enumeration by returning a generic message.
                        await ensureMinDelay(start, MIN_AUTH_RESPONSE_TIME_MS);
                        throw new Error('登録に失敗しました。入力内容をご確認ください。');
                    }

                    if (password.length < MIN_PASSWORD_LENGTH) {
                        console.warn('[auth][credentials] register blocked: password too short', { emailId });
                        await ensureMinDelay(start, MIN_AUTH_RESPONSE_TIME_MS);
                        throw new Error(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
                    }

                    const hashedPassword = await hashPassword(password);
                    const user = await prisma.$transaction(async tx => {
                        const created = await tx.user.create({
                            data: {
                                email,
                                password: hashedPassword,
                                name: sanitizeDisplayName(name, email),
                            },
                        });

                        await createDefaultFreeSubscriptionWithClient(created.id, tx);
                        return created;
                    });

                    console.info('[auth][credentials] register success', { emailId, userId: user.id });

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
                        emailId,
                        reason: !user ? 'user_not_found' : 'no_password',
                        userId: user?.id,
                    });
                    await ensureMinDelay(start, MIN_AUTH_RESPONSE_TIME_MS);
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                const isPasswordValid = await comparePassword(password, user.password);

                if (!isPasswordValid) {
                    console.warn('[auth][credentials] login failed: invalid password', { emailId, userId: user.id });
                    await ensureMinDelay(start, MIN_AUTH_RESPONSE_TIME_MS);
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
                            fromEmailId: emailLogId(String(user.email)),
                            toEmailId: emailLogId(email),
                            error: safeErrorForLog(error),
                        });
                    }
                }

                // Upgrade password hash parameters opportunistically on successful login.
                if (needsRehash(user.password)) {
                    try {
                        const upgraded = await hashPassword(password);
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { password: upgraded },
                        });
                    } catch (error) {
                        console.error('Failed to upgrade password hash parameters', {
                            userId: user.id,
                            emailId,
                            error: safeErrorForLog(error),
                        });
                    }
                }

                console.info('[auth][credentials] login success', { emailId, userId: user.id });
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
                    const profileEmail = String((profile as any)?.email || '');
                    console.error('Google OAuth sign-in blocked: email not verified', {
                        emailId: profileEmail ? emailLogId(profileEmail) : null,
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
                        try {
                            await prisma.user.update({
                                where: { id: user.id },
                                data: { email: normalizedEmail },
                            });
                        } catch (error: any) {
                            // If another request wins the race and claims the normalized email, surface a user-friendly error.
                            if (error?.code === 'P2002') {
                                console.error('Email normalization conflict (unique violation) on sign-in', {
                                    userId: user.id,
                                    toEmailId: emailLogId(normalizedEmail),
                                });
                                return '/auth/error?error=EmailNormalizationConflict';
                            }
                            throw error;
                        }
                    } catch (error: any) {
                        console.error('Failed to normalize user email on sign-in', {
                            userId: user.id,
                            emailId: emailLogId(String(user.email)),
                            error: safeErrorForLog(error),
                        });
                    }
                }
            }

            // For Google OAuth: Create default FREE subscription if user is new
            // NOTE: We used to do this here, but it caused race conditions (SubscriptionInitFailed)
            // because the user record might not be committed yet when we try to create the subscription.
            // We now handle this in the `createUser` event below.

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
    events: {
        async createUser({ user }: { user: NextAuthUser }) {
            // Create default subscription immediately after user creation (mostly for OAuth).
            // This is safer than the signIn callback as we are guaranteed the user exists.
            try {
                if (!user.id) {
                    console.warn('[auth][events] createUser called without user.id');
                    return;
                }

                // Idempotency check: Account might have been created via credentials with atomic subscription
                const existing = await prisma.subscription.findUnique({
                    where: { userId: user.id },
                    select: { id: true },
                });
                if (existing) {
                    return;
                }

                await prisma.$transaction(async tx => {
                    await createDefaultFreeSubscriptionWithClient(user.id, tx);
                });
                console.info('[auth][events] Created default subscription for new user', {
                    userId: user.id,
                });
            } catch (error) {
                console.error('[auth][events] Failed to create default subscription', {
                    userId: user.id,
                    error: safeErrorForLog(error),
                });
                // Note: We swallow this error. Monitoring should alert on this log.
                // In future, consider a retry queue mechanism if this becomes frequent.
            }
        },
    },
    debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === 'true',
    secret: NEXTAUTH_SECRET,
};
