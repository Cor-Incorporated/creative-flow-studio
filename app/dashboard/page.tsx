'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Dashboard Page
 *
 * Displays user's subscription information and usage statistics.
 *
 * Features:
 * - Current plan display
 * - Billing period and next billing date
 * - Usage meter with progress bar
 * - Manage subscription (Customer Portal)
 * - Link to main app
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 3.1
 * - Stripe Customer Portal: https://docs.stripe.com/billing/subscriptions/integrating-customer-portal
 */

type SubscriptionData = {
    subscription: {
        id: string;
        status: string;
        planId: string;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        plan: {
            id: string;
            name: string;
            monthlyPrice: number;
            features: any;
            maxRequestsPerMonth: number | null;
            maxFileSize: number | null;
        };
    };
    usageCount: number;
};

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isManaging, setIsManaging] = useState(false);

    // Fetch subscription data
    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/api/auth/signin?callbackUrl=/dashboard');
            return;
        }

        async function fetchSubscription() {
            try {
                const response = await fetch('/api/stripe/subscription');

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('サブスクリプションが見つかりません');
                        return;
                    }
                    throw new Error('Failed to fetch subscription');
                }

                const data = await response.json();
                setSubscriptionData(data);
            } catch (err: any) {
                console.error('Error fetching subscription:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }

        fetchSubscription();
    }, [session, status, router]);

    // Handle manage subscription (open Customer Portal)
    const handleManageSubscription = async () => {
        setIsManaging(true);

        try {
            const response = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            if (!response.ok) {
                throw new Error('Failed to create portal session');
            }

            const { url } = await response.json();
            window.location.href = url;
        } catch (error: any) {
            console.error('Error opening Customer Portal:', error);
            alert(`エラーが発生しました: ${error.message}`);
            setIsManaging(false);
        }
    };

    // Calculate usage percentage
    const getUsagePercentage = () => {
        if (!subscriptionData) return 0;
        const { usageCount, subscription } = subscriptionData;
        const limit = subscription.plan.maxRequestsPerMonth;

        if (limit === null) return 0; // Unlimited
        if (limit === 0) return 100;

        return Math.min(Math.round((usageCount / limit) * 100), 100);
    };

    // Format billing period
    const formatDate = (dateString: string | null) => {
        if (!dateString) return '未設定';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date);
    };

    // Get days until next billing
    const getDaysUntilBilling = () => {
        if (!subscriptionData?.subscription.currentPeriodEnd) return 0;
        const end = new Date(subscriptionData.subscription.currentPeriodEnd);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // Format price
    const formatPrice = (amountInCents: number) => {
        const amount = amountInCents / 100;
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: 'JPY',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Get status badge color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-500';
            case 'TRIALING':
                return 'bg-blue-500';
            case 'PAST_DUE':
                return 'bg-yellow-500';
            case 'CANCELED':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-gray-300">読み込み中...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !subscriptionData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
                <div className="text-center max-w-md">
                    <h1 className="text-3xl font-bold mb-4">エラー</h1>
                    <p className="text-gray-300 mb-8">{error || 'データの取得に失敗しました'}</p>
                    <Link
                        href="/pricing"
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold inline-block"
                    >
                        料金プランを確認
                    </Link>
                </div>
            </div>
        );
    }

    const { subscription, usageCount } = subscriptionData;
    const usagePercentage = getUsagePercentage();
    const daysUntilBilling = getDaysUntilBilling();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
                    >
                        ← アプリに戻る
                    </Link>
                    <h1 className="text-4xl font-bold mb-2">ダッシュボード</h1>
                    <p className="text-gray-300">サブスクリプション情報と使用状況</p>
                </div>

                {/* Subscription Status Card */}
                <div className="bg-gray-800 rounded-2xl p-8 mb-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">{subscription.plan.name} プラン</h2>
                            <div className="flex items-center space-x-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(subscription.status)}`}>
                                    {subscription.status}
                                </span>
                                {subscription.cancelAtPeriodEnd && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-500">
                                        キャンセル予定
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold">{formatPrice(subscription.plan.monthlyPrice)}</p>
                            <p className="text-sm text-gray-400">月額</p>
                        </div>
                    </div>

                    {/* Billing Period */}
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <p className="text-sm text-gray-400 mb-1">請求期間</p>
                            <p className="text-lg">
                                {formatDate(subscription.currentPeriodStart)} 〜{' '}
                                {formatDate(subscription.currentPeriodEnd)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 mb-1">次回請求日</p>
                            <p className="text-lg">
                                {formatDate(subscription.currentPeriodEnd)}
                                <span className="text-sm text-gray-400 ml-2">
                                    ({daysUntilBilling}日後)
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Usage Meter */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-gray-400">今月の使用量</p>
                            <p className="text-sm">
                                <span className="text-white font-semibold">{usageCount.toLocaleString()}</span>
                                <span className="text-gray-400">
                                    {' '}
                                    / {subscription.plan.maxRequestsPerMonth?.toLocaleString() || '無制限'} リクエスト
                                </span>
                            </p>
                        </div>

                        {/* Progress Bar */}
                        {subscription.plan.maxRequestsPerMonth !== null && (
                            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        usagePercentage >= 90
                                            ? 'bg-red-500'
                                            : usagePercentage >= 70
                                              ? 'bg-yellow-500'
                                              : 'bg-green-500'
                                    }`}
                                    style={{ width: `${usagePercentage}%` }}
                                ></div>
                            </div>
                        )}
                        {subscription.plan.maxRequestsPerMonth === null && (
                            <p className="text-sm text-green-400">無制限プラン</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleManageSubscription}
                            disabled={isManaging}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-wait px-6 py-3 rounded-lg font-semibold transition-all"
                        >
                            {isManaging ? '処理中...' : 'サブスクリプション管理'}
                        </button>
                        <Link
                            href="/pricing"
                            className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold text-center transition-all"
                        >
                            プラン変更
                        </Link>
                    </div>
                </div>

                {/* Plan Features */}
                <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
                    <h3 className="text-xl font-bold mb-4">プラン特典</h3>
                    <ul className="space-y-3">
                        {subscription.plan.maxRequestsPerMonth && (
                            <li className="flex items-start">
                                <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>月間 {subscription.plan.maxRequestsPerMonth.toLocaleString()} リクエスト</span>
                            </li>
                        )}
                        {subscription.plan.maxRequestsPerMonth === null && (
                            <li className="flex items-start">
                                <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>無制限リクエスト</span>
                            </li>
                        )}
                        {subscription.plan.maxFileSize && (
                            <li className="flex items-start">
                                <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>最大 {subscription.plan.maxFileSize}MB ファイルアップロード</span>
                            </li>
                        )}
                        {subscription.plan.name === 'PRO' && (
                            <>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <span>PROモード（思考プロセス表示）</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <span>画像生成（Imagen 4.0）</span>
                                </li>
                            </>
                        )}
                        {subscription.plan.name === 'ENTERPRISE' && (
                            <>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <span>すべてのPRO機能</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <span>動画生成（Veo 3.1）</span>
                                </li>
                                <li className="flex items-start">
                                    <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <span>専任サポート</span>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
