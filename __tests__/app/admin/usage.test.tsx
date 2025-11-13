/**
 * Admin Usage Page Component Tests
 *
 * Tests for app/admin/usage/page.tsx
 *
 * Coverage:
 * - Rendering with data
 * - Loading state
 * - Error state
 * - UserId/Action/ResourceType filters
 * - Date range filter
 * - Pagination
 * - Metadata expansion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMockUsageLogs } from '@/__tests__/utils/test-helpers';

// Mock dependencies BEFORE importing the component
// Note: vi.mock() is hoisted, so we can't reference external variables in the factory
const mockUseSession = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

vi.mock('next-auth/react', () => ({
    useSession: () => mockUseSession(),
    SessionProvider: ({ children }: any) => children,
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: mockBack,
        prefetch: vi.fn(),
    }),
    usePathname: () => '/admin/usage',
    useSearchParams: () => new URLSearchParams(),
}));

// Import component AFTER mocks
import UsagePage from '@/app/admin/usage/page';

describe('Admin Usage Page', () => {
    let mockFetch: any;

    beforeEach(() => {
        // Reset fetch mock before each test
        mockFetch = vi.fn();
        global.fetch = mockFetch;

        // Reset session mock to authenticated ADMIN by default
        mockUseSession.mockReturnValue({
            data: {
                user: { id: 'admin_123', email: 'admin@example.com', role: 'ADMIN' },
                expires: '2025-12-31',
            },
            status: 'authenticated',
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render usage logs table with data', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(3);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    logs: mockLogs,
                    total: 3,
                    limit: 50,
                    offset: 0,
                }),
            });

            // Act
            render(<UsagePage />);

            // Assert: Should show loading initially
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();

            // Wait for data to load
            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            expect(screen.getByText('user2@example.com')).toBeInTheDocument();
            expect(screen.getByText('user3@example.com')).toBeInTheDocument();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/usage')
            );
        });

        it('should display loading state', () => {
            // Arrange: Mock fetch that never resolves
            mockFetch.mockReturnValue(new Promise(() => {}));

            // Act
            render(<UsagePage />);

            // Assert
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
        });

        it('should display error message on fetch failure', async () => {
            // Arrange
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            // Act
            render(<UsagePage />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/エラー/i)).toBeInTheDocument();
                expect(screen.getByText(/Network error/i)).toBeInTheDocument();
            });
        });

        it('should display 403 error for non-ADMIN users', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: 'Forbidden' }),
            });

            // Act
            render(<UsagePage />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/管理者権限が必要です/i)).toBeInTheDocument();
            });
        });

        it('should display empty state when no logs found', async () => {
            // Arrange
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    logs: [],
                    total: 0,
                    limit: 50,
                    offset: 0,
                }),
            });

            // Act
            render(<UsagePage />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/ログが見つかりません/i)).toBeInTheDocument();
            });
        });
    });

    describe('Filters', () => {
        it('should update userId filter and trigger fetch', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(1);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: [], total: 0, limit: 50, offset: 0 }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const userIdInput = screen.getByPlaceholderText(/ユーザー ID を入力/i);
            fireEvent.change(userIdInput, { target: { value: 'user_123' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('userId=user_123')
                );
            });
        });

        it('should update action filter and trigger fetch', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(1);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: [], total: 0, limit: 50, offset: 0 }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const actionSelect = screen.getByLabelText(/アクション/i);
            fireEvent.change(actionSelect, { target: { value: 'chat' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('action=chat')
                );
            });
        });

        it('should update resourceType filter and trigger fetch', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(1);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: [], total: 0, limit: 50, offset: 0 }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const resourceTypeSelect = screen.getByLabelText(/リソースタイプ/i);
            fireEvent.change(resourceTypeSelect, { target: { value: 'gemini-2.5-flash' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('resourceType=gemini-2.5-flash')
                );
            });
        });

        it('should update date range filter and trigger fetch', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(1);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: [], total: 0, limit: 50, offset: 0 }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const startDateInput = screen.getByLabelText(/開始日/i);
            fireEvent.change(startDateInput, { target: { value: '2025-11-01' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('startDate=')
                );
            });
        });

        it('should reset all filters', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(1);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const resetButton = screen.getByText(/フィルターをリセット/i);
            fireEvent.click(resetButton);

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Pagination', () => {
        it('should navigate to next page', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(3);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 100, limit: 50, offset: 0 }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        logs: mockLogs,
                        total: 100,
                        limit: 50,
                        offset: 50,
                    }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            // Find and click next button
            const nextButtons = screen.getAllByText(/次へ/i);
            fireEvent.click(nextButtons[0]);

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('offset=50')
                );
            });
        });

        it('should navigate to previous page', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(3);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        logs: mockLogs,
                        total: 100,
                        limit: 50,
                        offset: 50,
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ logs: mockLogs, total: 100, limit: 50, offset: 0 }),
                });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            // Find and click prev button
            const prevButtons = screen.getAllByText(/前へ/i);
            fireEvent.click(prevButtons[0]);

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('offset=0')
                );
            });
        });
    });

    describe('Metadata Expansion', () => {
        it('should expand and collapse metadata on click', async () => {
            // Arrange
            const mockLogs = createMockUsageLogs(1);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ logs: mockLogs, total: 1, limit: 50, offset: 0 }),
            });

            // Act
            render(<UsagePage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const expandButton = screen.getByText(/表示/i);
            fireEvent.click(expandButton);

            // Assert: Metadata should be visible
            await waitFor(() => {
                expect(screen.getByText(/"mode"/i)).toBeInTheDocument();
            });

            const collapseButton = screen.getByText(/隠す/i);
            fireEvent.click(collapseButton);

            // Assert: Metadata should be hidden
            await waitFor(() => {
                expect(screen.queryByText(/"mode"/i)).not.toBeInTheDocument();
            });
        });
    });
});
