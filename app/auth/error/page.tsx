'use client';

import { SparklesIcon } from '@/components/icons';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const errorMessages: Record<string, string> = {
    Configuration: 'サーバー設定にエラーがあります。管理者にお問い合わせください。',
    AccessDenied: 'アクセスが拒否されました。',
    Verification: '認証トークンの有効期限が切れているか、既に使用されています。',
    OAuthSignin: 'OAuth認証の開始中にエラーが発生しました。',
    OAuthCallback: 'OAuth認証のコールバック処理中にエラーが発生しました。',
    OAuthCreateAccount: 'OAuthアカウントの作成中にエラーが発生しました。',
    EmailCreateAccount: 'メールアカウントの作成中にエラーが発生しました。',
    Callback: '認証コールバック中にエラーが発生しました。',
    OAuthAccountNotLinked: 'このメールアドレスは別の認証方法で登録されています。最初に使用した方法でログインしてください。',
    EmailSignin: 'メール認証の送信に失敗しました。',
    CredentialsSignin: 'メールアドレスまたはパスワードが正しくありません。',
    SessionRequired: 'この操作を行うにはログインが必要です。',
    Default: '認証中にエラーが発生しました。',
};

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error') || 'Default';
    const errorMessage = errorMessages[error] || errorMessages.Default;

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8 text-center">
                {/* Header */}
                <div className="flex items-center justify-center gap-2 mb-4">
                    <SparklesIcon className="w-10 h-10 text-blue-400" />
                    <h1 className="text-3xl font-bold text-white">クリエイティブフロースタジオ</h1>
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
                    <h2 className="text-xl font-semibold text-white mb-2">認証エラー</h2>
                    <p className="text-gray-400">{errorMessage}</p>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    <a
                        href="/auth/signin"
                        className="block w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        ログインページに戻る
                    </a>
                    <a
                        href="/"
                        className="block w-full px-4 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
                    >
                        ホームに戻る
                    </a>
                </div>

                {/* Error Code */}
                <p className="text-xs text-gray-500">
                    エラーコード: {error}
                </p>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">読み込み中...</div>
            </div>
        }>
            <AuthErrorContent />
        </Suspense>
    );
}
