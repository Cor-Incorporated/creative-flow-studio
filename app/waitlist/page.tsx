'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MAX_PAID_USERS } from '@/lib/constants';

type WaitlistStats = {
    paidUsersCount: number;
    maxPaidUsers: number;
    availableSlots: number;
    waitlistCount: number;
    isCapacityReached: boolean;
};

export default function WaitlistPage() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [position, setPosition] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<WaitlistStats | null>(null);

    // Fetch current stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch('/api/waitlist');
                if (response.ok) {
                    const data = await response.json();
                    setStats(data.stats);
                }
            } catch (err) {
                console.error('Failed to fetch waitlist stats:', err);
            }
        };
        fetchStats();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name: name || undefined }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    // Already on waitlist
                    setPosition(data.position);
                    setIsSubmitted(true);
                } else if (response.status === 400 && data.availableSlots > 0) {
                    // Capacity not reached - redirect to pricing
                    window.location.href = '/pricing';
                    return;
                } else {
                    setError(data.error || 'エラーが発生しました');
                }
                return;
            }

            setPosition(data.position);
            setIsSubmitted(true);
        } catch (err) {
            setError('ネットワークエラーが発生しました。もう一度お試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Creative Flow Studio
                        </h1>
                    </Link>
                    <p className="text-gray-400">
                        AI-powered creative tools
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 shadow-xl border border-gray-700">
                    {!isSubmitted ? (
                        <>
                            {/* Capacity Info */}
                            <div className="mb-6">
                                <div className="flex items-center justify-center mb-4">
                                    <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                        <svg
                                            className="w-8 h-8 text-yellow-500"
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
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white text-center mb-2">
                                    現在、定員に達しています
                                </h2>
                                <p className="text-gray-400 text-center text-sm">
                                    有料プランは現在{MAX_PAID_USERS.toLocaleString()}名限定です。
                                    空きが出次第、メールでお知らせします。
                                </p>
                            </div>

                            {/* Stats */}
                            {stats && (
                                <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div>
                                            <div className="text-2xl font-bold text-white">
                                                {stats.paidUsersCount.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-400">現在のユーザー数</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-500">
                                                {stats.waitlistCount.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-400">待機中の方</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        メールアドレス <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="your@email.com"
                                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        お名前（任意）
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="山田 太郎"
                                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                                        <p className="text-red-400 text-sm">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                                >
                                    {isLoading ? '登録中...' : 'ウェイトリストに登録'}
                                </button>
                            </form>

                            <p className="text-xs text-gray-500 text-center mt-4">
                                登録したメールアドレスに空き情報をお送りします。
                                いつでも登録をキャンセルできます。
                            </p>
                        </>
                    ) : (
                        /* Success State */
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg
                                    className="w-8 h-8 text-green-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                登録完了
                            </h2>
                            <p className="text-gray-400 mb-6">
                                ウェイトリストに登録しました。
                                空きが出次第、メールでお知らせします。
                            </p>

                            {position && (
                                <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
                                    <div className="text-sm text-gray-400 mb-1">あなたの順番</div>
                                    <div className="text-4xl font-bold text-blue-400">
                                        #{position.toLocaleString()}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Link
                                    href="/"
                                    className="block w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-center"
                                >
                                    ホームに戻る
                                </Link>
                                <p className="text-xs text-gray-500">
                                    登録メールアドレス: {email}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6">
                    <Link href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
                        料金プランを確認する
                    </Link>
                </div>
            </div>
        </div>
    );
}
