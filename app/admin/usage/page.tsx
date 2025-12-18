'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Admin Usage Logs Page
 *
 * Displays all usage logs with filtering and pagination.
 * Allows monitoring API usage by user, action, resource type, and date range.
 *
 * Features:
 * - Filter by userId, action, resourceType, date range
 * - Pagination (limit/offset)
 * - View usage metadata
 *
 * Protected by middleware.ts (ADMIN role required).
 *
 * References:
 * - docs/admin-api-design.md Phase 6 Step 3.2
 * - GET /api/admin/usage
 */

type UsageLog = {
    id: string;
    userId: string;
    userEmail: string;
    action: string;
    resourceType: string | null;
    metadata: any;
    createdAt: string;
};

type UsageResponse = {
    logs: UsageLog[];
    total: number;
    limit: number;
    offset: number;
};

type Filters = {
    userId: string;
    action: string;
    resourceType: string;
    startDate: string;
    endDate: string;
    limit: number;
    offset: number;
};

export default function AdminUsagePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // State management
    const [logs, setLogs] = useState<UsageLog[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters state
    const [filters, setFilters] = useState<Filters>({
        userId: '',
        action: '',
        resourceType: '',
        startDate: '',
        endDate: '',
        limit: 50,
        offset: 0,
    });

    // Expanded metadata state
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Fetch usage logs from API
    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/api/auth/signin?callbackUrl=/admin/usage');
            return;
        }

        async function fetchUsageLogs() {
            setIsLoading(true);
            setError(null);

            try {
                // Build query params (exclude empty values)
                const params: Record<string, string> = {
                    limit: filters.limit.toString(),
                    offset: filters.offset.toString(),
                };

                if (filters.userId) params.userId = filters.userId;
                if (filters.action) params.action = filters.action;
                if (filters.resourceType) params.resourceType = filters.resourceType;
                if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
                if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();

                const queryString = new URLSearchParams(params).toString();
                const response = await fetch(`/api/admin/usage?${queryString}`);

                if (!response.ok) {
                    if (response.status === 403) {
                        setError('管理者権限が必要です');
                        return;
                    }
                    throw new Error(`Failed to fetch usage logs: ${response.status}`);
                }

                const data: UsageResponse = await response.json();
                setLogs(data.logs);
                setTotal(data.total);
            } catch (err: any) {
                console.error('Error fetching usage logs:', err);
                setError(err.message || '使用ログの取得に失敗しました');
            } finally {
                setIsLoading(false);
            }
        }

        fetchUsageLogs();
    }, [session, status, router, filters]);

    // Handle filter changes
    const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, userId: e.target.value, offset: 0 }));
    };

    const handleActionFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, action: e.target.value, offset: 0 }));
    };

    const handleResourceTypeFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, resourceType: e.target.value, offset: 0 }));
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, startDate: e.target.value, offset: 0 }));
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, endDate: e.target.value, offset: 0 }));
    };

    const handleResetFilters = () => {
        setFilters({
            userId: '',
            action: '',
            resourceType: '',
            startDate: '',
            endDate: '',
            limit: 50,
            offset: 0,
        });
    };

    // Pagination handlers
    const handlePrevPage = () => {
        setFilters(prev => ({
            ...prev,
            offset: Math.max(0, prev.offset - prev.limit),
        }));
    };

    const handleNextPage = () => {
        setFilters(prev => ({
            ...prev,
            offset: prev.offset + prev.limit,
        }));
    };

    // Toggle metadata expansion
    const toggleMetadata = (logId: string) => {
        setExpandedLogId(expandedLogId === logId ? null : logId);
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(date);
    };

    // Get action badge color
    const getActionBadgeColor = (action: string) => {
        if (action.includes('chat')) return 'bg-blue-100 text-blue-800';
        if (action.includes('image')) return 'bg-purple-100 text-purple-800';
        if (action.includes('video')) return 'bg-red-100 text-red-800';
        if (action.includes('search')) return 'bg-green-100 text-green-800';
        return 'bg-gray-100 text-gray-800';
    };

    // Calculate current page
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;
    const totalPages = Math.ceil(total / filters.limit);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-3xl font-bold text-gray-900">使用ログ監視</h2>
                <p className="mt-1 text-sm text-gray-500">
                    API 使用ログの一覧、フィルタリング、日付範囲検索
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {/* User ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ユーザー ID
                        </label>
                        <input
                            type="text"
                            value={filters.userId}
                            onChange={handleUserIdChange}
                            placeholder="ユーザー ID を入力..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                        />
                    </div>

                    {/* Action Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            アクション
                        </label>
                        <select
                            value={filters.action}
                            onChange={handleActionFilter}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        >
                            <option value="">全て</option>
                            <option value="chat">chat</option>
                            <option value="image_generation">image_generation</option>
                            <option value="video_generation">video_generation</option>
                            <option value="search">search</option>
                        </select>
                    </div>

                    {/* Resource Type Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            リソースタイプ
                        </label>
                        <select
                            value={filters.resourceType}
                            onChange={handleResourceTypeFilter}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        >
                            <option value="">全て</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                            <option value="imagen-4.0">imagen-4.0</option>
                            <option value="veo-3.1-fast">veo-3.1-fast</option>
                        </select>
                    </div>

                    {/* Start Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            開始日
                        </label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={handleStartDateChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            終了日
                        </label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={handleEndDateChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        />
                    </div>
                </div>

                {/* Reset Filters Button */}
                <div>
                    <button
                        onClick={handleResetFilters}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                        フィルターをリセット
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">読み込み中...</p>
                </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">エラー: {error}</p>
                </div>
            )}

            {/* Usage Logs Table */}
            {!isLoading && !error && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        日時
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ユーザー
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        アクション
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        リソース
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        メタデータ
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                            ログが見つかりません
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatDate(log.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <div className="text-sm text-gray-900">{log.userEmail}</div>
                                                    <div className="text-xs text-gray-500">{log.userId}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeColor(
                                                        log.action
                                                    )}`}
                                                >
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {log.resourceType || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {log.metadata ? (
                                                    <div>
                                                        <button
                                                            onClick={() => toggleMetadata(log.id)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                        >
                                                            {expandedLogId === log.id ? '隠す' : '表示'}
                                                        </button>
                                                        {expandedLogId === log.id && (
                                                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                                                {JSON.stringify(log.metadata, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={handlePrevPage}
                                disabled={filters.offset === 0}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                前へ
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={filters.offset + filters.limit >= total}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                次へ
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    全 <span className="font-medium">{total}</span> 件中{' '}
                                    <span className="font-medium">{filters.offset + 1}</span> -{' '}
                                    <span className="font-medium">
                                        {Math.min(filters.offset + filters.limit, total)}
                                    </span>{' '}
                                    件を表示 (ページ {currentPage} / {totalPages})
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={filters.offset === 0}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">前へ</span>
                                        <svg
                                            className="h-5 w-5"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={filters.offset + filters.limit >= total}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">次へ</span>
                                        <svg
                                            className="h-5 w-5"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
