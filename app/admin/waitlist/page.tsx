'use client';

import { useState, useEffect, useCallback } from 'react';

type WaitlistEntry = {
    id: string;
    email: string;
    name: string | null;
    status: string;
    position: number | null;
    notifiedAt: Date | null;
    createdAt: string;
};

type WaitlistStats = {
    paidUsersCount: number;
    maxPaidUsers: number;
    availableSlots: number;
    waitlistCount: number;
    isCapacityReached: boolean;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待機中', color: 'bg-yellow-100 text-yellow-800' },
    NOTIFIED: { label: '通知済み', color: 'bg-blue-100 text-blue-800' },
    CONVERTED: { label: '登録完了', color: 'bg-green-100 text-green-800' },
    EXPIRED: { label: '期限切れ', color: 'bg-gray-100 text-gray-800' },
    CANCELLED: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
};

export default function AdminWaitlistPage() {
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [stats, setStats] = useState<WaitlistStats | null>(null);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(0);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const limit = 20;

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: String(limit),
                offset: String(page * limit),
            });
            if (statusFilter) {
                params.set('status', statusFilter);
            }

            const response = await fetch(`/api/admin/waitlist?${params}`);
            if (response.ok) {
                const data = await response.json();
                setEntries(data.entries);
                setTotal(data.total);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch waitlist:', error);
        } finally {
            setIsLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleNotify = async (count: number) => {
        if (!confirm(`${count}名に通知を送信しますか？`)) return;

        setActionLoading(true);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'notify', count }),
            });
            const data = await response.json();
            if (response.ok) {
                setMessage({ type: 'success', text: data.message });
                fetchData();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'エラーが発生しました' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleExpire = async () => {
        if (!confirm('期限切れの通知を処理しますか？')) return;

        setActionLoading(true);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'expire' }),
            });
            const data = await response.json();
            if (response.ok) {
                setMessage({ type: 'success', text: data.message });
                fetchData();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'エラーが発生しました' });
        } finally {
            setActionLoading(false);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-3xl font-bold text-gray-900">Waitlist Management</h2>
                <p className="mt-1 text-sm text-gray-500">
                    ウェイトリストの管理と通知
                </p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">有料ユーザー数</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.paidUsersCount.toLocaleString()} / {stats.maxPaidUsers.toLocaleString()}
                        </div>
                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{
                                    width: `${(stats.paidUsersCount / stats.maxPaidUsers) * 100}%`,
                                }}
                            />
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">空き枠</div>
                        <div className="text-2xl font-bold text-green-600">
                            {stats.availableSlots.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">待機中</div>
                        <div className="text-2xl font-bold text-yellow-600">
                            {stats.waitlistCount.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">ステータス</div>
                        <div
                            className={`text-2xl font-bold ${
                                stats.isCapacityReached ? 'text-red-600' : 'text-green-600'
                            }`}
                        >
                            {stats.isCapacityReached ? '定員' : '受付中'}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">アクション</h3>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => handleNotify(1)}
                        disabled={actionLoading || (stats?.availableSlots || 0) === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        次の1名に通知
                    </button>
                    <button
                        onClick={() => handleNotify(5)}
                        disabled={actionLoading || (stats?.availableSlots || 0) < 5}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        次の5名に通知
                    </button>
                    <button
                        onClick={() => handleNotify(stats?.availableSlots || 0)}
                        disabled={actionLoading || (stats?.availableSlots || 0) === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        空き枠分を通知 ({stats?.availableSlots || 0}名)
                    </button>
                    <button
                        onClick={handleExpire}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400"
                    >
                        期限切れを処理
                    </button>
                </div>

                {message && (
                    <div
                        className={`mt-4 p-3 rounded-md ${
                            message.type === 'success'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                        }`}
                    >
                        {message.text}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">ステータス:</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(0);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                    >
                        <option value="">すべて</option>
                        <option value="PENDING">待機中</option>
                        <option value="NOTIFIED">通知済み</option>
                        <option value="CONVERTED">登録完了</option>
                        <option value="EXPIRED">期限切れ</option>
                        <option value="CANCELLED">キャンセル</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    順番
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    メールアドレス
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    名前
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ステータス
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    登録日
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    通知日
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        読み込み中...
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        データがありません
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {entry.position ? `#${entry.position}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {entry.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {entry.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    STATUS_LABELS[entry.status]?.color || 'bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                {STATUS_LABELS[entry.status]?.label || entry.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(entry.createdAt).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {entry.notifiedAt
                                                ? new Date(entry.notifiedAt).toLocaleDateString('ja-JP')
                                                : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            {total}件中 {page * limit + 1}-{Math.min((page + 1) * limit, total)}件
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 text-gray-900"
                            >
                                前へ
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-900">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 text-gray-900"
                            >
                                次へ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
