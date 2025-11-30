'use client';

import React from 'react';
import { signIn } from 'next-auth/react';
import { SparklesIcon } from './icons';
import Link from 'next/link';

/**
 * Landing Page Component
 * 
 * Displays a hero section with login/signup CTA for unauthenticated users.
 * Shows after authentication is complete.
 * 
 * Features:
 * - Hero section with value proposition
 * - Google OAuth login button
 * - Pricing page link
 * - Feature highlights
 */

export default function LandingPage() {
    const handleGoogleSignIn = () => {
        signIn('google', { callbackUrl: window.location.href });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            {/* Header */}
            <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-8 h-8 text-blue-400" />
                            <h1 className="text-2xl font-bold">クリエイティブフロースタジオ</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/pricing"
                                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                            >
                                料金プラン
                            </Link>
                            <button
                                onClick={handleGoogleSignIn}
                                className="px-6 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            >
                                Googleでログイン
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-16">
                    <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        AIで創造性を解き放つ
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                        Google Gemini を活用したマルチモーダル AI アプリケーション。
                        チャット、画像生成、動画生成を一つのプラットフォームで。
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleGoogleSignIn}
                            className="px-8 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg"
                        >
                            Googleで始める
                        </button>
                        <Link
                            href="/pricing"
                            className="px-8 py-4 text-lg font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                        >
                            料金を見る
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">チャットモード</h3>
                        <p className="text-gray-400">
                            AI と自然な会話で、質問に答えたり、アイデアを出し合ったりできます。
                        </p>
                    </div>

                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">画像生成</h3>
                        <p className="text-gray-400">
                            Imagen 4.0 を使用して、テキストから高品質な画像を生成できます。
                        </p>
                    </div>

                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center mb-4">
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">動画生成</h3>
                        <p className="text-gray-400">
                            Veo 3.1 を使用して、テキストから動画を生成できます。
                        </p>
                    </div>
                </div>

                {/* Pricing CTA */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center">
                    <h3 className="text-3xl font-bold mb-4">今すぐ始めましょう</h3>
                    <p className="text-lg text-blue-100 mb-6">
                        FREE プランから始めて、必要に応じてアップグレードできます
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleGoogleSignIn}
                            className="px-8 py-4 text-lg font-semibold bg-white text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Googleでログイン
                        </button>
                        <Link
                            href="/pricing"
                            className="px-8 py-4 text-lg font-semibold bg-transparent border-2 border-white text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            料金プランを確認
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}


