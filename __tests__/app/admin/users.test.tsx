/**
 * Admin Users Page Component Tests
 *
 * Tests for app/admin/users/page.tsx
 *
 * Coverage:
 * - Rendering with data
 * - Loading state
 * - Error state
 * - Search filter
 * - Role/Plan/Status filters
 * - Pagination
 * - Update Role modal
 */

import type { FetchMock } from 'vitest-fetch-mock';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMockUsers } from '@/__tests__/utils/test-helpers';

// Mock dependencies BEFORE importing the component
// Note: vi.mock() is hoisted, so we can't reference external variables in the factory
const mockUseSession = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

// Create stable router object to prevent useEffect infinite loop
const mockRouter = {
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    prefetch: vi.fn(),
};

vi.mock('next-auth/react', () => ({
    useSession: () => mockUseSession(),
    SessionProvider: ({ children }: any) => children,
}));

vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter, // Return stable reference
    usePathname: () => '/admin/users',
    useSearchParams: () => new URLSearchParams(),
}));

// Import component AFTER mocks
import UsersPage from '@/app/admin/users/page';

const fetchMock = fetch as unknown as FetchMock;

describe('Admin Users Page', () => {
    beforeEach(() => {
        // Reset session mock to authenticated ADMIN by default
        mockUseSession.mockReturnValue({
            data: {
                user: { id: 'admin_123', email: 'admin@example.com', role: 'ADMIN' },
                expires: '2025-12-31',
            },
            status: 'authenticated',
        });

        // Set default fetch response for all tests
        // This handles StrictMode re-renders and filter changes
        const defaultResponse = JSON.stringify({
            users: createMockUsers(3),
            total: 3,
            limit: 20,
            offset: 0,
        });
        fetchMock.mockResponse(defaultResponse, { headers: { 'Content-Type': 'application/json' } });
    });

    afterEach(() => {
        fetchMock.mockReset();
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render users table with data', async () => {
            // Arrange: Default fetch response is set in beforeEach
            // No need to mock fetch here - it will use the default response

            // Act
            render(<UsersPage />);

            // Assert: Should show loading initially
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();

            // Wait for loading to disappear
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Verify data is displayed
            expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            expect(screen.getByText('user2@example.com')).toBeInTheDocument();

            // Verify empty state is not shown
            expect(screen.queryByText(/ユーザーが見つかりません/i)).not.toBeInTheDocument();
        });

        it('should display loading state', () => {
            // Arrange: Mock fetch that never resolves (don't provide response)
            fetchMock.mockAbort();

            // Act
            render(<UsersPage />);

            // Assert
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
        });

        it('should display error message on fetch failure', async () => {
            // Arrange: Override default response with persistent error
            fetchMock.mockReject(new Error('Network error'));

            // Act
            render(<UsersPage />);

            // Assert - Wait for loading to disappear
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText(/エラー/i)).toBeInTheDocument();
            expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        });

        it('should display 403 error for non-ADMIN users', async () => {
            // Arrange: Override default response with persistent 403 error
            fetchMock.mockResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

            // Act
            render(<UsersPage />);

            // Assert - Wait for loading to disappear
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText(/管理者権限が必要です/i)).toBeInTheDocument();
        });

        it('should display empty state when no users found', async () => {
            // Arrange: Override default response with persistent empty response
            const emptyResponse = JSON.stringify({
                users: [],
                total: 0,
                limit: 20,
                offset: 0,
            });
            fetchMock.mockResponse(emptyResponse, { headers: { 'Content-Type': 'application/json' } });

            // Act
            render(<UsersPage />);

            // Assert - Wait for loading to disappear
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText(/ユーザーが見つかりません/i)).toBeInTheDocument();
        });
    });

    describe('Filters', () => {
        it('should update search filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText(/ユーザーを検索/i);
            fireEvent.change(searchInput, { target: { value: 'john' } });

            // Assert - Wait for re-fetch with search param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=john'));
                },
                { timeout: 3000 }
            );
        });

        it('should update role filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const selects = screen.getAllByRole('combobox');
            const roleSelect = selects.find(select =>
                select.closest('div')?.querySelector('label')?.textContent?.includes('ロール')
            ) || selects[0]; // Fallback to first select (Role filter)
            fireEvent.change(roleSelect, { target: { value: 'PRO' } });

            // Assert - Wait for re-fetch with role param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('role=PRO'));
                },
                { timeout: 3000 }
            );
        });

        it('should update plan filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const selects = screen.getAllByRole('combobox');
            const planSelect = selects.find(select =>
                select.closest('div')?.querySelector('label')?.textContent?.includes('プラン')
            ) || selects[1]; // Fallback to second select (Plan filter)
            fireEvent.change(planSelect, { target: { value: 'PRO' } });

            // Assert - Wait for re-fetch with plan param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('plan=PRO'));
                },
                { timeout: 3000 }
            );
        });
    });

    describe('Pagination', () => {
        it('should navigate to next page', async () => {
            // Arrange: Override default to show pagination (total > limit)
            fetchMock.mockResponse(
                JSON.stringify({
                    users: createMockUsers(3),
                    total: 50,
                    limit: 20,
                    offset: 0,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            // Find and click next button
            const nextButtons = screen.getAllByText(/次へ/i);
            fireEvent.click(nextButtons[0]);

            // Assert - Wait for re-fetch with offset param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=20'));
                },
                { timeout: 3000 }
            );
        });

        it('should navigate to previous page', async () => {
            // Arrange: Override default to show pagination at offset 20
            fetchMock.mockResponse(
                JSON.stringify({
                    users: createMockUsers(3),
                    total: 50,
                    limit: 20,
                    offset: 20,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            // Find and click prev button
            const prevButtons = screen.getAllByText(/前へ/i);
            fireEvent.click(prevButtons[0]);

            // Assert - Wait for re-fetch with offset param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=0'));
                },
                { timeout: 3000 }
            );
        });
    });

    describe('Update Role Modal', () => {
        it('should open update role modal when clicking button', async () => {
            // Arrange: Default fetch response handles initial load

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const updateButtons = screen.getAllByText(/ロール変更/i);
            fireEvent.click(updateButtons[0]);

            // Assert - Verify modal is displayed
            await waitFor(
                () => {
                    expect(screen.getByText(/新しいロール/i)).toBeInTheDocument();
                    expect(screen.getByText(/保存/i)).toBeInTheDocument();
                    expect(screen.getByText(/キャンセル/i)).toBeInTheDocument();
                },
                { timeout: 3000 }
            );
        });

        it('should update user role on save', async () => {
            // Arrange: Use default response for initial load
            // Note: PATCH request will also receive the default response (which is fine for this test)

            // Mock window.alert
            global.alert = vi.fn();

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const updateButtons = screen.getAllByText(/ロール変更/i);
            fireEvent.click(updateButtons[0]);

            await waitFor(
                () => {
                    expect(screen.getByText(/新しいロール/i)).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Find the select in the modal (there should only be one)
            const selects = screen.getAllByRole('combobox');
            const roleSelect = selects[selects.length - 1]; // Last select is in the modal
            fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });

            const saveButton = screen.getByText(/保存/i);
            fireEvent.click(saveButton);

            // Assert - Verify alert is shown
            await waitFor(
                () => {
                    expect(global.alert).toHaveBeenCalledWith('ロールを更新しました');
                },
                { timeout: 3000 }
            );

            // Verify PATCH was called with correct parameters
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/users/user_1'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ role: 'ADMIN' }),
                })
            );
        });

        it('should close modal on cancel', async () => {
            // Arrange: Default fetch response handles initial load

            // Act
            render(<UsersPage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const updateButtons = screen.getAllByText(/ロール変更/i);
            fireEvent.click(updateButtons[0]);

            await waitFor(
                () => {
                    expect(screen.getByText(/新しいロール/i)).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            const cancelButton = screen.getByText(/キャンセル/i);
            fireEvent.click(cancelButton);

            // Assert - Verify modal is closed
            await waitFor(
                () => {
                    expect(screen.queryByText(/新しいロール/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );
        });
    });
});
