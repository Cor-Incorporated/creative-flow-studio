'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Message, GenerationMode, AspectRatio, Media, ContentPart } from '@/types/app';
import ChatInput from '@/components/ChatInput';
import ChatMessage from '@/components/ChatMessage';
import LandingPage from '@/components/LandingPage';
import { SparklesIcon } from '@/components/icons';
import { useToast } from '@/components/Toast';
import {
    VIDEO_POLL_INTERVAL_MS,
    MAX_VIDEO_POLL_ATTEMPTS,
    ERROR_MESSAGES,
    InfluencerId,
    getInfluencerConfig,
    INFLUENCER_TEMPERATURE,
} from '@/lib/constants';

export default function Home() {
    const { data: session, status } = useSession();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'model',
            parts: [
                {
                    text: 'クリエイティブフロースタジオへようこそ！今日はどのようなご用件でしょうか？',
                },
            ],
        },
    ]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [mode, setMode] = useState<GenerationMode>('chat');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerId>('none');
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<
        Array<{
            id: string;
            title: string | null;
            mode: string;
            createdAt: string;
            updatedAt: string;
            messageCount: number;
        }>
    >([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const selectedInfluencerRef = useRef(selectedInfluencer);
    const { showToast, ToastContainer } = useToast();

    // Update ref immediately during render to avoid race conditions
    selectedInfluencerRef.current = selectedInfluencer;

    // Get current influencer config
    const influencerConfig = getInfluencerConfig(selectedInfluencer);

    // Track blob URLs for cleanup to prevent memory leaks
    const blobUrlsRef = useRef<Set<string>>(new Set());

    // Cleanup all blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(url => {
                URL.revokeObjectURL(url);
            });
            blobUrlsRef.current.clear();
        };
    }, []);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        chatHistoryRef.current?.scrollTo(0, chatHistoryRef.current.scrollHeight);
    }, [messages]);

    // Load conversations on mount (if authenticated)
    useEffect(() => {
        const loadConversations = async () => {
            if (!session?.user) return;

            try {
                const response = await fetch('/api/conversations?limit=50');
                if (response.ok) {
                    const data = await response.json();
                    setConversations(data.conversations || []);
                }
            } catch (error) {
                console.error('Error loading conversations:', error);
            }
        };

        loadConversations();
    }, [session]);

    // インフルエンサーモード変更時に初期メッセージを更新
    useEffect(() => {
        const defaultMessage = 'クリエイティブフロースタジオへようこそ！今日はどのようなご用件でしょうか？';
        const newConfig = getInfluencerConfig(selectedInfluencer);

        setMessages(prev => {
            // Only update if we're still showing the initial message (no conversation yet)
            if (prev.length === 1 && prev[0]?.id === 'init' && prev[0]?.parts?.[0]?.text) {
                const newMessage = newConfig?.initialMessage || defaultMessage;
                return [
                    { id: 'init', role: 'model', parts: [{ text: newMessage }] },
                ];
            }
            return prev;
        });
    }, [selectedInfluencer]);

    const addMessage = (message: Omit<Message, 'id'>) => {
        setMessages(prev => [...prev, { ...message, id: Date.now().toString() }]);
    };

    const updateLastMessage = (updater: (lastMessage: Message) => Message) => {
        setMessages(prev => {
            if (prev.length === 0) return prev;
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = updater(newMessages[newMessages.length - 1]);
            return newMessages;
        });
    };

    // エラーメッセージをインフルエンサースタイルに変換
    const convertToInfluencerStyle = async (errorMessage: string): Promise<string> => {
        const config = getInfluencerConfig(selectedInfluencerRef.current);
        if (!config) return errorMessage;

        try {
            const prompt = `以下のエラーメッセージを${config.name}のスタイルで説明してください。エラーの内容は正確に伝えつつ、${config.name}らしい口調で伝えてください。\n\nエラーメッセージ: ${errorMessage}`;

            const response = await fetch('/api/gemini/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mode: 'chat',
                    systemInstruction: config.systemPrompt,
                    temperature: config.temperature,
                }),
            });

            if (!response.ok) {
                return errorMessage;
            }

            const data = await response.json();
            const responseText = data.result?.candidates?.[0]?.content?.parts?.[0]?.text;
            return responseText || errorMessage;
        } catch {
            return errorMessage;
        }
    };

    const handleApiError = async (
        error: any,
        context: string,
        useInfluencerStyle?: boolean
    ) => {
        console.error(`Error in ${context}:`, error);
        let errorMessage = ERROR_MESSAGES.GENERIC_ERROR;

        if (error.message) {
            errorMessage = error.message;
        }

        // 画像・動画生成のエラーでインフルエンサーモードがONの場合、エラーメッセージをインフルエンサースタイルに変換
        if (useInfluencerStyle && selectedInfluencerRef.current !== 'none') {
            try {
                const styledErrorMessage = await convertToInfluencerStyle(errorMessage);
                updateLastMessage(msg => ({
                    ...msg,
                    parts: [{ isError: true, text: styledErrorMessage }],
                }));
            } catch {
                updateLastMessage(msg => ({
                    ...msg,
                    parts: [{ isError: true, text: `エラー: ${errorMessage}` }],
                }));
            }
        } else {
            updateLastMessage(msg => ({
                ...msg,
                parts: [{ isError: true, text: `エラー: ${errorMessage}` }],
            }));
        }
    };

    const formatErrorMessage = async (errorMessage: string): Promise<string> => {
        if (selectedInfluencerRef.current !== 'none') {
            try {
                return await convertToInfluencerStyle(errorMessage);
            } catch {
                return errorMessage;
            }
        }
        return errorMessage;
    };

    /**
     * Create a new conversation or return existing one
     * Only saves if user is authenticated
     */
    const createOrGetConversation = async (): Promise<string | null> => {
        // Skip if not authenticated
        if (!session?.user) {
            return null;
        }

        // Return existing conversation ID if already created
        if (currentConversationId) {
            return currentConversationId;
        }

        try {
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: mode.toUpperCase(),
                }),
            });

            if (!response.ok) {
                console.error('Failed to create conversation');
                return null;
            }

            const data = await response.json();
            const conversationId = data.conversation.id;
            setCurrentConversationId(conversationId);
            return conversationId;
        } catch (error) {
            console.error('Error creating conversation:', error);
            return null;
        }
    };

    /**
     * Save a message to the current conversation
     * Best-effort: doesn't throw errors to avoid disrupting UX
     */
    const saveMessage = async (role: 'USER' | 'MODEL', parts: ContentPart[]) => {
        // Skip if not authenticated or no conversation
        if (!session?.user || !currentConversationId) {
            return;
        }

        try {
            await fetch(`/api/conversations/${currentConversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    content: parts,
                }),
            });
        } catch (error) {
            // Silent fail - don't disrupt user experience
            console.error('Error saving message:', error);
        }
    };

    /**
     * Load a conversation and display its messages
     */
    const loadConversation = async (conversationId: string) => {
        if (!session?.user) return;

        try {
            const response = await fetch(`/api/conversations/${conversationId}`);
            if (response.ok) {
                const data = await response.json();
                const conversation = data.conversation;

                // Set current conversation ID
                setCurrentConversationId(conversation.id);

                // Convert database messages to UI messages
                const loadedMessages: Message[] = conversation.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role.toLowerCase(),
                    parts: msg.content,
                }));

                setMessages(loadedMessages);
                setIsSidebarOpen(false); // Close sidebar on mobile
            }
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    };

    /**
     * Start a new conversation
     */
    const startNewConversation = () => {
        // Reset to initial state
        const config = getInfluencerConfig(selectedInfluencer);
        const defaultMessage = 'クリエイティブフロースタジオへようこそ！今日はどのようなご用件でしょうか？';

        setCurrentConversationId(null);
        setMessages([
            {
                id: 'init',
                role: 'model',
                parts: [
                    {
                        text: config?.initialMessage || defaultMessage,
                    },
                ],
            },
        ]);
        setIsSidebarOpen(false);
    };

    /**
     * Delete a conversation
     */
    const deleteConversation = async (conversationId: string) => {
        if (!session?.user) return;
        if (!confirm('この会話を削除してもよろしいですか？')) return;

        try {
            const response = await fetch(`/api/conversations/${conversationId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Remove from list
                setConversations(prev => prev.filter(c => c.id !== conversationId));

                // If deleting current conversation, start new one
                if (conversationId === currentConversationId) {
                    startNewConversation();
                }
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            alert('会話の削除に失敗しました');
        }
    };

    const pollVideoStatus = async (
        operationName: string,
        messageId: string
    ): Promise<ContentPart[] | null> => {
        let pollAttempts = 0;
        let done = false;

        while (!done) {
            // Check for timeout
            if (pollAttempts >= MAX_VIDEO_POLL_ATTEMPTS) {
                const timeoutError = await formatErrorMessage(ERROR_MESSAGES.VIDEO_POLL_TIMEOUT);
                setMessages(prev =>
                    prev.map(m =>
                        m.id === messageId
                            ? {
                                  ...m,
                                  parts: [{ isError: true, text: timeoutError }],
                              }
                            : m
                    )
                );
                return null;
            }

            await new Promise(resolve => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
            pollAttempts++;

            try {
                const statusResponse = await fetch('/api/gemini/video/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operationName }),
                });

                if (!statusResponse.ok) {
                    const errorData = await statusResponse.json();
                    throw new Error(errorData.error || ERROR_MESSAGES.VIDEO_GENERATION_FAILED);
                }

                const statusData = await statusResponse.json();
                const { operation } = statusData;

                // Update progress
                const progress = operation.metadata?.progressPercentage || 0;
                const validatedProgress = Math.max(0, Math.min(100, progress));
                setMessages(prev =>
                    prev.map(m =>
                        m.id === messageId
                            ? {
                                  ...m,
                                  parts: [
                                      {
                                          isLoading: true,
                                          status: `ビデオを処理中...(${validatedProgress.toFixed(0)}%)`,
                                      },
                                  ],
                              }
                            : m
                    )
                );

                if (operation.done) {
                    done = true;

                    // Check for errors
                    if (operation.error) {
                        const apiErrorMessage =
                            operation.error.message || ERROR_MESSAGES.VIDEO_GENERATION_FAILED;
                        const formattedError = await formatErrorMessage(
                            `ビデオ生成エラー: ${apiErrorMessage}`
                        );
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === messageId
                                    ? {
                                          ...m,
                                          parts: [{ isError: true, text: formattedError }],
                                      }
                                    : m
                            )
                        );
                        return null;
                    }

                    // Video is ready
                    if (operation.response?.generatedVideos?.[0]?.video?.uri) {
                        const downloadLink = operation.response.generatedVideos[0].video.uri;
                        // Use server-side proxy to download video without exposing API key
                        const videoUrl = `/api/gemini/video/download?uri=${encodeURIComponent(downloadLink)}`;

                        const videoResponse = await fetch(videoUrl);
                        const videoBlob = await videoResponse.blob();
                        const videoDataUrl = URL.createObjectURL(videoBlob);

                        // Track blob URL for cleanup
                        blobUrlsRef.current.add(videoDataUrl);

                        const videoParts: ContentPart[] = [
                            {
                                media: {
                                    type: 'video',
                                    url: videoDataUrl,
                                    mimeType: 'video/mp4',
                                },
                            },
                        ];

                        setMessages(prev =>
                            prev.map(m =>
                                m.id === messageId
                                    ? {
                                          ...m,
                                          parts: videoParts,
                                      }
                                    : m
                            )
                        );

                        // Return video parts for saving
                        return videoParts;
                    } else {
                        const formattedError = await formatErrorMessage(
                            ERROR_MESSAGES.VIDEO_GENERATION_FAILED
                        );
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === messageId
                                    ? { ...m, parts: [{ isError: true, text: formattedError }] }
                                    : m
                            )
                        );
                        return null;
                    }
                }
            } catch (error: any) {
                await handleApiError(error, 'video polling', true);
                return null;
            }
        }
        return null;
    };

    const handleSendMessage = async (prompt: string, uploadedMedia?: Media) => {
        if (isLoading) return;

        // Check authentication before sending message
        if (!session?.user) {
            showToast({
                message: 'この機能を使用するにはログインが必要です',
                type: 'warning',
                duration: 6000,
                action: {
                    label: 'ログインする',
                    onClick: () => signIn('google', { callbackUrl: window.location.href }),
                },
            });
            return;
        }
        
        setIsLoading(true);

        const userParts: ContentPart[] = [];
        if (prompt) userParts.push({ text: prompt });
        if (uploadedMedia) userParts.push({ media: uploadedMedia });
        addMessage({ role: 'user', parts: userParts });

        // Create or get conversation for authenticated users
        await createOrGetConversation();

        // Save user message
        await saveMessage('USER', userParts);

        const loadingMessageId = Date.now().toString() + '-loading';
        setMessages(prev => [
            ...prev,
            { id: loadingMessageId, role: 'model', parts: [{ isLoading: true }] },
        ]);

        try {
            const systemInstruction = influencerConfig?.systemPrompt || undefined;
            const temperature = influencerConfig?.temperature || undefined;

            if (mode === 'image') {
                // Call image generation API
                const response = await fetch('/api/gemini/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, aspectRatio }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || ERROR_MESSAGES.IMAGE_GENERATION_FAILED);
                }

                const data = await response.json();
                const imageParts: ContentPart[] = [
                    {
                        media: {
                            type: 'image',
                            url: data.imageUrl,
                            mimeType: 'image/png',
                        },
                    },
                ];
                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? {
                                  ...m,
                                  parts: imageParts,
                              }
                            : m
                    )
                );

                // Save model response (image)
                await saveMessage('MODEL', imageParts);
            } else if (mode === 'video') {
                // Call video generation API
                const response = await fetch('/api/gemini/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt,
                        aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
                        media: uploadedMedia,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || ERROR_MESSAGES.VIDEO_GENERATION_FAILED);
                }

                const data = await response.json();
                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? {
                                  ...m,
                                  parts: [
                                      { isLoading: true, status: 'ビデオ生成を開始しました...' },
                                  ],
                              }
                            : m
                    )
                );

                // Start polling for video status
                const videoParts = await pollVideoStatus(data.operationName, loadingMessageId);

                // Save model response (video) if successfully generated
                if (videoParts) {
                    await saveMessage('MODEL', videoParts);
                }
            } else {
                // Chat, Pro, or Search mode - call chat API
                const history = messages
                    .filter(m => m.role === 'user' || m.role === 'model')
                    .map(m => ({
                        role: m.role,
                        parts: m.parts
                            .filter(p => p.text || p.media)
                            .map(p => {
                                if (p.text) return { text: p.text };
                                if (p.media && p.media.type === 'image') {
                                    return {
                                        media: {
                                            url: p.media.url,
                                            mimeType: p.media.mimeType,
                                            type: 'image',
                                        },
                                    };
                                }
                                return null;
                            })
                            .filter(
                                (part): part is { text: string } | { media: Media } => part !== null
                            ),
                    }))
                    .filter(m => m.parts.length > 0);

                const response = await fetch('/api/gemini/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt,
                        history,
                        mode,
                        systemInstruction,
                        temperature,
                        media: uploadedMedia,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || ERROR_MESSAGES.GENERIC_ERROR);
                }

                const data = await response.json();
                const result = data.result;

                // Extract grounding sources if available
                const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
                const sources =
                    groundingChunks?.map((c: any) => ({ uri: c.web.uri, title: c.web.title })) ||
                    [];

                // Extract text response
                const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

                const textParts: ContentPart[] = [{ text: responseText, sources }];
                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId ? { ...m, parts: textParts } : m
                    )
                );

                // Save model response (text)
                await saveMessage('MODEL', textParts);
            }
        } catch (error: any) {
            const shouldUseDjShachoStyle = mode === 'image' || mode === 'video';
            await handleApiError(error, `mode: ${mode}`, shouldUseDjShachoStyle);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditImage = async (prompt: string, image: Media) => {
        // Check authentication before editing image
        if (!session?.user) {
            showToast({
                message: '画像編集機能を使用するにはログインが必要です',
                type: 'warning',
                duration: 6000,
                action: {
                    label: 'ログインする',
                    onClick: () => signIn('google', { callbackUrl: window.location.href }),
                },
            });
            return;
        }
        
        setIsLoading(true);
        addMessage({ role: 'user', parts: [{ text: `画像編集: 「${prompt}」` }] });

        const loadingMessageId = Date.now().toString() + '-editing';
        setMessages(prev => [
            ...prev,
            {
                id: loadingMessageId,
                role: 'model',
                parts: [{ isLoading: true, isEditing: true, originalMedia: image }],
            },
        ]);

        try {
            const response = await fetch('/api/gemini/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, originalImage: image }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || ERROR_MESSAGES.IMAGE_GENERATION_FAILED);
            }

            const data = await response.json();
            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMessageId
                        ? {
                              ...m,
                              parts: [
                                  {
                                      media: {
                                          type: 'image',
                                          url: data.imageUrl,
                                          mimeType: 'image/png',
                                      },
                                  },
                              ],
                          }
                        : m
                )
            );
        } catch (error: any) {
            await handleApiError(error, 'image editing', false);
        } finally {
            setIsLoading(false);
        }
    };

    // Show landing page for unauthenticated users
    if (status === 'loading') {
        return (
            <div className="flex h-screen bg-gray-900 text-white items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (status === 'unauthenticated' || !session?.user) {
        return <LandingPage />;
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <div
                className={`${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } fixed md:relative md:translate-x-0 w-64 h-full bg-gray-800 border-r border-gray-700 transition-transform duration-300 z-50 flex flex-col`}
            >
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-700">
                    <button
                        onClick={startNewConversation}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                    >
                        + 新しい会話
                    </button>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {session?.user ? (
                        conversations.length > 0 ? (
                            conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors ${
                                        conv.id === currentConversationId
                                            ? 'bg-gray-700'
                                            : 'hover:bg-gray-700/50'
                                    }`}
                                >
                                    <div
                                        onClick={() => loadConversation(conv.id)}
                                        className="flex-1"
                                    >
                                        <div className="font-medium truncate">
                                            {conv.title ||
                                                `${conv.mode} - ${new Date(conv.createdAt).toLocaleDateString('ja-JP')}`}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {conv.messageCount}件のメッセージ
                                        </div>
                                    </div>
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            deleteConversation(conv.id);
                                        }}
                                        className="text-red-400 hover:text-red-300 text-sm mt-2"
                                    >
                                        削除
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-400 mt-4">
                                会話がありません
                            </div>
                        )
                    ) : (
                        <div className="text-center text-gray-400 mt-4 px-2">
                            ログインして会話を保存
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        {/* Hamburger Menu Button (Mobile) */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="md:hidden p-2 hover:bg-gray-700 rounded-lg"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </button>
                        <SparklesIcon className="w-6 h-6 text-blue-400" />
                        <h1 className="text-xl font-bold">クリエイティブフロースタジオ</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Login/Logout Button */}
                        {/* Note: At this point, user is authenticated (landing page check passed) */}
                        <div className="flex items-center gap-3">
                            <a
                                href="/pricing"
                                className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                            >
                                料金プラン
                            </a>
                            <button
                                onClick={() => signOut({ callbackUrl: window.location.href })}
                                className="px-4 py-1.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                ログアウト
                            </button>
                        </div>
                        <div className="relative">
                            <div className="w-32 h-2 bg-gray-700 rounded-full">
                                <div
                                    className="h-2 bg-green-500 rounded-full"
                                    style={{ width: '80%' }}
                                ></div>
                            </div>
                            <span className="absolute -top-5 right-0 text-xs text-gray-400">
                                クォータ: 80%
                            </span>
                        </div>
                    </div>
                </header>

                <main ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <ChatMessage
                            key={msg.id}
                            message={msg}
                            onEditImage={handleEditImage}
                            selectedInfluencer={selectedInfluencer}
                        />
                    ))}
                </main>

                <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    mode={mode}
                    setMode={setMode}
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    selectedInfluencer={selectedInfluencer}
                    setSelectedInfluencer={setSelectedInfluencer}
                />
            </div>

            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Toast Notifications */}
            <ToastContainer />
        </div>
    );
}
