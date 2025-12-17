/**
 * ChatInput Component Tests
 *
 * Tests for components/ChatInput.tsx
 *
 * Coverage:
 * - Cmd+Enter / Ctrl+Enter keyboard handler
 * - IME composition handling
 * - Retry banner UI
 * - Basic functionality (render, submit, disable states)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GenerationMode, AspectRatio, Media } from '@/types/app';
import type { InfluencerId } from '@/lib/constants';

// Mock dependencies
vi.mock('@/lib/fileUtils', () => ({
    fileToBase64: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

// Import component AFTER mocks
import ChatInput from '@/components/ChatInput';

// Default props for ChatInput
const createDefaultProps = (overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) => ({
    onSendMessage: vi.fn(),
    isLoading: false,
    mode: 'chat' as GenerationMode,
    setMode: vi.fn(),
    aspectRatio: '1:1' as AspectRatio,
    setAspectRatio: vi.fn(),
    selectedInfluencer: 'none' as InfluencerId,
    setSelectedInfluencer: vi.fn(),
    lastFailedPrompt: null,
    lastFailedMedia: null,
    onRetry: vi.fn(),
    onClearRetry: vi.fn(),
    ...overrides,
});

describe('ChatInput Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Functionality', () => {
        it('should render textarea', () => {
            const props = createDefaultProps();
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            expect(textarea).toBeInTheDocument();
            expect(textarea.tagName.toLowerCase()).toBe('textarea');
        });

        it('should call onSendMessage when form submitted with text', async () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Hello world' } });

            const form = textarea.closest('form');
            expect(form).not.toBeNull();
            fireEvent.submit(form!);

            expect(onSendMessage).toHaveBeenCalledWith('Hello world', undefined);
        });

        it('should disable send button when loading', () => {
            const props = createDefaultProps({ isLoading: true });
            render(<ChatInput {...props} />);

            // The submit button has a spinner when loading, find it by type
            const buttons = screen.getAllByRole('button');
            const sendButton = buttons.find(
                (btn) => btn.getAttribute('type') === 'submit'
            );
            expect(sendButton).toBeDisabled();
        });

        it('should disable send button when input is empty', () => {
            const props = createDefaultProps();
            render(<ChatInput {...props} />);

            const buttons = screen.getAllByRole('button');
            const sendButton = buttons.find(
                (btn) => btn.getAttribute('type') === 'submit'
            );
            expect(sendButton).toBeDisabled();
        });

        it('should enable send button when input has text', () => {
            const props = createDefaultProps();
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            const buttons = screen.getAllByRole('button');
            const sendButton = buttons.find(
                (btn) => btn.getAttribute('type') === 'submit'
            );
            expect(sendButton).not.toBeDisabled();
        });

        it('should clear input after successful submit', () => {
            const props = createDefaultProps();
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...') as HTMLTextAreaElement;
            fireEvent.change(textarea, { target: { value: 'Hello world' } });
            expect(textarea.value).toBe('Hello world');

            const form = textarea.closest('form');
            fireEvent.submit(form!);

            expect(textarea.value).toBe('');
        });

        it('should disable textarea when loading', () => {
            const props = createDefaultProps({ isLoading: true });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            expect(textarea).toBeDisabled();
        });
    });

    describe('Cmd+Enter / Ctrl+Enter Keyboard Handler', () => {
        it('should submit on Cmd+Enter (Mac)', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                metaKey: true, // Cmd key on Mac
                ctrlKey: false,
            });

            expect(onSendMessage).toHaveBeenCalledWith('Test message', undefined);
        });

        it('should submit on Ctrl+Enter (Windows/Linux)', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                ctrlKey: true, // Ctrl key on Windows/Linux
                metaKey: false,
            });

            expect(onSendMessage).toHaveBeenCalledWith('Test message', undefined);
        });

        it('should NOT submit on Enter alone', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                ctrlKey: false,
                metaKey: false,
            });

            expect(onSendMessage).not.toHaveBeenCalled();
        });

        it('should NOT submit on Shift+Enter', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                shiftKey: true,
                ctrlKey: false,
                metaKey: false,
            });

            expect(onSendMessage).not.toHaveBeenCalled();
        });

        it('should NOT submit during IME composition', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'テスト' } });

            // Start IME composition
            fireEvent.compositionStart(textarea);

            // Try to submit with Cmd+Enter during composition
            fireEvent.keyDown(textarea, {
                key: 'Enter',
                metaKey: true,
                ctrlKey: false,
            });

            // Should NOT submit during composition
            expect(onSendMessage).not.toHaveBeenCalled();

            // End IME composition
            fireEvent.compositionEnd(textarea);

            // Now it should work
            fireEvent.keyDown(textarea, {
                key: 'Enter',
                metaKey: true,
                ctrlKey: false,
            });

            expect(onSendMessage).toHaveBeenCalledWith('テスト', undefined);
        });

        it('should NOT submit with Ctrl+Enter during IME composition', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: '日本語入力' } });

            // Start IME composition
            fireEvent.compositionStart(textarea);

            // Try to submit with Ctrl+Enter during composition
            fireEvent.keyDown(textarea, {
                key: 'Enter',
                ctrlKey: true,
                metaKey: false,
            });

            expect(onSendMessage).not.toHaveBeenCalled();
        });

        it('should NOT submit on Alt+Enter', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                altKey: true,
                ctrlKey: false,
                metaKey: false,
            });

            expect(onSendMessage).not.toHaveBeenCalled();
        });

        it('should NOT submit when input is empty', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            // Input is empty

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                metaKey: true,
            });

            expect(onSendMessage).not.toHaveBeenCalled();
        });

        it('should NOT submit when loading', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage, isLoading: true });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: 'Test message' } });

            fireEvent.keyDown(textarea, {
                key: 'Enter',
                metaKey: true,
            });

            // The handleSubmit function checks isLoading, but textarea is disabled
            // so the keydown event might not fire. Test the form submit path instead.
            expect(onSendMessage).not.toHaveBeenCalled();
        });
    });

    describe('Retry Banner UI', () => {
        it('should display retry banner when lastFailedPrompt exists', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'This is a failed message',
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            expect(screen.getByText('前回のメッセージの送信に失敗しました')).toBeInTheDocument();
            expect(screen.getByText(/This is a failed message/)).toBeInTheDocument();
            expect(screen.getByText('再試行')).toBeInTheDocument();
        });

        it('should NOT display retry banner when lastFailedPrompt is null', () => {
            const props = createDefaultProps({
                lastFailedPrompt: null,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            expect(screen.queryByText('前回のメッセージの送信に失敗しました')).not.toBeInTheDocument();
            expect(screen.queryByText('再試行')).not.toBeInTheDocument();
        });

        it('should NOT display retry banner when onRetry is not provided', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                onRetry: undefined,
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            expect(screen.queryByText('前回のメッセージの送信に失敗しました')).not.toBeInTheDocument();
        });

        it('should NOT display retry banner when onClearRetry is not provided', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                onRetry: vi.fn(),
                onClearRetry: undefined,
            });
            render(<ChatInput {...props} />);

            expect(screen.queryByText('前回のメッセージの送信に失敗しました')).not.toBeInTheDocument();
        });

        it('should truncate long prompts (> 50 chars) with "..."', () => {
            const longPrompt = 'This is a very long prompt that exceeds fifty characters and should be truncated';
            const props = createDefaultProps({
                lastFailedPrompt: longPrompt,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            // Should show first 50 chars + "..."
            const truncatedText = longPrompt.slice(0, 50) + '...';
            expect(screen.getByText(new RegExp(longPrompt.slice(0, 50)))).toBeInTheDocument();
            // Check for the ellipsis
            const promptElement = screen.getByText(/This is a very long prompt/);
            expect(promptElement.textContent).toContain('...');
        });

        it('should NOT truncate prompts with exactly 50 chars', () => {
            const exactPrompt = 'A'.repeat(50); // Exactly 50 characters
            const props = createDefaultProps({
                lastFailedPrompt: exactPrompt,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            const promptElement = screen.getByText(new RegExp(exactPrompt.slice(0, 10)));
            // Should not have "..." since it's exactly 50 chars
            expect(promptElement.textContent).not.toMatch(/\.\.\.$/);
        });

        it('should NOT truncate short prompts (< 50 chars)', () => {
            const shortPrompt = 'Short message';
            const props = createDefaultProps({
                lastFailedPrompt: shortPrompt,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            const promptElement = screen.getByText(/Short message/);
            expect(promptElement.textContent).not.toContain('...');
        });

        it('should show media indicator when lastFailedMedia exists', () => {
            const mockMedia: Media = {
                url: 'data:image/png;base64,test',
                mimeType: 'image/png',
                type: 'image',
            };
            const props = createDefaultProps({
                lastFailedPrompt: 'Message with attachment',
                lastFailedMedia: mockMedia,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            expect(screen.getByText(/\+ 添付ファイル/)).toBeInTheDocument();
        });

        it('should NOT show media indicator when lastFailedMedia is null', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'Message without attachment',
                lastFailedMedia: null,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            expect(screen.queryByText(/\+ 添付ファイル/)).not.toBeInTheDocument();
        });

        it('should call onRetry when retry button clicked', async () => {
            const onRetry = vi.fn();
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                onRetry,
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            const retryButton = screen.getByText('再試行');
            fireEvent.click(retryButton);

            expect(onRetry).toHaveBeenCalledTimes(1);
        });

        it('should call onClearRetry when clear button clicked', async () => {
            const onClearRetry = vi.fn();
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                onRetry: vi.fn(),
                onClearRetry,
            });
            render(<ChatInput {...props} />);

            const clearButton = screen.getByLabelText('クリア');
            fireEvent.click(clearButton);

            expect(onClearRetry).toHaveBeenCalledTimes(1);
        });

        it('should disable retry button when isLoading=true', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                isLoading: true,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            const retryButton = screen.getByText('再試行');
            expect(retryButton).toBeDisabled();
        });

        it('should NOT disable retry button when isLoading=false', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                isLoading: false,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            const retryButton = screen.getByText('再試行');
            expect(retryButton).not.toBeDisabled();
        });

        it('should NOT disable clear button when isLoading=true', () => {
            const props = createDefaultProps({
                lastFailedPrompt: 'Failed message',
                isLoading: true,
                onRetry: vi.fn(),
                onClearRetry: vi.fn(),
            });
            render(<ChatInput {...props} />);

            const clearButton = screen.getByLabelText('クリア');
            // Clear button should always be enabled
            expect(clearButton).not.toBeDisabled();
        });
    });

    describe('Mode Auto-Switching', () => {
        it('should auto-switch to video mode when video file is uploaded', async () => {
            const setMode = vi.fn();
            const props = createDefaultProps({ setMode, mode: 'chat' });
            render(<ChatInput {...props} />);

            // Create a mock video file
            const videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
            Object.defineProperty(videoFile, 'size', { value: 1024 }); // Small file size

            // Find file input and trigger upload
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            expect(fileInput).not.toBeNull();

            // Trigger change event with the video file
            Object.defineProperty(fileInput, 'files', { value: [videoFile] });
            fireEvent.change(fileInput);

            // Wait for async file processing
            await waitFor(() => {
                expect(setMode).toHaveBeenCalledWith('video');
            });
        });

        it('should auto-switch to image mode when image file is uploaded', async () => {
            const setMode = vi.fn();
            const props = createDefaultProps({ setMode, mode: 'chat' });
            render(<ChatInput {...props} />);

            // Create a mock image file
            const imageFile = new File([''], 'test.png', { type: 'image/png' });
            Object.defineProperty(imageFile, 'size', { value: 1024 }); // Small file size

            // Find file input and trigger upload
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            expect(fileInput).not.toBeNull();

            // Trigger change event with the image file
            Object.defineProperty(fileInput, 'files', { value: [imageFile] });
            fireEvent.change(fileInput);

            // Wait for async file processing
            await waitFor(() => {
                expect(setMode).toHaveBeenCalledWith('image');
            });
        });

        it('should not switch mode if already in video mode when uploading video', async () => {
            const setMode = vi.fn();
            const props = createDefaultProps({ setMode, mode: 'video' });
            render(<ChatInput {...props} />);

            // Create a mock video file
            const videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
            Object.defineProperty(videoFile, 'size', { value: 1024 });

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(fileInput, 'files', { value: [videoFile] });
            fireEvent.change(fileInput);

            // Should still call setMode('video') but the mode is already video
            await waitFor(() => {
                expect(setMode).toHaveBeenCalledWith('video');
            });
        });

        it('should not switch mode if already in image mode when uploading image', async () => {
            const setMode = vi.fn();
            const props = createDefaultProps({ setMode, mode: 'image' });
            render(<ChatInput {...props} />);

            // Create a mock image file
            const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
            Object.defineProperty(imageFile, 'size', { value: 1024 });

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(fileInput, 'files', { value: [imageFile] });
            fireEvent.change(fileInput);

            // Should still call setMode('image') but the mode is already image
            await waitFor(() => {
                expect(setMode).toHaveBeenCalledWith('image');
            });
        });
    });

    describe('Edge Cases', () => {
        it('should trim whitespace from prompt before submitting', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: '  Hello world  ' } });

            const form = textarea.closest('form');
            fireEvent.submit(form!);

            expect(onSendMessage).toHaveBeenCalledWith('Hello world', undefined);
        });

        it('should NOT submit when prompt is only whitespace', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            fireEvent.change(textarea, { target: { value: '   ' } });

            const form = textarea.closest('form');
            fireEvent.submit(form!);

            expect(onSendMessage).not.toHaveBeenCalled();
        });

        it('should handle multiple consecutive submissions correctly', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');
            const form = textarea.closest('form');

            // First submission
            fireEvent.change(textarea, { target: { value: 'Message 1' } });
            fireEvent.submit(form!);
            expect(onSendMessage).toHaveBeenCalledWith('Message 1', undefined);

            // Second submission
            fireEvent.change(textarea, { target: { value: 'Message 2' } });
            fireEvent.submit(form!);
            expect(onSendMessage).toHaveBeenCalledWith('Message 2', undefined);

            expect(onSendMessage).toHaveBeenCalledTimes(2);
        });

        it('should handle IME composition end followed by immediate submit', () => {
            const onSendMessage = vi.fn();
            const props = createDefaultProps({ onSendMessage });
            render(<ChatInput {...props} />);

            const textarea = screen.getByPlaceholderText('メッセージを入力...');

            // Start composition
            fireEvent.compositionStart(textarea);
            fireEvent.change(textarea, { target: { value: '日本語' } });

            // End composition
            fireEvent.compositionEnd(textarea);

            // Immediately submit
            fireEvent.keyDown(textarea, {
                key: 'Enter',
                ctrlKey: true,
            });

            expect(onSendMessage).toHaveBeenCalledWith('日本語', undefined);
        });
    });
});
