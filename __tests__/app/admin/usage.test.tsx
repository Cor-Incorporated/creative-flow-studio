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

import type { FetchMock } from 'vitest-fetch-mock';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMockUsageLogs } from '@/__tests__/utils/test-helpers';

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
    usePathname: () => '/admin/usage',
    useSearchParams: () => new URLSearchParams(),
}));

// Import component AFTER mocks
import UsagePage from '@/app/admin/usage/page';

const fetchMock = fetch as unknown as FetchMock;

describe('Admin Usage Page', () => {
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
            logs: createMockUsageLogs(3),
            total: 3,
            limit: 50,
            offset: 0,
        });
        fetchMock.mockResponse(defaultResponse, { headers: { 'Content-Type': 'application/json' } });
    });

    afterEach(() => {
        fetchMock.mockReset();
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render usage logs table with data', async () => {
            // Arrange: Default fetch response is set in beforeEach

            // Act
            render(<UsagePage />);

            // Assert: Should show loading initially
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();

            // Wait for loading to disappear
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();
            expect(screen.getByText('user2@example.com')).toBeInTheDocument();
            expect(screen.getByText('user3@example.com')).toBeInTheDocument();
        });

        it('should display loading state', () => {
            // Arrange: Mock fetch that never resolves (don't provide response)
            fetchMock.mockAbort();

            // Act
            render(<UsagePage />);

            // Assert
            expect(screen.getByText(/読み込み中/i)).toBeInTheDocument();
        });

        it('should display error message on fetch failure', async () => {
            // Arrange: Override default response with persistent error
            fetchMock.mockReject(new Error('Network error'));

            // Act
            render(<UsagePage />);

            // Assert
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
            render(<UsagePage />);

            // Assert
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText(/管理者権限が必要です/i)).toBeInTheDocument();
        });

        it('should display empty state when no logs found', async () => {
            // Arrange: Override default response with persistent empty response
            const emptyResponse = JSON.stringify({
                logs: [],
                total: 0,
                limit: 50,
                offset: 0,
            });
            fetchMock.mockResponse(emptyResponse, { headers: { 'Content-Type': 'application/json' } });

            // Act
            render(<UsagePage />);

            // Assert
            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText(/ログが見つかりません/i)).toBeInTheDocument();
        });
    });

    describe('Filters', () => {
        it('should update userId filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsagePage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const userIdInput = screen.getByPlaceholderText(/ユーザー ID を入力/i);
            fireEvent.change(userIdInput, { target: { value: 'user_123' } });

            // Assert - Wait for re-fetch with userId param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(
                        expect.stringContaining('userId=user_123')
                    );
                },
                { timeout: 3000 }
            );
        });

        it('should update action filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsagePage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const selects = screen.getAllByRole('combobox');
            const actionSelect = selects.find(select =>
                select.closest('div')?.querySelector('label')?.textContent?.includes('アクション')
            ) || selects[0];
            fireEvent.change(actionSelect, { target: { value: 'chat' } });

            // Assert - Wait for re-fetch with action param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(
                        expect.stringContaining('action=chat')
                    );
                },
                { timeout: 3000 }
            );
        });

        it('should update resourceType filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsagePage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const selects = screen.getAllByRole('combobox');
            const resourceTypeSelect = selects.find(select =>
                select.closest('div')?.querySelector('label')?.textContent?.includes('リソースタイプ')
            ) || selects[1];
            fireEvent.change(resourceTypeSelect, { target: { value: 'gemini-2.5-flash' } });

            // Assert - Wait for re-fetch with resourceType param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(
                        expect.stringContaining('resourceType=gemini-2.5-flash')
                    );
                },
                { timeout: 3000 }
            );
        });

        it('should update date range filter and trigger fetch', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsagePage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            // Date inputs don't have role="textbox", so query by type
            const allInputs = screen.getByPlaceholderText(/ユーザー ID を入力/i)
                .parentElement?.parentElement?.querySelectorAll('input[type="date"]');
            const startDateInput = allInputs?.[0] as HTMLInputElement;
            if (startDateInput) {
                fireEvent.change(startDateInput, { target: { value: '2025-11-01' } });
            }

            // Assert - Wait for re-fetch with startDate param
            await waitFor(
                () => {
                    expect(fetch).toHaveBeenCalledWith(
                        expect.stringContaining('startDate=')
                    );
                },
                { timeout: 3000 }
            );
        });

        it('should reset all filters', async () => {
            // Arrange: Default fetch response handles all fetches

            // Act
            render(<UsagePage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const resetButton = screen.getByText(/フィルターをリセット/i);

            // Get current fetch call count before reset
            const callsBeforeReset = (fetch as Mock).mock.calls.length;

            fireEvent.click(resetButton);

            // Assert - Verify fetch was called at least once more after reset
            await waitFor(() => {
                expect((fetch as Mock).mock.calls.length).toBeGreaterThan(callsBeforeReset);
            }, { timeout: 3000 });
        });
    });

    describe('Pagination', () => {
        it('should navigate to next page', async () => {
            // Arrange: Override default to show pagination (total > limit)
            fetchMock.mockResponse(
                JSON.stringify({
                    logs: createMockUsageLogs(3),
                    total: 100,
                    limit: 50,
                    offset: 0,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );

            // Act
            render(<UsagePage />);

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
                    expect(fetch).toHaveBeenCalledWith(
                        expect.stringContaining('offset=50')
                    );
                },
                { timeout: 3000 }
            );
        });

        it('should navigate to previous page', async () => {
            // Arrange: Override default to show pagination at offset 50
            fetchMock.mockResponse(
                JSON.stringify({
                    logs: createMockUsageLogs(3),
                    total: 100,
                    limit: 50,
                    offset: 50,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );

            // Act
            render(<UsagePage />);

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
                    expect(fetch).toHaveBeenCalledWith(
                        expect.stringContaining('offset=0')
                    );
                },
                { timeout: 3000 }
            );
        });
    });

    describe('Metadata Expansion', () => {
        it('should expand and collapse metadata on click', async () => {
            // Arrange: Default fetch response handles initial load

            // Act
            render(<UsagePage />);

            await waitFor(
                () => {
                    expect(screen.queryByText(/読み込み中/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            expect(screen.getByText('user1@example.com')).toBeInTheDocument();

            const expandButtons = screen.getAllByText(/表示/i);
            fireEvent.click(expandButtons[0]);

            // Assert: Metadata should be visible
            await waitFor(
                () => {
                    expect(screen.getByText(/"mode"/i)).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            const collapseButton = screen.getByText(/隠す/i);
            fireEvent.click(collapseButton);

            // Assert: Metadata should be hidden
            await waitFor(
                () => {
                    expect(screen.queryByText(/"mode"/i)).not.toBeInTheDocument();
                },
                { timeout: 3000 }
            );
        });
    });
});
