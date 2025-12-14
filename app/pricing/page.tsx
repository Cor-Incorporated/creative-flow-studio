'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

/**
 * Pricing Page
 *
 * Displays subscription plans and handles Stripe Checkout flow.
 *
 * Features:
 * - 3 pricing tiers: FREE, PRO, ENTERPRISE
 * - Current plan indication for authenticated users
 * - Stripe Checkout integration
 * - Feature comparison table
 *
 * References:
 * - docs/stripe-integration-plan.md Phase 1.2
 * - Stripe Checkout: https://docs.stripe.com/checkout
 */

interface PricingPlan {
    name: string;
    price: string;
    priceId?: string;
    features: string[];
    maxRequests?: string;
    popular?: boolean;
}

// Pricing based on Google Gemini API costs (2024-2025):
// - Gemini 2.5 Flash: $0.30/1M input, $2.50/1M output tokens
// - Gemini 2.5 Pro: $1.25/1M input, $10/1M output tokens
// - Imagen 4 Standard: $0.04/image
// - Veo 3.1 Fast: $0.15/second (~$1.20 for 8s video)
const PRICING_PLANS: PricingPlan[] = [
    {
        name: 'FREE',
        price: '¥0',
        features: [
            'チャットモード',
            '検索モード',
            '月50リクエスト',
            '最大5MBファイル',
            'コミュニティサポート',
        ],
        maxRequests: '50/月',
    },
    {
        name: 'PRO',
        price: '¥3,000',
        priceId: undefined, // Fetched from database dynamically
        features: [
            'すべてのFREE機能',
            'PROモード（思考プロセス表示）',
            '画像生成（Imagen 4.0）',
            '月500リクエスト',
            '最大50MBファイル',
            '優先サポート',
        ],
        maxRequests: '500リクエスト/月',
        popular: true,
    },
    {
        name: 'ENTERPRISE',
        price: '¥30,000',
        priceId: undefined, // Fetched from database dynamically
        features: [
            'すべてPRO機能',
            '動画生成（Veo 3.1）',
            '月3,000リクエスト',
            '動画生成 月50本',
            '最大500MBファイル',
            'カスタムブランディング',
            '専任サポート',
            'SLA保証',
        ],
        maxRequests: '3,000/月 + 動画50本',
    },
];

export default function PricingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>(PRICING_PLANS);

    // Fetch Stripe Price IDs from database on mount
    useEffect(() => {
        async function fetchPriceIds() {
            try {
                const response = await fetch("/api/plans");
                if (response.ok) {
                    const plans = await response.json();
                    const updatedPlans = PRICING_PLANS.map(basePlan => {
                        const dbPlan = plans.find((p: any) => p.name === basePlan.name);
                        return { ...basePlan, priceId: dbPlan?.stripePriceId || undefined };
                    });
                    setPricingPlans(updatedPlans);
                }
            } catch (error) {
                console.error("Failed to fetch price IDs:", error);
            }
        }
        fetchPriceIds();
    }, []);

    const handleSubscribe = async (priceId: string | undefined, planName: string) => {
        if (!priceId || (typeof priceId === "string" && priceId.includes("CHANGE_ME"))) {
            alert("このプランは現在準備中です。しばらくお待ちください。");
            return;
        }

        if (!session) {
            router.push('/api/auth/signin?callbackUrl=/pricing');
            return;
        }

        setIsLoading(planName);

        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create checkout session');
            }

            const { url } = await response.json();

            // Redirect to Stripe Checkout
            window.location.href = url;
        } catch (error: any) {
            console.error('Error creating checkout session:', error);
            alert(`エラーが発生しました: ${error.message}`);
            setIsLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
                {/* Back to Chat Button */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        チャットに戻る
                    </button>
                </div>

                {/* Header */}
                <div className="text-center mb-10 sm:mb-16">
                    <h1 className="text-3xl sm:text-5xl font-bold mb-3 sm:mb-4">料金プラン</h1>
                    <p className="text-base sm:text-xl text-gray-300">
                        あなたのニーズに合ったプランを選択してください
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-16">
                    {pricingPlans.map(plan => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl p-8 ${
                                plan.popular
                                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 shadow-2xl scale-105'
                                    : 'bg-gray-800 border border-gray-700'
                            }`}
                        >
                            {/* Popular Badge */}
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-yellow-500 text-black text-sm font-bold px-4 py-1 rounded-full">
                                        人気
                                    </span>
                                </div>
                            )}

                            {/* Plan Name */}
                            <h2 className="text-2xl font-bold mb-4">{plan.name}</h2>

                            {/* Price */}
                            <div className="mb-6">
                                <span className="text-4xl font-bold">{plan.price}</span>
                                <span className="text-gray-300 ml-2">/月</span>
                            </div>

                            {/* Max Requests */}
                            <p className="text-sm text-gray-300 mb-6">{plan.maxRequests}</p>

                            {/* Subscribe Button */}
                            <button
                                onClick={() => handleSubscribe(plan.priceId, plan.name)}
                                disabled={isLoading === plan.name || plan.name === 'FREE'}
                                className={`w-full py-3 rounded-lg font-semibold mb-6 transition-all ${
                                    plan.name === 'FREE'
                                        ? 'bg-gray-600 cursor-not-allowed'
                                        : plan.popular
                                          ? 'bg-white text-blue-600 hover:bg-gray-100'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                } ${isLoading === plan.name ? 'opacity-50 cursor-wait' : ''}`}
                            >
                                {isLoading === plan.name
                                    ? '処理中...'
                                    : plan.name === 'FREE'
                                      ? '現在のプラン'
                                      : 'アップグレード'}
                            </button>

                            {/* Features */}
                            <ul className="space-y-3">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start">
                                        <svg
                                            className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Feature Comparison Table */}
                <div className="mt-10 sm:mt-16 bg-gray-800 rounded-2xl p-4 sm:p-8">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">機能比較表</h2>

                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <table className="w-full text-left text-sm sm:text-base min-w-[500px]">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="py-3 sm:py-4 px-3 sm:px-6">機能</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 text-center">FREE</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 text-center">PRO</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 text-center">ENTERPRISE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">月間リクエスト数</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">50</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">500</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">3,000</td>
                                </tr>
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">月間動画生成数</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">-</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">-</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">50本</td>
                                </tr>
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">最大ファイルサイズ</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">5MB</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">50MB</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">500MB</td>
                                </tr>
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">PROモード</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">-</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">✓</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">✓</td>
                                </tr>
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">画像生成</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">-</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">✓</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">✓</td>
                                </tr>
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">動画生成</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">-</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">-</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">✓</td>
                                </tr>
                                <tr>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6">サポート</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">コミュニティ</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">優先</td>
                                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">専任</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-10 sm:mt-16 text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">よくある質問</h2>
                    <p className="text-gray-300 mb-6 sm:mb-8 text-sm sm:text-base">
                        ご不明な点がございましたら、お気軽にお問い合わせください。
                    </p>
                    <button className="bg-blue-600 hover:bg-blue-700 px-6 sm:px-8 py-3 rounded-lg font-semibold text-sm sm:text-base">
                        お問い合わせ
                    </button>
                </div>
            </div>
        </div>
    );
}
