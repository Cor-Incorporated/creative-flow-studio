'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Admin Users Management Page
 *
 * Displays all users with subscription and usage statistics.
 * Allows filtering, searching, pagination, and role updates.
 *
 * Features:
 * - Search by email/name
 * - Filter by role, plan, status
 * - Pagination (limit/offset)
 * - Update user role (modal)
 * - View user details
 *
 * Protected by middleware.ts (ADMIN role required).
 *
 * References:
 * - docs/admin-api-design.md Phase 6 Step 3.1
 * - GET /api/admin/users
 */

type AdminUser = {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'PRO' | 'ENTERPRISE' | 'ADMIN';
    createdAt: string;
    subscription: {
        planName: string;
        status: string;
        currentPeriodEnd: string | null;
    } | null;
    usageStats: {
        totalRequests: number;
        currentMonthRequests: number;
    };
    lastActiveAt: string | null;
};

type UsersResponse = {
    users: AdminUser[];
    total: number;
    limit: number;
    offset: number;
};

type Filters = {
    search: string;
    role: string;
    plan: string;
    status: string;
    limit: number;
    offset: number;
};

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // State management
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters state
    const [filters, setFilters] = useState<Filters>({
        search: '',
        role: '',
        plan: '',
        status: '',
        limit: 20,
        offset: 0,
    });

    // Modal state
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRole, setNewRole] = useState<'USER' | 'PRO' | 'ENTERPRISE' | 'ADMIN'>('USER');
    const [isUpdating, setIsUpdating] = useState(false);

    // Fetch users from API
    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.push('/api/auth/signin?callbackUrl=/admin/users');
            return;
        }

        async function fetchUsers() {
            setIsLoading(true);
            setError(null);

            try {
                // Build query params (exclude empty values)
                const params: Record<string, string> = {
                    limit: filters.limit.toString(),
                    offset: filters.offset.toString(),
                };

                if (filters.search) params.search = filters.search;
                if (filters.role) params.role = filters.role;
                if (filters.plan) params.plan = filters.plan;
                if (filters.status) params.status = filters.status;

                const queryString = new URLSearchParams(params).toString();
                const response = await fetch(`/api/admin/users?${queryString}`);

                if (!response.ok) {
                    if (response.status === 403) {
                        setError('管理者権限が必要です');
                        return;
                    }
                    throw new Error(`Failed to fetch users: ${response.status}`);
                }

                const data: UsersResponse = await response.json();
                setUsers(data.users);
                setTotal(data.total);
            } catch (err: any) {
                console.error('Error fetching users:', err);
                setError(err.message || 'ユーザーの取得に失敗しました');
            } finally {
                setIsLoading(false);
            }
        }

        fetchUsers();
    }, [session, status, router, filters]);

    // Handle filter changes
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, search: e.target.value, offset: 0 }));
    };

    const handleRoleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, role: e.target.value, offset: 0 }));
    };

    const handlePlanFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, plan: e.target.value, offset: 0 }));
    };

    const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, status: e.target.value, offset: 0 }));
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

    // Modal handlers
    const openUpdateRoleModal = (user: AdminUser) => {
        setSelectedUser(user);
        setNewRole(user.role);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
        setIsUpdating(false);
    };

    const handleUpdateRole = async () => {
        if (!selectedUser) return;

        setIsUpdating(true);

        try {
            const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'ロール更新に失敗しました');
            }

            // Refresh users list
            setFilters(prev => ({ ...prev })); // Trigger useEffect
            closeModal();
            alert('ロールを更新しました');
        } catch (err: any) {
            console.error('Error updating role:', err);
            alert(`エラー: ${err.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    // Format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return '未設定';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    // Get role badge color
    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'ADMIN':
                return 'bg-red-100 text-red-800';
            case 'ENTERPRISE':
                return 'bg-purple-100 text-purple-800';
            case 'PRO':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-100 text-green-800';
            case 'TRIALING':
                return 'bg-yellow-100 text-yellow-800';
            case 'PAST_DUE':
                return 'bg-orange-100 text-orange-800';
            case 'CANCELED':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Calculate current page
    const currentPage = Math.floor(filters.offset / filters.limit) + 1;
    const totalPages = Math.ceil(total / filters.limit);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-3xl font-bold text-gray-900">ユーザー管理</h2>
                <p className="mt-1 text-sm text-gray-500">
                    全ユーザーの一覧、検索、フィルタリング、ロール更新
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            検索 (メール・名前)
                        </label>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={handleSearchChange}
                            placeholder="ユーザーを検索..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-900"
                        />
                    </div>

                    {/* Role Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ロール
                        </label>
                        <select
                            value={filters.role}
                            onChange={handleRoleFilter}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-900"
                        >
                            <option value="">全て</option>
                            <option value="USER">USER</option>
                            <option value="PRO">PRO</option>
                            <option value="ENTERPRISE">ENTERPRISE</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                    </div>

                    {/* Plan Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            プラン
                        </label>
                        <select
                            value={filters.plan}
                            onChange={handlePlanFilter}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-900"
                        >
                            <option value="">全て</option>
                            <option value="FREE">FREE</option>
                            <option value="PRO">PRO</option>
                            <option value="ENTERPRISE">ENTERPRISE</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ステータス
                        </label>
                        <select
                            value={filters.status}
                            onChange={handleStatusFilter}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-900"
                        >
                            <option value="">全て</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="TRIALING">TRIALING</option>
                            <option value="PAST_DUE">PAST_DUE</option>
                            <option value="CANCELED">CANCELED</option>
                            <option value="UNPAID">UNPAID</option>
                        </select>
                    </div>
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

            {/* Users Table */}
            {!isLoading && !error && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ユーザー
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ロール
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        プラン
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ステータス
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        使用量
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        最終アクティブ
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        操作
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                            ユーザーが見つかりません
                                        </td>
                                    </tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {user.name || '未設定'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                                                        user.role
                                                    )}`}
                                                >
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {user.subscription?.planName || '未登録'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {user.subscription ? (
                                                    <span
                                                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                                                            user.subscription.status
                                                        )}`}
                                                    >
                                                        {user.subscription.status}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div className="flex flex-col">
                                                    <span>
                                                        今月: {user.usageStats.currentMonthRequests.toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        合計: {user.usageStats.totalRequests.toLocaleString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(user.lastActiveAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => openUpdateRoleModal(user)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    ロール変更
                                                </button>
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

            {/* Update Role Modal */}
            {isModalOpen && selectedUser && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* Background overlay */}
                        <div
                            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                            onClick={closeModal}
                        ></div>

                        {/* Modal panel */}
                        <div className="relative inline-block align-bottom bg-white rounded-lg z-50 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                    ロール変更
                                </h3>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500">
                                        ユーザー: <span className="font-medium">{selectedUser.email}</span>
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        現在のロール:{' '}
                                        <span className="font-medium">{selectedUser.role}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        新しいロール
                                    </label>
                                    <select
                                        value={newRole}
                                        onChange={e =>
                                            setNewRole(
                                                e.target.value as 'USER' | 'PRO' | 'ENTERPRISE' | 'ADMIN'
                                            )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-900"
                                    >
                                        <option value="USER">USER</option>
                                        <option value="PRO">PRO</option>
                                        <option value="ENTERPRISE">ENTERPRISE</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    onClick={handleUpdateRole}
                                    disabled={isUpdating}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUpdating ? '更新中...' : '保存'}
                                </button>
                                <button
                                    onClick={closeModal}
                                    disabled={isUpdating}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
