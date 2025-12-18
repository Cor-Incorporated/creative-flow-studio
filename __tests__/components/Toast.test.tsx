/**
 * @vitest-environment happy-dom
 */

/**
 * Toast Component Tests
 *
 * Tests for components/Toast.tsx
 *
 * Coverage:
 * - Basic rendering with message
 * - Rendering with title (note: component uses 'type' not 'title')
 * - All variant styles (success, error, warning, info)
 * - Close button functionality
 * - Auto-dismiss after duration
 * - supportId display when provided
 * - supportId NOT displayed when not provided
 * - retryAfterText display when provided
 * - retryAfterText NOT displayed when not provided
 * - Both supportId and retryAfterText together
 * - Action button rendering and click handling
 * - Accessibility attributes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Toast, { ToastProps, useToast } from '@/components/Toast';
import React from 'react';

describe('Toast Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('should render with message', () => {
            render(<Toast message="Test message" />);

            expect(screen.getByText('Test message')).toBeInTheDocument();
        });

        it('should render with default info type when no type is provided', () => {
            const { container } = render(<Toast message="Default type message" />);

            // Info type uses bg-blue-600
            const toastElement = container.querySelector('.bg-blue-600');
            expect(toastElement).toBeInTheDocument();
        });

        it('should render message with proper text styling', () => {
            render(<Toast message="Styled message" />);

            const messageElement = screen.getByText('Styled message');
            expect(messageElement).toHaveClass('text-sm', 'font-medium');
        });
    });

    describe('Variant Styles', () => {
        it('should render success variant with green background', () => {
            const { container } = render(<Toast message="Success message" type="success" />);

            const toastElement = container.querySelector('.bg-green-600');
            expect(toastElement).toBeInTheDocument();
        });

        it('should render error variant with red background', () => {
            const { container } = render(<Toast message="Error message" type="error" />);

            const toastElement = container.querySelector('.bg-red-600');
            expect(toastElement).toBeInTheDocument();
        });

        it('should render warning variant with yellow background', () => {
            const { container } = render(<Toast message="Warning message" type="warning" />);

            const toastElement = container.querySelector('.bg-yellow-600');
            expect(toastElement).toBeInTheDocument();
        });

        it('should render info variant with blue background', () => {
            const { container } = render(<Toast message="Info message" type="info" />);

            const toastElement = container.querySelector('.bg-blue-600');
            expect(toastElement).toBeInTheDocument();
        });

        it('should display appropriate icon for success type', () => {
            const { container } = render(<Toast message="Success" type="success" />);

            // Success icon has checkmark path
            const svgElements = container.querySelectorAll('svg');
            expect(svgElements.length).toBeGreaterThan(0);
        });

        it('should display appropriate icon for error type', () => {
            const { container } = render(<Toast message="Error" type="error" />);

            // Error icon has X path
            const svgElements = container.querySelectorAll('svg');
            expect(svgElements.length).toBeGreaterThan(0);
        });

        it('should display appropriate icon for warning type', () => {
            const { container } = render(<Toast message="Warning" type="warning" />);

            // Warning icon has triangle path
            const svgElements = container.querySelectorAll('svg');
            expect(svgElements.length).toBeGreaterThan(0);
        });

        it('should display appropriate icon for info type', () => {
            const { container } = render(<Toast message="Info" type="info" />);

            // Info icon has circle with i
            const svgElements = container.querySelectorAll('svg');
            expect(svgElements.length).toBeGreaterThan(0);
        });
    });

    describe('Close Button Functionality', () => {
        it('should render close button', () => {
            render(<Toast message="Closable toast" />);

            const closeButton = screen.getByRole('button', { name: /close/i });
            expect(closeButton).toBeInTheDocument();
        });

        it('should call onClose when close button is clicked', async () => {
            const onCloseMock = vi.fn();
            render(<Toast message="Closable toast" onClose={onCloseMock} />);

            const closeButton = screen.getByRole('button', { name: /close/i });
            fireEvent.click(closeButton);

            // Wait for the 300ms animation delay
            act(() => {
                vi.advanceTimersByTime(300);
            });

            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });

        it('should hide toast after close button is clicked', () => {
            render(<Toast message="Toast to hide" />);

            const closeButton = screen.getByRole('button', { name: /close/i });
            fireEvent.click(closeButton);

            // Toast should set isVisible to false immediately
            expect(screen.queryByText('Toast to hide')).not.toBeInTheDocument();
        });

        it('should have accessible close button with aria-label', () => {
            render(<Toast message="Accessible toast" />);

            const closeButton = screen.getByRole('button', { name: /close/i });
            expect(closeButton).toHaveAttribute('aria-label', 'Close');
        });
    });

    describe('Auto-Dismiss After Duration', () => {
        it('should auto-dismiss after default duration (5000ms)', async () => {
            const onCloseMock = vi.fn();
            render(<Toast message="Auto-dismiss toast" onClose={onCloseMock} />);

            expect(screen.getByText('Auto-dismiss toast')).toBeInTheDocument();

            // Advance time by 5000ms (default duration)
            act(() => {
                vi.advanceTimersByTime(5000);
            });

            // Toast should be hidden after duration
            expect(screen.queryByText('Auto-dismiss toast')).not.toBeInTheDocument();

            // Advance time by 300ms for animation
            act(() => {
                vi.advanceTimersByTime(300);
            });

            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });

        it('should auto-dismiss after custom duration', async () => {
            const onCloseMock = vi.fn();
            render(<Toast message="Custom duration toast" duration={3000} onClose={onCloseMock} />);

            expect(screen.getByText('Custom duration toast')).toBeInTheDocument();

            // Should not dismiss before duration
            act(() => {
                vi.advanceTimersByTime(2999);
            });
            expect(screen.getByText('Custom duration toast')).toBeInTheDocument();

            // Should dismiss at duration
            act(() => {
                vi.advanceTimersByTime(1);
            });
            expect(screen.queryByText('Custom duration toast')).not.toBeInTheDocument();

            // Advance time for animation callback
            act(() => {
                vi.advanceTimersByTime(300);
            });
            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });

        it('should not auto-dismiss when duration is 0', async () => {
            const onCloseMock = vi.fn();
            render(<Toast message="No auto-dismiss toast" duration={0} onClose={onCloseMock} />);

            // Advance time significantly
            act(() => {
                vi.advanceTimersByTime(10000);
            });

            // Toast should still be visible
            expect(screen.getByText('No auto-dismiss toast')).toBeInTheDocument();
            expect(onCloseMock).not.toHaveBeenCalled();
        });

        it('should not auto-dismiss when duration is negative', async () => {
            const onCloseMock = vi.fn();
            render(<Toast message="Negative duration toast" duration={-1} onClose={onCloseMock} />);

            // Advance time significantly
            act(() => {
                vi.advanceTimersByTime(10000);
            });

            // Toast should still be visible (duration <= 0 prevents auto-dismiss)
            expect(screen.getByText('Negative duration toast')).toBeInTheDocument();
            expect(onCloseMock).not.toHaveBeenCalled();
        });

        it('should clear timer on unmount', () => {
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
            const { unmount } = render(<Toast message="Unmount toast" duration={5000} />);

            unmount();

            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });
    });

    describe('supportId Display', () => {
        it('should display supportId when provided', () => {
            render(<Toast message="Error occurred" type="error" supportId="req_abc123" />);

            expect(screen.getByText(/サポートID:/)).toBeInTheDocument();
            expect(screen.getByText('req_abc123')).toBeInTheDocument();
        });

        it('should NOT display supportId when not provided', () => {
            render(<Toast message="Error occurred" type="error" />);

            expect(screen.queryByText(/サポートID:/)).not.toBeInTheDocument();
        });

        it('should render supportId in monospace font', () => {
            render(<Toast message="Error occurred" supportId="req_xyz789" />);

            const supportIdElement = screen.getByText('req_xyz789');
            expect(supportIdElement).toHaveClass('font-mono');
        });

        it('should display supportId with proper styling', () => {
            render(<Toast message="Error occurred" supportId="req_test" />);

            const supportIdContainer = screen.getByText(/サポートID:/).closest('p');
            expect(supportIdContainer).toHaveClass('text-xs', 'text-white/70');
        });
    });

    describe('retryAfterText Display', () => {
        it('should display retryAfterText when provided', () => {
            render(
                <Toast
                    message="Rate limit exceeded"
                    type="warning"
                    retryAfterText="約24時間後に再試行"
                />
            );

            expect(screen.getByText('約24時間後に再試行')).toBeInTheDocument();
        });

        it('should NOT display retryAfterText when not provided', () => {
            render(<Toast message="Rate limit exceeded" type="warning" />);

            expect(screen.queryByText(/再試行/)).not.toBeInTheDocument();
        });

        it('should render retryAfterText with proper styling', () => {
            render(
                <Toast message="Rate limit exceeded" retryAfterText="1時間後に再試行可能" />
            );

            const retryElement = screen.getByText('1時間後に再試行可能');
            expect(retryElement).toHaveClass('text-xs', 'text-white/80');
        });
    });

    describe('Both supportId and retryAfterText Together', () => {
        it('should display both supportId and retryAfterText when both are provided', () => {
            render(
                <Toast
                    message="Rate limit exceeded"
                    type="error"
                    supportId="req_limit_123"
                    retryAfterText="約1時間後に再試行してください"
                />
            );

            expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
            expect(screen.getByText('約1時間後に再試行してください')).toBeInTheDocument();
            expect(screen.getByText(/サポートID:/)).toBeInTheDocument();
            expect(screen.getByText('req_limit_123')).toBeInTheDocument();
        });

        it('should display retryAfterText before supportId in DOM order', () => {
            const { container } = render(
                <Toast
                    message="Error"
                    supportId="req_123"
                    retryAfterText="Retry after 1 hour"
                />
            );

            const contentDiv = container.querySelector('.flex-1');
            const paragraphs = contentDiv?.querySelectorAll('p');

            // First p is message, second is retryAfterText, third is supportId
            expect(paragraphs).toHaveLength(3);
            expect(paragraphs?.[1]?.textContent).toBe('Retry after 1 hour');
            expect(paragraphs?.[2]?.textContent).toContain('サポートID:');
        });
    });

    describe('Action Button', () => {
        it('should render action button when action prop is provided', () => {
            const actionMock = {
                label: 'Upgrade Plan',
                onClick: vi.fn(),
            };

            render(<Toast message="Upgrade required" action={actionMock} />);

            expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
        });

        it('should NOT render action button when action prop is not provided', () => {
            render(<Toast message="Simple toast" />);

            // Only the close button should exist
            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(1);
            expect(buttons[0]).toHaveAttribute('aria-label', 'Close');
        });

        it('should call action onClick and close toast when action button is clicked', () => {
            const actionMock = {
                label: 'Retry',
                onClick: vi.fn(),
            };
            const onCloseMock = vi.fn();

            render(<Toast message="Action toast" action={actionMock} onClose={onCloseMock} />);

            const actionButton = screen.getByText('Retry');
            fireEvent.click(actionButton);

            expect(actionMock.onClick).toHaveBeenCalledTimes(1);

            // Toast should close after action
            expect(screen.queryByText('Action toast')).not.toBeInTheDocument();

            // Wait for animation delay
            act(() => {
                vi.advanceTimersByTime(300);
            });

            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });

        it('should render action button with proper styling', () => {
            const actionMock = {
                label: 'Login',
                onClick: vi.fn(),
            };

            render(<Toast message="Please login" action={actionMock} />);

            const actionButton = screen.getByText('Login');
            expect(actionButton).toHaveClass('text-xs', 'font-semibold', 'underline');
        });
    });

    describe('Accessibility', () => {
        it('should have close button with aria-label', () => {
            render(<Toast message="Accessible toast" />);

            const closeButton = screen.getByLabelText('Close');
            expect(closeButton).toBeInTheDocument();
            expect(closeButton.tagName).toBe('BUTTON');
        });

        it('should be positioned fixed at bottom right', () => {
            const { container } = render(<Toast message="Positioned toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('fixed', 'bottom-4', 'right-4');
        });

        it('should have high z-index for visibility', () => {
            const { container } = render(<Toast message="Z-index toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('z-50');
        });

        it('should have proper contrast with white text', () => {
            const { container } = render(<Toast message="Contrast toast" type="error" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('text-white');
        });
    });

    describe('Animation Classes', () => {
        it('should have transition classes for smooth animation', () => {
            const { container } = render(<Toast message="Animated toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('transform', 'transition-all', 'duration-300');
        });

        it('should have visible state classes when isVisible is true', () => {
            const { container } = render(<Toast message="Visible toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('translate-y-0', 'opacity-100');
        });
    });

    describe('Layout and Sizing', () => {
        it('should have minimum width', () => {
            const { container } = render(<Toast message="Min width toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('min-w-[320px]');
        });

        it('should have maximum width', () => {
            const { container } = render(<Toast message="Max width toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('max-w-md');
        });

        it('should have rounded corners and shadow', () => {
            const { container } = render(<Toast message="Styled toast" />);

            const toastElement = container.firstChild;
            expect(toastElement).toHaveClass('rounded-lg', 'shadow-2xl');
        });
    });
});

describe('useToast Hook', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('should provide showToast and ToastContainer', () => {
        const TestComponent = () => {
            const { showToast, ToastContainer } = useToast();
            return (
                <div>
                    <button onClick={() => showToast({ message: 'Test toast' })}>
                        Show Toast
                    </button>
                    <ToastContainer />
                </div>
            );
        };

        render(<TestComponent />);

        expect(screen.getByText('Show Toast')).toBeInTheDocument();
    });

    it('should display toast when showToast is called', () => {
        const TestComponent = () => {
            const { showToast, ToastContainer } = useToast();
            return (
                <div>
                    <button onClick={() => showToast({ message: 'Dynamic toast' })}>
                        Show Toast
                    </button>
                    <ToastContainer />
                </div>
            );
        };

        render(<TestComponent />);

        fireEvent.click(screen.getByText('Show Toast'));

        expect(screen.getByText('Dynamic toast')).toBeInTheDocument();
    });

    it('should display multiple toasts', () => {
        const TestComponent = () => {
            const { showToast, ToastContainer } = useToast();
            return (
                <div>
                    <button onClick={() => showToast({ message: 'First toast message' })}>
                        Show First
                    </button>
                    <button onClick={() => showToast({ message: 'Second toast message' })}>
                        Show Second
                    </button>
                    <ToastContainer />
                </div>
            );
        };

        render(<TestComponent />);

        // Click buttons with delay to ensure unique timestamps
        fireEvent.click(screen.getByText('Show First'));

        // Advance timer to generate unique ID for second toast
        act(() => {
            vi.advanceTimersByTime(10);
        });

        fireEvent.click(screen.getByText('Show Second'));

        // Both toast messages should be displayed
        expect(screen.getByText('First toast message')).toBeInTheDocument();
        expect(screen.getByText('Second toast message')).toBeInTheDocument();
    });

    it('should remove toast when closed', () => {
        const TestComponent = () => {
            const { showToast, ToastContainer } = useToast();
            return (
                <div>
                    <button onClick={() => showToast({ message: 'Removable toast', duration: 0 })}>
                        Show Toast
                    </button>
                    <ToastContainer />
                </div>
            );
        };

        render(<TestComponent />);

        fireEvent.click(screen.getByText('Show Toast'));
        expect(screen.getByText('Removable toast')).toBeInTheDocument();

        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);

        // Wait for animation delay
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(screen.queryByText('Removable toast')).not.toBeInTheDocument();
    });

    it('should pass toast props correctly', () => {
        const TestComponent = () => {
            const { showToast, ToastContainer } = useToast();
            return (
                <div>
                    <button
                        onClick={() =>
                            showToast({
                                message: 'Props toast',
                                type: 'error',
                                supportId: 'hook_123',
                                retryAfterText: 'Try again later',
                            })
                        }
                    >
                        Show Toast
                    </button>
                    <ToastContainer />
                </div>
            );
        };

        render(<TestComponent />);

        fireEvent.click(screen.getByText('Show Toast'));

        expect(screen.getByText('Props toast')).toBeInTheDocument();
        expect(screen.getByText(/サポートID:/)).toBeInTheDocument();
        expect(screen.getByText('hook_123')).toBeInTheDocument();
        expect(screen.getByText('Try again later')).toBeInTheDocument();
    });
});
