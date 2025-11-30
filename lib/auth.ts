import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { comparePassword, hashPassword } from './password';

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

                const { email, password, action, name } = credentials;

                // Registration flow
                if (action === 'register') {
                    const existingUser = await prisma.user.findUnique({
                        where: { email },
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

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                    };
                }

                // Login flow
                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user) {
                    throw new Error('メールアドレスまたはパスワードが正しくありません');
                }

                if (!user.password) {
                    throw new Error('このアカウントはGoogleログインで登録されています。Googleでログインしてください。');
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
                };
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
            name: process.env.NODE_ENV === 'production' ? `__Secure-next-auth.session-token` : 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        callbackUrl: {
            name: process.env.NODE_ENV === 'production' ? `__Secure-next-auth.callback-url` : 'next-auth.callback-url',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === 'production' ? `__Host-next-auth.csrf-token` : 'next-auth.csrf-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                // Fetch role from database
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
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
                session.user.id = token.id as string;
                session.user.role = token.role as string;
            }
            return session;
        },
    },
    debug: process.env.NODE_ENV === 'development',
};
