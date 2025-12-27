'use client';

import { EyeIcon, EyeSlashIcon, SparklesIcon } from '@/components/icons';
import { useToast } from '@/components/Toast';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function ChangePasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const { data: session, status } = useSession();
    const { showToast, ToastContainer } = useToast();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasExistingPassword, setHasExistingPassword] = useState<boolean | null>(null);
    const [checkingPasswordStatus, setCheckingPasswordStatus] = useState(true);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/auth/change-password')}`);
        }
    }, [status, session, router]);

    // Check if user has existing password
    useEffect(() => {
        if (status !== 'authenticated') return;

        async function checkPasswordStatus() {
            try {
                // We'll determine this on the server side during form submission
                // For now, we'll show the current password field and let the server validate
                // A more sophisticated approach would be to add an API endpoint to check
                setHasExistingPassword(true); // Default to showing current password field
            } catch {
                // Default to showing current password field for safety
                setHasExistingPassword(true);
            } finally {
                setCheckingPasswordStatus(false);
            }
        }

        checkPasswordStatus();
    }, [status]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);

        // Client-side validation
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
            setIsLoading(false);
            return;
        }

        if (newPassword.length > MAX_PASSWORD_LENGTH) {
            setErrorMessage(`パスワードは${MAX_PASSWORD_LENGTH}文字以下で入力してください`);
            setIsLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage('新しいパスワードが一致しません');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: currentPassword || undefined,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle specific error for OAuth users who don't need currentPassword
                if (data.code === 'VALIDATION_ERROR' && data.error?.includes('現在のパスワード')) {
                    // If the error is about current password and we haven't tried without it,
                    // this might be an OAuth user - let the user know
                    setHasExistingPassword(true);
                }
                setErrorMessage(data.error || 'パスワードの変更に失敗しました');
                return;
            }

            // Success
            showToast({
                message: 'パスワードを変更しました',
                type: 'success',
                duration: 3000,
            });

            // Redirect after a short delay
            setTimeout(() => {
                router.push(callbackUrl);
            }, 1500);
        } catch {
            setErrorMessage('エラーが発生しました。もう一度お試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state
    if (status === 'loading' || checkingPasswordStatus) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-gray-300">読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <ToastContainer />
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <SparklesIcon className="w-10 h-10 text-blue-400" />
                        <h1 className="text-3xl font-bold text-white">BlunaAI</h1>
                    </div>
                    <h2 className="text-xl text-gray-400">パスワード変更</h2>
                    <p className="text-sm text-gray-500 mt-2">
                        {hasExistingPassword
                            ? '現在のパスワードと新しいパスワードを入力してください'
                            : '新しいパスワードを設定してください'}
                    </p>
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
                        {errorMessage}
                    </div>
                )}

                {/* Password Change Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Current Password */}
                    {hasExistingPassword && (
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">
                                現在のパスワード
                            </label>
                            <div className="relative">
                                <input
                                    id="currentPassword"
                                    name="currentPassword"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    maxLength={MAX_PASSWORD_LENGTH}
                                    className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="現在のパスワード"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                                    aria-label={showCurrentPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                                >
                                    {showCurrentPassword ? (
                                        <EyeSlashIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Googleアカウントでログインしている場合は空欄でも構いません
                            </p>
                        </div>
                    )}

                    {/* New Password */}
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                            新しいパスワード
                        </label>
                        <div className="relative">
                            <input
                                id="newPassword"
                                name="newPassword"
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                maxLength={MAX_PASSWORD_LENGTH}
                                className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                                aria-label={showNewPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                            >
                                {showNewPassword ? (
                                    <EyeSlashIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                            新しいパスワード（確認）
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                                maxLength={MAX_PASSWORD_LENGTH}
                                className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="もう一度入力"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                                aria-label={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                            >
                                {showConfirmPassword ? (
                                    <EyeSlashIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-xs text-red-400 mt-1">パスワードが一致しません</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading || (newPassword !== confirmPassword)}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                処理中...
                            </span>
                        ) : (
                            'パスワードを変更'
                        )}
                    </button>
                </form>

                {/* Back Link */}
                <div className="text-center">
                    <button
                        onClick={() => router.push(callbackUrl)}
                        className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
                    >
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ChangePasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="text-white">読み込み中...</div>
                </div>
            }
        >
            <ChangePasswordContent />
        </Suspense>
    );
}
