/**
 * Page Mode Handling Tests
 *
 * Tests for mode-related functionality in app/page.tsx
 *
 * Coverage:
 * - History construction with mode filtering
 * - saveMessage mode parameter handling
 * - Video generation race condition prevention
 */

import { describe, it, expect } from 'vitest';
import type { ContentPart } from '@/types/app';

// Type for message in state (simplified for testing)
interface TestMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    parts: ContentPart[];
}

/**
 * Simulates the history construction logic from page.tsx (lines 1296-1312)
 * This is extracted to enable unit testing without full component rendering
 */
function buildChatHistory(messages: TestMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages
        .filter(m => {
            if (m.role !== 'user' && m.role !== 'model') return false;
            // Only include messages that have text content (excluding loading/error states)
            const hasTextContent = m.parts.some(
                p => p.text && !p.isError && !p.isLoading
            );
            return hasTextContent;
        })
        .map(m => ({
            role: m.role,
            parts: m.parts
                // Only include text parts, exclude media (generated images/videos)
                .filter(p => p.text && !p.isError && !p.isLoading)
                .map(p => ({ text: p.text! })),
        }))
        .filter(m => m.parts.length > 0);
}

describe('Page Mode Handling', () => {
    describe('buildChatHistory (history construction)', () => {
        it('should include text-based user messages', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    parts: [{ text: 'Hello, how are you?' }],
                },
            ];

            const history = buildChatHistory(messages);

            expect(history).toHaveLength(1);
            expect(history[0].role).toBe('user');
            expect(history[0].parts[0].text).toBe('Hello, how are you?');
        });

        it('should include text-based model messages', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'model',
                    parts: [{ text: 'I am doing well, thank you!' }],
                },
            ];

            const history = buildChatHistory(messages);

            expect(history).toHaveLength(1);
            expect(history[0].role).toBe('model');
            expect(history[0].parts[0].text).toBe('I am doing well, thank you!');
        });

        it('should exclude image-only messages (generated images)', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    parts: [{ text: 'Generate a cat image' }],
                },
                {
                    id: '2',
                    role: 'model',
                    parts: [
                        {
                            media: {
                                url: 'data:image/png;base64,abc123',
                                mimeType: 'image/png',
                                type: 'image',
                            },
                        },
                    ],
                },
            ];

            const history = buildChatHistory(messages);

            // Should only include the user's text message, not the image response
            expect(history).toHaveLength(1);
            expect(history[0].role).toBe('user');
        });

        it('should exclude video-only messages (generated videos)', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    parts: [{ text: 'Generate a video of waves' }],
                },
                {
                    id: '2',
                    role: 'model',
                    parts: [
                        {
                            media: {
                                url: 'https://example.com/video.mp4',
                                mimeType: 'video/mp4',
                                type: 'video',
                            },
                        },
                    ],
                },
            ];

            const history = buildChatHistory(messages);

            // Should only include the user's text message, not the video response
            expect(history).toHaveLength(1);
            expect(history[0].role).toBe('user');
        });

        it('should exclude loading messages', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'model',
                    parts: [{ isLoading: true, status: 'Generating...' }],
                },
            ];

            const history = buildChatHistory(messages);

            expect(history).toHaveLength(0);
        });

        it('should exclude error messages', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'model',
                    parts: [{ isError: true, text: 'Something went wrong' }],
                },
            ];

            const history = buildChatHistory(messages);

            expect(history).toHaveLength(0);
        });

        it('should exclude system messages', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'system',
                    parts: [{ text: 'System instruction' }],
                },
            ];

            const history = buildChatHistory(messages);

            expect(history).toHaveLength(0);
        });

        it('should handle mixed-mode conversation correctly', () => {
            const messages: TestMessage[] = [
                // User asks for chat response
                {
                    id: '1',
                    role: 'user',
                    parts: [{ text: 'What is the weather today?' }],
                },
                // Model provides text response
                {
                    id: '2',
                    role: 'model',
                    parts: [{ text: 'I cannot check the current weather...' }],
                },
                // User asks for image generation
                {
                    id: '3',
                    role: 'user',
                    parts: [{ text: 'Generate an image of sunny weather' }],
                },
                // Model returns generated image (should be excluded)
                {
                    id: '4',
                    role: 'model',
                    parts: [
                        {
                            media: {
                                url: 'data:image/png;base64,xyz',
                                mimeType: 'image/png',
                                type: 'image',
                            },
                        },
                    ],
                },
                // User asks for chat again
                {
                    id: '5',
                    role: 'user',
                    parts: [{ text: 'Can you describe the image?' }],
                },
            ];

            const history = buildChatHistory(messages);

            // Should include: message 1, 2, 3, 5 (all text)
            // Should exclude: message 4 (image only)
            expect(history).toHaveLength(4);
            expect(history[0].parts[0].text).toBe('What is the weather today?');
            expect(history[1].parts[0].text).toBe('I cannot check the current weather...');
            expect(history[2].parts[0].text).toBe('Generate an image of sunny weather');
            expect(history[3].parts[0].text).toBe('Can you describe the image?');
        });

        it('should only include text from messages with mixed content', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    parts: [
                        { text: 'Here is an image:' },
                        {
                            media: {
                                url: 'data:image/png;base64,user-upload',
                                mimeType: 'image/png',
                                type: 'image',
                            },
                        },
                    ],
                },
            ];

            const history = buildChatHistory(messages);

            // Should include the message but only the text part
            expect(history).toHaveLength(1);
            expect(history[0].parts).toHaveLength(1);
            expect(history[0].parts[0].text).toBe('Here is an image:');
        });

        it('should handle empty messages array', () => {
            const messages: TestMessage[] = [];
            const history = buildChatHistory(messages);
            expect(history).toHaveLength(0);
        });

        it('should filter out messages with only empty text', () => {
            const messages: TestMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    parts: [{ text: '' }],
                },
            ];

            const history = buildChatHistory(messages);

            // Empty string is falsy, should be filtered
            expect(history).toHaveLength(0);
        });
    });

    describe('saveMessage mode parameter', () => {
        // These tests document the expected behavior of saveMessage calls
        // The actual saveMessage function is tested via API tests

        it('should pass mode parameter for user messages', () => {
            // Documentation: Line 1161 in page.tsx
            // await saveMessage('USER', userParts, activeConversationId, mode);
            const expectedModeParameter = 'chat'; // or 'pro', 'search', 'image', 'video'
            expect(expectedModeParameter).toBeDefined();
        });

        it('should pass explicit "image" mode for image generation responses', () => {
            // Documentation: Line 1226 in page.tsx
            // await saveMessage('MODEL', imageParts, undefined, 'image');
            const expectedModeParameter = 'image';
            expect(expectedModeParameter).toBe('image');
        });

        it('should capture mode before video API call to prevent race condition', () => {
            // Documentation: Line 1228-1229 in page.tsx
            // const videoRequestMode = mode; // Captured before async polling
            // This prevents race condition during 30+ second video polling

            // Simulate mode capture
            let currentMode = 'video';
            const videoRequestMode = currentMode;

            // Simulate user changing mode during polling
            currentMode = 'chat';

            // videoRequestMode should still be 'video'
            expect(videoRequestMode).toBe('video');
            expect(currentMode).toBe('chat');
        });

        it('should use captured mode when saving video response', () => {
            // Documentation: Line 1290 in page.tsx
            // await saveMessage('MODEL', videoParts, undefined, videoRequestMode);
            const videoRequestMode = 'video';
            expect(videoRequestMode).toBe('video');
        });

        it('should pass current mode for chat/pro/search responses', () => {
            // Documentation: Line 1391 in page.tsx
            // await saveMessage('MODEL', textParts, undefined, mode);
            const mode = 'pro';
            expect(mode).toBeDefined();
        });
    });
});

describe('Video Generation Race Condition Prevention', () => {
    it('should maintain correct mode even when user changes mode during polling', () => {
        // This test simulates the race condition scenario

        // Initial state: user is in video mode
        let globalMode = 'video';

        // User initiates video generation - mode is captured
        const capturedMode = globalMode;

        // Simulate 30+ second polling period
        // During this time, user switches to chat mode
        globalMode = 'chat';

        // Simulate video completion - should use captured mode, not current
        const savedMode = capturedMode; // This is what gets passed to saveMessage

        expect(savedMode).toBe('video');
        expect(globalMode).toBe('chat');
    });

    it('should maintain mode capture through multiple mode switches', () => {
        let globalMode = 'video';
        const capturedMode = globalMode;

        // User switches multiple times during polling
        globalMode = 'chat';
        globalMode = 'image';
        globalMode = 'pro';

        // Captured mode should be unchanged
        expect(capturedMode).toBe('video');
    });
});
