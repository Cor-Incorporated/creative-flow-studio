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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMockUsers } from '@/__tests__/utils/test-helpers';

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
    usePathname: () => '/admin/users',
    useSearchParams: () => new URLSearchParams(),
}));

// Import component AFTER mocks
import UsersPage from '@/app/admin/users/page';

describe('Admin Users Page', () => {
    let mockFetch: any;

    beforeEach(() => {
        // Reset fetch mock before each test with default successful response
        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
                users: [],
                total: 0,
                limit: 20,
                offset: 0,
            }),
        });
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
        it('should render users table with data', async () => {
            // Arrange
            const mockUsers = createMockUsers(3);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 3,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            // Assert: Should show loading initially
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();

            // Wait for data to load and loading to disappear
            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
                expect(screen.getByText('user2@example.com')).toBeInTheDocument();
                expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
            });

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/admin/users')
            );

            // Verify empty state is not shown
            expect(screen.queryByText(/ユーザーが見つかりません/i)).not.toBeInTheDocument();
        });

        it('should display loading state', () => {
            // Arrange: Mock fetch that never resolves
            mockFetch.mockReturnValue(new Promise(() => {}));

            // Act
            render(<UsersPage />);

            // Assert
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
        });

        it('should display error message on fetch failure', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error('Network error'));

            // Act
            render(<UsersPage />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/エラー/i)).toBeInTheDocument();
                expect(screen.getByText(/Network error/i)).toBeInTheDocument();
            });
        });

        it('should display 403 error for non-ADMIN users', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: false,
                status: 403,
                json: vi.fn().mockResolvedValue({ error: 'Forbidden' }),
            });

            // Act
            render(<UsersPage />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/管理者権限が必要です/i)).toBeInTheDocument();
            });
        });

        it('should display empty state when no users found', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: [],
                    total: 0,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/ユーザーが見つかりません/i)).toBeInTheDocument();
            });
        });
    });

    describe('Filters', () => {
        it('should update search filter and trigger fetch', async () => {
            // Arrange
            const mockUsers = createMockUsers(1);

            // Mock fetch to return users initially, then empty after filter
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 1,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText(/ユーザーを検索/i);
            fireEvent.change(searchInput, { target: { value: 'john' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('search=john')
                );
            });
        });

        it('should update role filter and trigger fetch', async () => {
            // Arrange
            const mockUsers = createMockUsers(1);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 1,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const roleSelect = screen.getByLabelText(/ロール/i);
            fireEvent.change(roleSelect, { target: { value: 'PRO' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('role=PRO')
                );
            });
        });

        it('should update plan filter and trigger fetch', async () => {
            // Arrange
            const mockUsers = createMockUsers(1);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 1,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const planSelect = screen.getByLabelText(/プラン/i);
            fireEvent.change(planSelect, { target: { value: 'PRO' } });

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('plan=PRO')
                );
            });
        });
    });

    describe('Pagination', () => {
        it('should navigate to next page', async () => {
            // Arrange
            const mockUsers = createMockUsers(3);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 50,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            // Find and click next button
            const nextButtons = screen.getAllByText(/次へ/i);
            fireEvent.click(nextButtons[0]);

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('offset=20')
                );
            });
        });

        it('should navigate to previous page', async () => {
            // Arrange
            const mockUsers = createMockUsers(3);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 50,
                    limit: 20,
                    offset: 20,
                }),
            });

            // Act
            render(<UsersPage />);

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

    describe('Update Role Modal', () => {
        it('should open update role modal when clicking button', async () => {
            // Arrange
            const mockUsers = createMockUsers(1);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 1,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const updateButton = screen.getByText(/ロール変更/i);
            fireEvent.click(updateButton);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/新しいロール/i)).toBeInTheDocument();
                expect(screen.getByText(/保存/i)).toBeInTheDocument();
                expect(screen.getByText(/キャンセル/i)).toBeInTheDocument();
            });
        });

        it('should update user role on save', async () => {
            // Arrange
            const mockUsers = createMockUsers(1);
            // Mock fetch to handle both GET (users list) and PATCH (update role) requests
            mockFetch.mockImplementation((url: string, options?: any) => {
                if (options?.method === 'PATCH') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: vi.fn().mockResolvedValue({
                            user: { ...mockUsers[0], role: 'ADMIN' },
                        }),
                    });
                }
                // Default: GET users list
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({
                        users: mockUsers,
                        total: 1,
                        limit: 20,
                        offset: 0,
                    }),
                });
            });

            // Mock window.alert
            global.alert = vi.fn();

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const updateButton = screen.getByText(/ロール変更/i);
            fireEvent.click(updateButton);

            await waitFor(() => {
                expect(screen.getByText(/新しいロール/i)).toBeInTheDocument();
            });

            const roleSelect = screen.getByLabelText(/新しいロール/i) as HTMLSelectElement;
            fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });

            const saveButton = screen.getByText(/保存/i);
            fireEvent.click(saveButton);

            // Assert
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/admin/users/user_1'),
                    expect.objectContaining({
                        method: 'PATCH',
                        body: JSON.stringify({ role: 'ADMIN' }),
                    })
                );
                expect(global.alert).toHaveBeenCalledWith('ロールを更新しました');
            });
        });

        it('should close modal on cancel', async () => {
            // Arrange
            const mockUsers = createMockUsers(1);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue({
                    users: mockUsers,
                    total: 1,
                    limit: 20,
                    offset: 0,
                }),
            });

            // Act
            render(<UsersPage />);

            await waitFor(() => {
                expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            });

            const updateButton = screen.getByText(/ロール変更/i);
            fireEvent.click(updateButton);

            await waitFor(() => {
                expect(screen.getByText(/新しいロール/i)).toBeInTheDocument();
            });

            const cancelButton = screen.getByText(/キャンセル/i);
            fireEvent.click(cancelButton);

            // Assert
            await waitFor(() => {
                expect(screen.queryByText(/新しいロール/i)).not.toBeInTheDocument();
            });
        });
    });
});
