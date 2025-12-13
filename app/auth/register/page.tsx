'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    const { data: session, status } = useSession();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (status === 'authenticated' && session?.user) {
            router.replace(callbackUrl);
        }
    }, [status, session, router, callbackUrl]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            // NOTE: Autofill may not trigger onChange in some environments.
            // Read from the form as source-of-truth on submit.
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const formName = (formData.get('name') as string | null) ?? undefined;
            const formEmail = (formData.get('email') as string | null) ?? undefined;
            const formPassword = (formData.get('password') as string | null) ?? undefined;

            const result = await signIn('credentials', {
                redirect: false,
                email: (formEmail ?? email).trim(),
                password: formPassword ?? password,
                action: 'register',
                name: (formName ?? name).trim() || undefined,
                callbackUrl,
            });

            if (!result || result.error) {
                setError(
                    result?.error === 'CredentialsSignin'
                        ? '登録に失敗しました。入力内容をご確認ください。'
                        : '登録に失敗しました。入力内容をご確認ください。'
                );
                return;
            }

            router.push(result.url || callbackUrl);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setIsGoogleSubmitting(true);
        try {
            await signIn('google', { callbackUrl });
        } catch {
            setError('Googleログインに失敗しました。もう一度お試しください。');
        } finally {
            setIsGoogleSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 px-4">
            <div className="w-full max-w-md bg-gray-800/60 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <h1 className="text-2xl font-bold mb-2">新規登録</h1>
                <p className="text-sm text-gray-300 mb-6">
                    Google またはメールアドレスとパスワードでアカウントを作成できます。
                </p>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting || isGoogleSubmitting}
                    className="w-full mb-4 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isGoogleSubmitting ? 'Googleログイン中...' : 'Googleで始める'}
                </button>

                <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1 bg-gray-700" />
                    <span className="text-xs text-gray-400">または</span>
                    <div className="h-px flex-1 bg-gray-700" />
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                    <div>
                        <label className="block text-sm mb-1 text-gray-200">表示名（任意）</label>
                        <input
                            type="text"
                            name="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onBlur={e => setName(e.target.value.trim())}
                            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            autoComplete="name"
                            maxLength={100}
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1 text-gray-200">メールアドレス</label>
                        <input
                            type="email"
                            name="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onBlur={e => setEmail(e.target.value.trim())}
                            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            autoComplete="email"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1 text-gray-200">
                            パスワード（{MIN_PASSWORD_LENGTH}文字以上）
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-3 py-2 pr-11 rounded-lg bg-gray-900 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                autoComplete="new-password"
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                maxLength={MAX_PASSWORD_LENGTH}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                            >
                                {showPassword ? (
                                    <EyeSlashIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 rounded-lg bg-gray-100 text-gray-900 hover:bg-white transition-colors font-semibold disabled:opacity-60"
                    >
                        {isSubmitting ? '登録中...' : 'メールで登録'}
                    </button>
                </form>

                <p className="mt-4 text-sm text-gray-300">
                    すでにアカウントをお持ちですか？{' '}
                    <Link className="text-blue-400 hover:underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                        ログイン
                    </Link>
                </p>
            </div>
        </div>
    );
}


