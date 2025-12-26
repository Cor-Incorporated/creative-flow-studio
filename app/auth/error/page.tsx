'use client';

import { SparklesIcon, GoogleIcon } from '@/components/icons';
import {
    getAuthErrorConfig,
    isEnhancedError,
    formatErrorTimestamp,
    type AuthErrorAction,
} from '@/lib/auth-errors';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';

function ActionButton({ action }: { action: AuthErrorAction }) {
    const handleClick = () => {
        if (action.type === 'google') {
            signIn('google', { callbackUrl: '/' });
            return;
        }
        if (action.href) {
            window.location.href = action.href;
        }
    };

    // Determine button style based on action type
    const buttonStyle =
        action.type === 'google'
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : action.type === 'support'
              ? 'bg-yellow-600 hover:bg-yellow-700'
              : action.type === 'signin' || action.type === 'email'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600';

    return (
        <button
            onClick={handleClick}
            className={`flex items-center justify-center gap-2 w-full px-4 py-3 text-white rounded-lg font-medium transition-colors ${buttonStyle}`}
        >
            {action.type === 'google' && <GoogleIcon className="w-5 h-5" />}
            <span className={action.type === 'google' ? 'text-gray-900' : ''}>{action.label}</span>
        </button>
    );
}

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const errorCode = searchParams.get('error') || 'Default';

    const errorConfig = useMemo(() => getAuthErrorConfig(errorCode), [errorCode]);
    const needsEnhancedUI = useMemo(() => isEnhancedError(errorCode), [errorCode]);
    const timestamp = useMemo(() => formatErrorTimestamp(), []);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8 text-center">
                {/* Header */}
                <div className="flex items-center justify-center gap-2 mb-4">
                    <SparklesIcon className="w-10 h-10 text-blue-400" />
                    <h1 className="text-3xl font-bold text-white">BlunaAI</h1>
                </div>

                {/* Error Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-red-900/50 rounded-full flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Error Message */}
                <div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                        {errorConfig.title || '認証エラー'}
                    </h2>
                    <p className="text-gray-400">{errorConfig.message}</p>
                </div>

                {/* Support Info (for enhanced errors) */}
                {needsEnhancedUI && errorConfig.supportInfo && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-left">
                        <h3 className="text-sm font-semibold text-white mb-2">サポート情報</h3>
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">
                            {errorConfig.supportInfo}
                        </pre>
                        {errorConfig.showTimestamp && (
                            <p className="mt-2 text-xs text-gray-500">発生日時: {timestamp}</p>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    {errorConfig.actions?.map((action, index) => (
                        <ActionButton key={index} action={action} />
                    ))}
                </div>

                {/* Error Code */}
                <p className="text-xs text-gray-500">エラーコード: {errorCode}</p>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="text-white">読み込み中...</div>
                </div>
            }
        >
            <AuthErrorContent />
        </Suspense>
    );
}
