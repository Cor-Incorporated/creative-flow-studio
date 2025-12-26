'use client';

import { EyeIcon, EyeSlashIcon, SparklesIcon } from '@/components/icons';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { MAX_PASSWORD_LENGTH } from '@/lib/constants';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

function SignInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    const error = searchParams.get('error');
    const { data: session, status } = useSession();

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const errorFromUrl = useMemo(() => {
        if (!error) return null;
        return getAuthErrorMessage(error);
    }, [error]);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setErrorMessage(errorFromUrl);
    }, [errorFromUrl]);

    useEffect(() => {
        // If the user is already authenticated (e.g. after successful credentials sign-in),
        // redirect them away from the sign-in page.
        if (status === 'authenticated' && session?.user) {
            router.replace(callbackUrl);
        }
    }, [status, session, router, callbackUrl]);

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);

        try {
            // NOTE:
            // Password managers / autofill (and some automated environments) may not trigger
            // React onChange, leaving state values empty. Read from the form as the source
            // of truth on submit to avoid sending blank credentials.
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const formEmail = (formData.get('email') as string | null) ?? undefined;
            const formPassword = (formData.get('password') as string | null) ?? undefined;
            const formName = (formData.get('name') as string | null) ?? undefined;

            const result = await signIn('credentials', {
                email: (formEmail ?? email).trim(),
                password: formPassword ?? password,
                action: isLogin ? 'login' : 'register',
                name: isLogin ? undefined : (formName ?? name),
                redirect: false,
                callbackUrl,
            });

            if (result?.error) {
                setErrorMessage(getAuthErrorMessage(result.error));
            } else if (result?.url) {
                window.location.href = result.url;
            } else {
                // Fallback: treat as success and move to callbackUrl.
                window.location.href = callbackUrl;
            }
        } catch {
            setErrorMessage('エラーが発生しました。もう一度お試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        signIn('google', { callbackUrl });
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <SparklesIcon className="w-10 h-10 text-blue-400" />
                        <h1 className="text-3xl font-bold text-white">BlunaAI</h1>
                    </div>
                    <h2 className="text-xl text-gray-400">
                        {isLogin ? 'アカウントにログイン' : '新規アカウント作成'}
                    </h2>
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
                        {errorMessage}
                    </div>
                )}

                {/* Google Sign In */}
                <button
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Googleでログイン
                </button>

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-900 text-gray-400">または</span>
                    </div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                                名前
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="山田太郎"
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                            メールアドレス
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="your@email.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                            パスワード
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                maxLength={MAX_PASSWORD_LENGTH}
                                className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="8文字以上"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                            >
                                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                処理中...
                            </span>
                        ) : isLogin ? (
                            'ログイン'
                        ) : (
                            'アカウント作成'
                        )}
                    </button>
                </form>

                {/* Toggle Login/Register */}
                <div className="text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setErrorMessage(null);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                    >
                        {isLogin ? 'アカウントをお持ちでない方はこちら' : 'すでにアカウントをお持ちの方はこちら'}
                    </button>
                </div>

                {/* Back to Home */}
                <div className="text-center">
                    <a href="/" className="text-gray-400 hover:text-gray-300 text-sm transition-colors">
                        ホームに戻る
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">読み込み中...</div>
            </div>
        }>
            <SignInContent />
        </Suspense>
    );
}
