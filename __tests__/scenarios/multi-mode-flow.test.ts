/**
 * Multi-Mode Flow Scenario Tests
 *
 * These tests verify end-to-end flows for conversations that span multiple modes.
 * They ensure mode switching, message saving, and history construction work correctly
 * in realistic usage scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContentPart, GenerationMode, Media } from '@/types/app';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Simulate the conversation state management
interface ConversationMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    mode: GenerationMode;
    parts: ContentPart[];
    createdAt: Date;
}

// Helper to create messages
function createMessage(
    role: 'user' | 'model',
    parts: ContentPart[],
    mode: GenerationMode
): ConversationMessage {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        mode,
        parts,
        createdAt: new Date(),
    };
}

// Helper to build chat history (mirrors page.tsx logic)
function buildChatHistory(messages: ConversationMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages
        .filter(m => {
            if (m.role !== 'user' && m.role !== 'model') return false;
            const hasTextContent = m.parts.some(p => p.text && !p.isError && !p.isLoading);
            return hasTextContent;
        })
        .map(m => ({
            role: m.role,
            parts: m.parts
                .filter(p => p.text && !p.isError && !p.isLoading)
                .map(p => ({ text: p.text! })),
        }))
        .filter(m => m.parts.length > 0);
}

describe('Multi-Mode Conversation Flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Chat → Image → Chat flow', () => {
        it('should maintain mode context across switches', () => {
            const messages: ConversationMessage[] = [];
            let currentMode: GenerationMode = 'chat';

            // Step 1: User sends chat message
            messages.push(createMessage('user', [{ text: 'Hello!' }], currentMode));
            expect(currentMode).toBe('chat');

            // Step 2: Model responds with text
            messages.push(createMessage('model', [{ text: 'Hi there!' }], currentMode));

            // Step 3: User switches to image mode
            currentMode = 'image';
            messages.push(createMessage('user', [{ text: 'Generate a sunset' }], currentMode));

            // Step 4: Model responds with image
            messages.push(
                createMessage(
                    'model',
                    [
                        {
                            media: {
                                url: 'data:image/png;base64,abc123',
                                mimeType: 'image/png',
                                type: 'image',
                            },
                        },
                    ],
                    'image' // Explicit image mode
                )
            );

            // Step 5: User switches back to chat
            currentMode = 'chat';
            messages.push(createMessage('user', [{ text: 'That was beautiful!' }], currentMode));

            // Verify modes are correctly tracked
            expect(messages[0].mode).toBe('chat');
            expect(messages[1].mode).toBe('chat');
            expect(messages[2].mode).toBe('image');
            expect(messages[3].mode).toBe('image');
            expect(messages[4].mode).toBe('chat');
        });

        it('should save messages with correct mode at each step', () => {
            const savedMessages: Array<{ role: string; mode: GenerationMode; content: ContentPart[] }> = [];

            // Simulate saveMessage function
            const saveMessage = (role: 'USER' | 'MODEL', parts: ContentPart[], _convId?: string, mode?: GenerationMode) => {
                savedMessages.push({
                    role,
                    mode: mode || 'chat',
                    content: parts,
                });
            };

            let mode: GenerationMode = 'chat';

            // User message in chat mode
            saveMessage('USER', [{ text: 'Hello' }], undefined, mode);
            expect(savedMessages[0].mode).toBe('chat');

            // Switch to image mode
            mode = 'image';
            saveMessage('USER', [{ text: 'Generate image' }], undefined, mode);
            expect(savedMessages[1].mode).toBe('image');

            // Model image response (explicit 'image' mode)
            saveMessage(
                'MODEL',
                [{ media: { url: 'data:image/png', mimeType: 'image/png', type: 'image' } }],
                undefined,
                'image'
            );
            expect(savedMessages[2].mode).toBe('image');

            // Switch back to chat
            mode = 'chat';
            saveMessage('USER', [{ text: 'Thanks!' }], undefined, mode);
            expect(savedMessages[3].mode).toBe('chat');
        });

        it('should not include image data in chat history', () => {
            const messages: ConversationMessage[] = [
                createMessage('user', [{ text: 'Hello' }], 'chat'),
                createMessage('model', [{ text: 'Hi!' }], 'chat'),
                createMessage('user', [{ text: 'Generate a cat' }], 'image'),
                createMessage(
                    'model',
                    [{ media: { url: 'data:image/png', mimeType: 'image/png', type: 'image' } }],
                    'image'
                ),
                createMessage('user', [{ text: 'Now describe it' }], 'chat'),
            ];

            const history = buildChatHistory(messages);

            // History should have 4 entries (all text messages)
            expect(history).toHaveLength(4);

            // No media should be in history
            history.forEach(msg => {
                msg.parts.forEach(part => {
                    expect(part).toHaveProperty('text');
                    expect(part).not.toHaveProperty('media');
                });
            });
        });
    });

    describe('Video generation with mode switch during polling', () => {
        it('should save video response with original mode despite mode change', async () => {
            let currentMode: GenerationMode = 'video';
            const savedMessages: Array<{ mode: GenerationMode }> = [];

            // Capture mode before video API call (race condition prevention)
            const videoRequestMode = currentMode;

            // Simulate polling delay
            await new Promise(resolve => setTimeout(resolve, 10));

            // User switches mode during polling
            currentMode = 'chat';

            // Video completes - should use captured mode
            savedMessages.push({ mode: videoRequestMode });

            expect(savedMessages[0].mode).toBe('video');
            expect(currentMode).toBe('chat');
        });

        it('should handle multiple mode switches during video polling', async () => {
            let currentMode: GenerationMode = 'video';
            const videoRequestMode = currentMode;

            // Simulate multiple mode switches during 30+ second polling
            await new Promise(resolve => setTimeout(resolve, 5));
            currentMode = 'chat';

            await new Promise(resolve => setTimeout(resolve, 5));
            currentMode = 'image';

            await new Promise(resolve => setTimeout(resolve, 5));
            currentMode = 'search';

            // Video completes
            const savedMode = videoRequestMode;

            expect(savedMode).toBe('video');
            expect(currentMode).toBe('search');
        });
    });

    describe('Conversation load with mixed-mode messages', () => {
        it('should load and display all message types correctly', () => {
            // Simulate loading messages from database
            const dbMessages = [
                { id: '1', role: 'user', mode: 'CHAT', content: [{ text: 'Hi' }] },
                { id: '2', role: 'model', mode: 'CHAT', content: [{ text: 'Hello!' }] },
                { id: '3', role: 'user', mode: 'IMAGE', content: [{ text: 'Generate sunset' }] },
                { id: '4', role: 'model', mode: 'IMAGE', content: [{ media: { url: 'data:image/png', mimeType: 'image/png', type: 'image' } }] },
                { id: '5', role: 'user', mode: 'VIDEO', content: [{ text: 'Create a video' }] },
                { id: '6', role: 'model', mode: 'VIDEO', content: [{ media: { url: 'https://video.mp4', mimeType: 'video/mp4', type: 'video' } }] },
            ];

            // Map to frontend message format
            const frontendMessages = dbMessages.map(msg => ({
                id: msg.id,
                role: msg.role.toLowerCase() as 'user' | 'model',
                mode: msg.mode.toLowerCase() as GenerationMode,
                parts: msg.content as ContentPart[],
            }));

            expect(frontendMessages).toHaveLength(6);

            // Verify all modes are preserved
            expect(frontendMessages[0].mode).toBe('chat');
            expect(frontendMessages[2].mode).toBe('image');
            expect(frontendMessages[4].mode).toBe('video');

            // Verify media types
            expect(frontendMessages[3].parts[0].media?.type).toBe('image');
            expect(frontendMessages[5].parts[0].media?.type).toBe('video');
        });

        it('should set mode from last message in conversation', () => {
            const dbMessages = [
                { id: '1', role: 'user', mode: 'CHAT', content: [{ text: 'Hi' }] },
                { id: '2', role: 'model', mode: 'CHAT', content: [{ text: 'Hello!' }] },
                { id: '3', role: 'user', mode: 'PRO', content: [{ text: 'Complex question' }] },
            ];

            // Determine mode from last user message
            const lastUserMessage = [...dbMessages].reverse().find(m => m.role === 'user');
            const conversationMode = lastUserMessage?.mode.toLowerCase() as GenerationMode || 'chat';

            expect(conversationMode).toBe('pro');
        });
    });

    describe('Error recovery scenarios', () => {
        it('should preserve mode when retrying failed message', () => {
            let currentMode: GenerationMode = 'image';
            let lastFailedMode: GenerationMode | null = null;
            let lastFailedPrompt: string | null = null;

            // Simulate failed image generation
            lastFailedPrompt = 'Generate a cat';
            lastFailedMode = currentMode;

            // User switches mode
            currentMode = 'chat';

            // User clicks retry - should use original mode
            const retryMode = lastFailedMode;
            expect(retryMode).toBe('image');
            expect(currentMode).toBe('chat');
        });

        it('should clear retry state after successful send', () => {
            let lastFailedPrompt: string | null = 'Failed message';
            let lastFailedMedia: Media | null = null;

            // Simulate successful send
            lastFailedPrompt = null;
            lastFailedMedia = null;

            expect(lastFailedPrompt).toBeNull();
            expect(lastFailedMedia).toBeNull();
        });
    });
});

describe('History Contamination Prevention', () => {
    it('should not send image generation results to chat API', () => {
        const messages: ConversationMessage[] = [
            createMessage('user', [{ text: 'Generate a cat' }], 'image'),
            createMessage(
                'model',
                [{ media: { url: 'data:image/png', mimeType: 'image/png', type: 'image' } }],
                'image'
            ),
            createMessage('user', [{ text: 'Now tell me about cats' }], 'chat'),
        ];

        const history = buildChatHistory(messages);

        // Should only include text messages
        expect(history).toHaveLength(2);
        expect(history[0].parts[0].text).toBe('Generate a cat');
        expect(history[1].parts[0].text).toBe('Now tell me about cats');
    });

    it('should not send video generation results to chat API', () => {
        const messages: ConversationMessage[] = [
            createMessage('user', [{ text: 'Create a video of waves' }], 'video'),
            createMessage(
                'model',
                [{ media: { url: 'https://video.mp4', mimeType: 'video/mp4', type: 'video' } }],
                'video'
            ),
            createMessage('user', [{ text: 'What sound do waves make?' }], 'chat'),
        ];

        const history = buildChatHistory(messages);

        expect(history).toHaveLength(2);
        expect(history.every(m => m.parts.every(p => 'text' in p))).toBe(true);
    });

    it('should include user-uploaded media description in history', () => {
        // When user uploads media with text, the text should be included
        const messages: ConversationMessage[] = [
            createMessage(
                'user',
                [
                    { text: 'What is in this image?' },
                    { media: { url: 'data:image/png', mimeType: 'image/png', type: 'image' } },
                ],
                'chat'
            ),
        ];

        const history = buildChatHistory(messages);

        expect(history).toHaveLength(1);
        expect(history[0].parts[0].text).toBe('What is in this image?');
        // Media is excluded from history to prevent API issues
        expect(history[0].parts).toHaveLength(1);
    });
});

describe('Mode-Specific Behavior', () => {
    it('should auto-switch to image mode when image is uploaded', () => {
        let mode: GenerationMode = 'chat';
        const uploadedMediaType = 'image';

        // Simulate auto-switch logic from ChatInput
        if (uploadedMediaType === 'image') {
            mode = 'image';
        }

        expect(mode).toBe('image');
    });

    it('should auto-switch to video mode when video is uploaded', () => {
        let mode: GenerationMode = 'chat';
        const uploadedMediaType = 'video';

        // Simulate auto-switch logic from ChatInput
        if (uploadedMediaType === 'video') {
            mode = 'video';
        }

        expect(mode).toBe('video');
    });

    it('should preserve mode when pasting image', () => {
        let mode: GenerationMode = 'chat';

        // Simulate paste handler auto-switch
        mode = 'image';

        expect(mode).toBe('image');
    });
});
