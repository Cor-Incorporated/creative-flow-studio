'use client';

import Link from 'next/link';

export type UsageLimitInfo = {
    isLimitReached: boolean;
    planName: string;
    usage: {
        current: number;
        limit: number | null;
    };
    resetDate: string | null;
};

interface UsageLimitBannerProps {
    limitInfo: UsageLimitInfo;
    onDismiss?: () => void;
}

/**
 * Banner displayed above chat input when user reaches their API limit
 * Similar to ChatGPT/Claude's limit messaging
 */
export default function UsageLimitBanner({ limitInfo, onDismiss }: UsageLimitBannerProps) {
    const { planName, usage, resetDate } = limitInfo;

    // Format reset date
    const formatResetDate = (dateStr: string | null): string => {
        if (!dateStr) return '次の請求期間';
        const date = new Date(dateStr);
        return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
    };

    // Calculate days until reset
    const getDaysUntilReset = (): number | null => {
        if (!resetDate) return null;
        const now = new Date();
        const reset = new Date(resetDate);
        const diff = Math.ceil((reset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    };

    const daysUntilReset = getDaysUntilReset();
    const isEnterprise = planName === 'ENTERPRISE';
    const isFree = planName === 'FREE';

    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-lg shadow-sm">
            <div className="flex items-start">
                {/* Warning Icon */}
                <div className="flex-shrink-0">
                    <svg
                        className="h-5 w-5 text-yellow-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>

                {/* Content */}
                <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-yellow-800">
                        今月のリクエスト上限に達しました
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                        <p>
                            {planName}プランの月間リクエスト上限（{usage.limit?.toLocaleString()}回）に達しました。
                            {daysUntilReset !== null && (
                                <span>
                                    {' '}
                                    リセットまであと<strong>{daysUntilReset}日</strong>
                                    （{formatResetDate(resetDate)}）です。
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Actions based on plan */}
                    <div className="mt-4">
                        {isEnterprise ? (
                            /* Enterprise users - wait only */
                            <div className="flex items-center text-sm text-yellow-700">
                                <svg
                                    className="h-4 w-4 mr-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span>
                                    {formatResetDate(resetDate)}にリセットされます。
                                    追加の容量が必要な場合は
                                    <a
                                        href="mailto:support@example.com"
                                        className="font-medium underline ml-1"
                                    >
                                        サポートにお問い合わせ
                                    </a>
                                    ください。
                                </span>
                            </div>
                        ) : (
                            /* FREE/PRO users - wait or upgrade */
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    {isFree ? 'Proにアップグレード' : 'Enterpriseにアップグレード'}
                                </Link>
                                <span className="text-sm text-yellow-700">
                                    または{formatResetDate(resetDate)}まで待つ
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Usage stats */}
                    <div className="mt-3 pt-3 border-t border-yellow-200">
                        <div className="flex items-center justify-between text-xs text-yellow-600">
                            <span>今月の使用量</span>
                            <span className="font-medium">
                                {usage.current?.toLocaleString()} / {usage.limit?.toLocaleString()} リクエスト
                            </span>
                        </div>
                        <div className="mt-1 h-2 bg-yellow-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-yellow-500 rounded-full transition-all duration-300"
                                style={{
                                    width: usage.limit
                                        ? `${Math.min(100, (usage.current / usage.limit) * 100)}%`
                                        : '0%',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Dismiss button */}
                {onDismiss && (
                    <div className="ml-4 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="inline-flex rounded-md text-yellow-500 hover:text-yellow-600 focus:outline-none"
                        >
                            <span className="sr-only">閉じる</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
