import { MAX_PAID_USERS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

/**
 * Admin Dashboard - Overview Page
 *
 * Displays key metrics and system status.
 * Server Component (fetches data directly).
 *
 * Protected by middleware.ts (ADMIN role required).
 *
 * References:
 * - docs/implementation-plan.md Phase 6
 */

// Force dynamic rendering to avoid build-time database connection errors
export const dynamic = 'force-dynamic';

async function getStats() {
    const [
        totalUsers,
        totalConversations,
        totalMessages,
        totalSubscriptions,
        activeSubscriptions,
        usageLogsToday,
        waitlistPending,
        paidUsersCount,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.conversation.count(),
        prisma.message.count(),
        prisma.subscription.count(),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.usageLog.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        }),
        prisma.waitlist.count({ where: { status: 'PENDING' } }),
        // Count paid users: active subscriptions with non-FREE plans, excluding ADMIN users
        prisma.subscription.count({
            where: {
                status: 'ACTIVE',
                AND: [
                    {
                        plan: {
                            name: { not: 'FREE' },
                        },
                    },
                    {
                        user: {
                            role: { not: 'ADMIN' },
                        },
                    },
                ],
            },
        }),
    ]);

    const subscriptionsByPlan = await prisma.subscription.groupBy({
        by: ['planId'],
        _count: true,
        where: { status: 'ACTIVE' },
    });

    const plans = await prisma.plan.findMany({
        select: { id: true, name: true },
    });

    const planStats = subscriptionsByPlan.map(sub => {
        const plan = plans.find(p => p.id === sub.planId);
        return {
            planName: plan?.name || 'Unknown',
            count: sub._count,
        };
    });

    return {
        totalUsers,
        totalConversations,
        totalMessages,
        totalSubscriptions,
        activeSubscriptions,
        usageLogsToday,
        planStats,
        waitlistPending,
        paidUsersCount,
        maxPaidUsers: MAX_PAID_USERS,
        capacityPercent: Math.round((paidUsersCount / MAX_PAID_USERS) * 100),
    };
}

export default async function AdminDashboardPage() {
    try {
        const stats = await getStats();

        return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-3xl font-bold text-gray-900">Overview</h2>
                <p className="mt-1 text-sm text-gray-500">
                    System statistics and key metrics
                </p>
            </div>

            {/* Capacity Alert */}
            {stats.capacityPercent >= 90 && (
                <div className={`rounded-lg p-4 ${stats.capacityPercent >= 100 ? 'bg-red-100 border border-red-300' : 'bg-yellow-100 border border-yellow-300'}`}>
                    <div className="flex items-center">
                        <svg className={`w-5 h-5 mr-2 ${stats.capacityPercent >= 100 ? 'text-red-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className={`font-medium ${stats.capacityPercent >= 100 ? 'text-red-800' : 'text-yellow-800'}`}>
                            {stats.capacityPercent >= 100
                                ? `定員に達しました (${stats.waitlistPending}名が待機中)`
                                : `定員の${stats.capacityPercent}%に達しています`}
                        </span>
                    </div>
                </div>
            )}

            {/* Capacity Progress */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">有料ユーザー容量</h3>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">
                        {stats.paidUsersCount.toLocaleString()} / {stats.maxPaidUsers.toLocaleString()} ユーザー
                    </span>
                    <span className={`text-sm font-medium ${stats.capacityPercent >= 100 ? 'text-red-600' : stats.capacityPercent >= 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {stats.capacityPercent}%
                    </span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${stats.capacityPercent >= 100 ? 'bg-red-500' : stats.capacityPercent >= 90 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(stats.capacityPercent, 100)}%` }}
                    />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                        空き: {(stats.maxPaidUsers - stats.paidUsersCount).toLocaleString()}枠
                    </span>
                    <span className="text-yellow-600">
                        待機中: {stats.waitlistPending.toLocaleString()}名
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Total Users */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-blue-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">
                                    Total Users
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">
                                    {stats.totalUsers.toLocaleString()}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>

                {/* Active Subscriptions */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">
                                    Active Subscriptions
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">
                                    {stats.activeSubscriptions.toLocaleString()}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>

                {/* Today's Usage */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-purple-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">
                                    API Calls Today
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">
                                    {stats.usageLogsToday.toLocaleString()}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>

                {/* Total Conversations */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-yellow-600"
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
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">
                                    Total Conversations
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">
                                    {stats.totalConversations.toLocaleString()}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>

                {/* Total Messages */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">
                                    Total Messages
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">
                                    {stats.totalMessages.toLocaleString()}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>

                {/* Total Subscriptions */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-indigo-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">
                                    Total Subscriptions
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">
                                    {stats.totalSubscriptions.toLocaleString()}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscriptions by Plan */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Active Subscriptions by Plan
                </h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Plan
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Active Users
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats.planStats.map(stat => (
                                <tr key={stat.planName}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {stat.planName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {stat.count.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a
                        href="/admin/users"
                        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center"
                    >
                        View All Users
                    </a>
                    <a
                        href="/admin/usage"
                        className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center"
                    >
                        View Usage Logs
                    </a>
                    <a
                        href="/api/admin/stats"
                        target="_blank"
                        className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center"
                    >
                        View API Stats
                    </a>
                </div>
            </div>
        </div>
        );
    } catch (error: any) {
        console.error('Error in AdminDashboardPage:', error);
        
        return (
            <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-red-900 mb-2">エラーが発生しました</h2>
                    <p className="text-red-700 mb-4">
                        ダッシュボードのデータを読み込めませんでした。
                    </p>
                    <details className="text-sm text-red-600">
                        <summary className="cursor-pointer font-medium">エラー詳細</summary>
                        <pre className="mt-2 p-3 bg-red-100 rounded overflow-auto">
                            {error.message || String(error)}
                        </pre>
                    </details>
                    <div className="mt-4">
                        <a
                            href="/admin"
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block"
                        >
                            再読み込み
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}
