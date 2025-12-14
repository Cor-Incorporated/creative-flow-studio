'use client';

import ChatInput from '@/components/ChatInput';
import ChatMessage from '@/components/ChatMessage';
import { SparklesIcon } from '@/components/icons';
import LandingPage from '@/components/LandingPage';
import { useToast } from '@/components/Toast';
import UsageLimitBanner, { UsageLimitInfo } from '@/components/UsageLimitBanner';
import {
    ERROR_MESSAGES,
    getInfluencerConfig,
    InfluencerId,
    MAX_VIDEO_POLL_ATTEMPTS,
    VIDEO_POLL_INTERVAL_MS
} from '@/lib/constants';
import { AspectRatio, ContentPart, GenerationMode, Media, Message } from '@/types/app';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

export default function Home() {
    const { data: session, status } = useSession();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'model',
            parts: [
                {
                    text: 'BulnaAIへようこそ！今日はどのようなご用件でしょうか？',
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
    const [usageLimitInfo, setUsageLimitInfo] = useState<UsageLimitInfo | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    // Retry state for failed messages
    const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
    const [lastFailedMedia, setLastFailedMedia] = useState<Media | null>(null);
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const selectedInfluencerRef = useRef(selectedInfluencer);
    const currentConversationIdRef = useRef<string | null>(null);
    const { showToast, ToastContainer } = useToast();

    // Update ref immediately during render to avoid race conditions
    selectedInfluencerRef.current = selectedInfluencer;

    // Keep track of current conversation ID for effects
    useEffect(() => {
        currentConversationIdRef.current = currentConversationId;
    }, [currentConversationId]);

    // Get current influencer config
    const influencerConfig = getInfluencerConfig(selectedInfluencer);

    // Track blob URLs for cleanup to prevent memory leaks
    const blobUrlsRef = useRef<Set<string>>(new Set());

    const authedFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
        fetch(input, { credentials: 'include', ...init });

    type ApiErrorPayload = {
        error?: string;
        code?: string;
        details?: any;
        requestId?: string;
        planName?: string;
        usage?: { current: number; limit: number | null };
        resetDate?: string | null;
        [key: string]: any;
    };

    class ApiError extends Error {
        status: number;
        code?: string;
        requestId?: string;
        payload?: ApiErrorPayload;
        constructor(status: number, payload?: ApiErrorPayload, fallbackMessage?: string) {
            const message = payload?.error || fallbackMessage || ERROR_MESSAGES.GENERIC_ERROR;
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.code = payload?.code;
            this.requestId = payload?.requestId;
            this.payload = payload;
        }
    }

    const parseJsonSafe = async (response: Response): Promise<any | null> => {
        try {
            return await response.json();
        } catch {
            return null;
        }
    };

    interface UserFacingError {
        message: string;
        action?: { label: string; onClick: () => void };
        retryAfterText?: string;
    }

    const buildUserFacingErrorMessage = (error: ApiError): UserFacingError => {
        // Note: requestIdSuffix no longer included in message - supportId displayed separately in Toast

        // Prefer explicit API error codes when present.
        switch (error.code) {
            case 'UNAUTHORIZED':
                return {
                    message: 'セッションが切れました。再度ログインしてください。',
                    action: {
                        label: 'ログインする',
                        onClick: () => signIn('google', { callbackUrl: window.location.href }),
                    },
                };
            case 'FORBIDDEN_PLAN':
                return {
                    message: '現在のプランではこの機能を利用できません。',
                    action: {
                        label: '料金プランを見る',
                        onClick: () => (window.location.href = '/pricing'),
                    },
                };
            case 'FORBIDDEN_ADMIN':
                return {
                    message: 'この操作を行う権限がありません。',
                };
            case 'RATE_LIMIT_EXCEEDED': {
                const reset = error.payload?.resetDate ? new Date(error.payload.resetDate) : null;
                const retryAfterText = reset
                    ? `約${formatRetryAfter(reset)}後にリセットされます`
                    : undefined;
                return {
                    message: '今月の利用上限に達しました。',
                    action: {
                        label: '料金プランを見る',
                        onClick: () => (window.location.href = '/pricing'),
                    },
                    retryAfterText,
                };
            }
            case 'GEMINI_API_KEY_NOT_FOUND':
                return {
                    message: 'サーバー設定に問題があります。時間をおいて改善しない場合はサポートへご連絡ください。',
                };
            case 'VALIDATION_ERROR':
                return { message: error.message };
            case 'UPSTREAM_ERROR':
                return {
                    message: '生成に失敗しました。時間をおいて再度お試しください。',
                    retryAfterText: '数分後に再試行してください',
                };
            // Content policy errors (Phase 7)
            case 'CONTENT_POLICY_VIOLATION':
            case 'SAFETY_BLOCKED':
                return {
                    message: error.payload?.error || 'コンテンツがポリシーに違反しているため処理できません。別の表現でお試しください。',
                };
            case 'RECITATION_BLOCKED':
                return {
                    message: '著作権保護のため、この内容は生成できません。別の内容でお試しください。',
                };
        }

        // Fallbacks by HTTP status when code is absent.
        if (error.status === 401) {
            return {
                message: 'セッションが切れました。再度ログインしてください。',
                action: {
                    label: 'ログインする',
                    onClick: () => signIn('google', { callbackUrl: window.location.href }),
                },
            };
        }
        if (error.status === 429) {
            return {
                message: 'リクエストが多すぎます。時間をおいて再度お試しください。',
                retryAfterText: '数分後に再試行してください',
            };
        }
        if (error.status === 403) {
            return {
                message: 'この操作を行う権限がありません。',
            };
        }
        return { message: error.message };
    };

    /**
     * Format retry-after duration in human readable Japanese
     */
    const formatRetryAfter = (resetDate: Date): string => {
        const now = new Date();
        const diffMs = resetDate.getTime() - now.getTime();
        if (diffMs <= 0) return '間もなく';

        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        if (diffHours < 24) {
            return `${diffHours}時間`;
        }
        const diffDays = Math.ceil(diffHours / 24);
        return `${diffDays}日`;
    };

    const normalizeFileResourceName = (value?: string | null) => {
        if (!value) return null;
        const trimmed = value.trim().replace(/^\/+/, '');
        const filesIndex = trimmed.indexOf('files/');
        const base = filesIndex >= 0 ? trimmed.slice(filesIndex) : trimmed;
        if (base.startsWith('files/')) {
            return base;
        }
        if (/^[A-Za-z0-9_-]+$/.test(base)) {
            return `files/${base}`;
        }
        return null;
    };

    const scanForVideoReference = (root: any) => {
        if (!root || typeof root !== 'object') {
            return null;
        }

        const stack: any[] = [root];
        const visited = new Set<any>();
        let uri: string | null = null;
        let file: string | null = null;
        let mimeType: string | null = null;

        const looksLikeUri = (value: string) =>
            value.startsWith('http://') || value.startsWith('https://') || value.startsWith('gs://');

        while (stack.length > 0 && (!uri || !file || !mimeType)) {
            const current = stack.pop();
            if (!current || typeof current !== 'object') continue;
            if (visited.has(current)) continue;
            visited.add(current);

            if (Array.isArray(current)) {
                for (const item of current) {
                    stack.push(item);
                }
                continue;
            }

            for (const [key, value] of Object.entries(current)) {
                if (typeof value === 'string') {
                    const lowerKey = key.toLowerCase();

                    if (!mimeType && (lowerKey.includes('mime') || lowerKey.includes('contenttype'))) {
                        mimeType = value;
                    }

                    if (!uri && (lowerKey.includes('uri') || lowerKey.includes('url') || looksLikeUri(value))) {
                        if (looksLikeUri(value)) {
                            uri = value;
                        } else if (!file) {
                            const normalized = normalizeFileResourceName(value);
                            if (normalized) {
                                file = normalized;
                            }
                        }
                    }

                    if (!file && (lowerKey === 'name' || lowerKey.includes('file'))) {
                        const normalized = normalizeFileResourceName(value);
                        if (normalized) {
                            file = normalized;
                        }
                    }
                } else if (typeof value === 'object' && value !== null) {
                    stack.push(value);
                }
            }
        }

        if (!uri && !file) {
            return null;
        }

        return {
            uri,
            file,
            mimeType: mimeType || undefined,
        };
    };

    const getGeneratedVideoDownloadTarget = (operationPayload: any) => {
        if (!operationPayload) {
            return null;
        }

        const responsePayload =
            operationPayload.response ||
            operationPayload.result ||
            operationPayload.operation?.response ||
            operationPayload;

        const candidateLists = [
            responsePayload?.generatedVideos,
            responsePayload?.videos,
            responsePayload?.generated_videos,
        ].filter((list): list is any[] => Array.isArray(list) && list.length > 0);

        for (const list of candidateLists) {
            const firstEntry = list[0];
            const videoRecord = firstEntry?.video || firstEntry;
            const uri =
                videoRecord?.uri ||
                videoRecord?.videoUri ||
                videoRecord?.gcsUri ||
                firstEntry?.uri ||
                firstEntry?.gcsUri ||
                null;
            const file =
                normalizeFileResourceName(
                    videoRecord?.name ||
                    videoRecord?.file ||
                    firstEntry?.file ||
                    firstEntry?.name ||
                    videoRecord?.uri ||
                    firstEntry?.uri ||
                    null
                ) || null;
            const mimeType = videoRecord?.mimeType || firstEntry?.mimeType || undefined;

            if (uri || file) {
                return { uri, file, mimeType: mimeType || 'video/mp4' };
            }
        }

        return scanForVideoReference(responsePayload);
    };

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
                const response = await authedFetch('/api/conversations?limit=50', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    const fetchedConversations = data.conversations || [];
                    setConversations(fetchedConversations);

                    // Check for restoration target
                    if (!currentConversationIdRef.current) {
                        // 1. Check URL param
                        const urlParams = new URLSearchParams(window.location.search);
                        const urlId = urlParams.get('c');

                        // 2. Check LocalStorage
                        const storageId = localStorage.getItem('lastActiveConversationId');

                        const targetId = urlId || storageId;

                        if (targetId) {
                            if (fetchedConversations.some((c: any) => c.id === targetId)) {
                                loadConversation(targetId);
                            } else {
                                // Target ID not found in user's conversations (invalid or deleted)
                                // Clean up invalid state
                                console.warn(`Conversation ${targetId} not found, clearing persistence`);
                                const newUrl = new URL(window.location.href);
                                newUrl.searchParams.delete('c');
                                window.history.replaceState({}, '', newUrl);
                                localStorage.removeItem('lastActiveConversationId');

                                // Fallback to latest if available
                                if (fetchedConversations.length > 0) {
                                    loadConversation(fetchedConversations[0].id);
                                }
                            }
                        } else if (fetchedConversations.length > 0) {
                            // 3. Fallback to latest
                            loadConversation(fetchedConversations[0].id);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading conversations:', error);
            }
        };

        loadConversations();
    }, [session]);

    // Check usage limits and admin status on mount
    useEffect(() => {
        const checkUsageLimits = async () => {
            if (!session?.user) return;

            // Set admin status from session (already available)
            // @ts-ignore - role is added by NextAuth callbacks
            setIsAdmin(session.user.role === 'ADMIN');

            try {
                const response = await authedFetch('/api/usage', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();

                    if (data.isLimitReached) {
                        setUsageLimitInfo({
                            isLimitReached: true,
                            planName: data.plan.name,
                            usage: {
                                current: data.usage.current,
                                limit: data.usage.limit,
                            },
                            resetDate: data.resetDate,
                        });
                    } else {
                        setUsageLimitInfo(null);
                    }
                }
            } catch (error) {
                console.error('Error checking usage limits:', error);
            }
        };

        checkUsageLimits();
    }, [session]);

    // インフルエンサーモード変更時に初期メッセージを更新
    useEffect(() => {
        const defaultMessage = 'BulnaAIへようこそ！今日はどのようなご用件でしょうか？';
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

            const response = await authedFetch('/api/gemini/chat', {
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
        let toastAction: { label: string; onClick: () => void } | undefined;
        let supportId: string | undefined;
        let retryAfterText: string | undefined;

        if (error instanceof ApiError) {
            const mapped = buildUserFacingErrorMessage(error);
            errorMessage = mapped.message;
            toastAction = mapped.action;
            supportId = error.requestId;
            retryAfterText = mapped.retryAfterText;

            // For rate limit errors, keep usage panel in sync if payload contains details.
            if (error.code === 'RATE_LIMIT_EXCEEDED' && error.payload) {
                setUsageLimitInfo({
                    isLimitReached: true,
                    planName: error.payload.planName || 'FREE',
                    usage: {
                        current: error.payload.usage?.current || 0,
                        limit: error.payload.usage?.limit ?? null,
                    },
                    resetDate: error.payload.resetDate || null,
                });
            }
        } else if (error?.message) {
            errorMessage = error.message;
        }

        // Always show toast for all errors with enhanced information
        showToast({
            message: errorMessage,
            type: 'error',
            duration: 8000,
            action: toastAction,
            supportId,
            retryAfterText,
        });

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
     * Generate a title for the conversation based on the first user message
     */
    const generateConversationTitle = async (userMessage: string): Promise<string | null> => {
        try {
            const response = await authedFetch('/api/gemini/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `以下のユーザーメッセージに基づいて、この会話の簡潔なタイトル（15文字以内）を1つだけ生成してください。タイトルのみを出力し、他の説明は不要です。\n\nユーザーメッセージ: ${userMessage}`,
                    mode: 'chat',
                    temperature: 0.3,
                }),
            });

            if (!response.ok) return null;

            const data = await response.json();
            const title = data.result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            return title ? title.slice(0, 50) : null; // Max 50 chars
        } catch {
            return null;
        }
    };

    /**
     * Update conversation title
     */
    const updateConversationTitle = async (conversationId: string, title: string) => {
        try {
            await authedFetch(`/api/conversations/${conversationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });

            // Update local state
            setConversations(prev =>
                prev.map(c =>
                    c.id === conversationId ? { ...c, title } : c
                )
            );
        } catch (error) {
            console.error('Error updating conversation title:', error);
        }
    };

    /**
     * Create a new conversation or return existing one
     * Only saves if user is authenticated
     */
    const createOrGetConversation = async (firstMessage?: string): Promise<string | null> => {
        // Skip if not authenticated
        if (!session?.user) {
            return null;
        }

        // Return existing conversation ID if already created
        if (currentConversationIdRef.current) {
            return currentConversationIdRef.current;
        }

        try {
            const response = await authedFetch('/api/conversations', {
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
            currentConversationIdRef.current = conversationId;

            // Add to conversations list immediately with placeholder title
            const newConversation = {
                id: conversationId,
                title: null,
                mode: mode.toUpperCase(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messageCount: 0,
            };
            setConversations(prev => [newConversation, ...prev]);

            // Generate title asynchronously if first message provided
            if (firstMessage) {
                generateConversationTitle(firstMessage).then(title => {
                    if (title) {
                        updateConversationTitle(conversationId, title);
                    }
                });
            }

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
    const saveMessage = async (
        role: 'USER' | 'MODEL',
        parts: ContentPart[],
        conversationIdOverride?: string | null,
        messageMode?: GenerationMode
    ) => {
        const activeConversationId = conversationIdOverride || currentConversationIdRef.current;

        // Skip if not authenticated or no conversation
        if (!session?.user || !activeConversationId) {
            return;
        }

        try {
            await authedFetch(`/api/conversations/${activeConversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    mode: messageMode?.toUpperCase() || mode.toUpperCase(), // Use passed mode or current mode
                    content: parts,
                }),
            });
        } catch (error) {
            // Silent fail - don't disrupt user experience
            console.error('Error saving message:', error);
        }
    };

    const [isLoadingConversation, setIsLoadingConversation] = useState(false);

    /**
     * Load a conversation and display its messages
     */
    const loadConversation = async (conversationId: string) => {
        if (!session?.user) return;
        if (isLoadingConversation) return;

        setIsLoadingConversation(true);
        // Optimistically set current ref to track user intent and prevent race conditions
        currentConversationIdRef.current = conversationId;

        try {
            const response = await authedFetch(`/api/conversations/${conversationId}`);

            // Race condition check: did the user switch conversations while fetching?
            if (currentConversationIdRef.current !== conversationId) {
                return;
            }

            if (response.ok) {
                const data = await response.json();
                const conversation = data.conversation;

                // Update UI state
                setCurrentConversationId(conversation.id);

                // Persist to URL and LocalStorage
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('c', conversation.id);
                // Preserve existing state object to avoid breaking router history
                window.history.replaceState(window.history.state, '', newUrl);

                // Safe to set localStorage as we verified we are still on the target conversation
                localStorage.setItem('lastActiveConversationId', conversation.id);

                // Set mode from conversation if available
                if (conversation.mode) {
                    const modeMap: Record<string, GenerationMode> = {
                        'CHAT': 'chat',
                        'PRO': 'pro',
                        'SEARCH': 'search',
                        'IMAGE': 'image',
                        'VIDEO': 'video',
                    };
                    const newMode = modeMap[conversation.mode] || 'chat';
                    setMode(newMode);
                }

                // Convert database messages to UI messages
                const loadedMessages: Message[] = conversation.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role.toLowerCase(),
                    parts: Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content) }],
                }));

                // If no messages, show initial greeting
                if (loadedMessages.length === 0) {
                    const config = getInfluencerConfig(selectedInfluencer);
                    const defaultMessage = 'BulnaAIへようこそ！今日はどのようなご用件でしょうか？';
                    setMessages([
                        {
                            id: 'init',
                            role: 'model',
                            parts: [{ text: config?.initialMessage || defaultMessage }],
                        },
                    ]);
                } else {
                    setMessages(loadedMessages);
                }

                setIsSidebarOpen(false); // Close sidebar on mobile
            }
        } finally {
            setIsLoadingConversation(false);
        }
    };

    /**
     * Start a new conversation
     */
    const startNewConversation = () => {
        // Clear persistence
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('c');
        window.history.replaceState({}, '', newUrl);
        localStorage.removeItem('lastActiveConversationId');

        // Reset to initial state
        const config = getInfluencerConfig(selectedInfluencer);
        const defaultMessage = 'BulnaAIへようこそ！今日はどのようなご用件でしょうか？';

        setCurrentConversationId(null);
        currentConversationIdRef.current = null;
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
            const response = await authedFetch(`/api/conversations/${conversationId}`, {
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
        messageId: string,
        initialOperation?: any
    ): Promise<ContentPart[] | null> => {
        let pollAttempts = 0;
        let done = false;
        let currentOperationName = operationName;
        let operationDescriptor = initialOperation || { name: operationName };

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
                const statusResponse = await authedFetch('/api/gemini/video/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operationName: currentOperationName,
                        operation: operationDescriptor,
                    }),
                });

                if (!statusResponse.ok) {
                    const errorData = await statusResponse.json();
                    throw new Error(errorData.error || ERROR_MESSAGES.VIDEO_GENERATION_FAILED);
                }

                const statusData = await statusResponse.json();
                const { operation, operationName: returnedOperationName } = statusData;
                if (returnedOperationName) {
                    currentOperationName = returnedOperationName;
                }
                operationDescriptor = operation || operationDescriptor;
                const operationPayload = operation || operationDescriptor;

                // Update progress
                const progress = operationPayload?.metadata?.progressPercentage || 0;
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

                if (operationPayload.done) {
                    done = true;

                    // Check for errors
                    if (operationPayload.error) {
                        const apiErrorMessage =
                            operationPayload.error.message || ERROR_MESSAGES.VIDEO_GENERATION_FAILED;
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

                    try {
                        const downloadTarget = getGeneratedVideoDownloadTarget(operationPayload);
                        if (!downloadTarget) {
                            throw new Error('生成された動画のURIを取得できませんでした。');
                        }

                        const params = new URLSearchParams();
                        if (downloadTarget.uri) {
                            params.append('uri', downloadTarget.uri);
                        }
                        if (downloadTarget.file) {
                            params.append('file', downloadTarget.file);
                        }
                        if (downloadTarget.mimeType) {
                            params.append('mimeType', downloadTarget.mimeType);
                        }
                        const query = params.toString();
                        const videoUrl = query
                            ? `/api/gemini/video/download?${query}`
                            : '/api/gemini/video/download';

                        const videoResponse = await authedFetch(videoUrl);
                        if (!videoResponse.ok) {
                            const errorPayload = await videoResponse.json().catch(() => null);
                            throw new Error(
                                errorPayload?.error || ERROR_MESSAGES.VIDEO_GENERATION_FAILED
                            );
                        }

                        const videoBlob = await videoResponse.blob();
                        const videoDataUrl = URL.createObjectURL(videoBlob);

                        // Track blob URL for cleanup
                        blobUrlsRef.current.add(videoDataUrl);

                        const videoParts: ContentPart[] = [
                            {
                                media: {
                                    type: 'video',
                                    url: videoDataUrl,
                                    mimeType: downloadTarget.mimeType || 'video/mp4',
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
                    } catch (downloadError: any) {
                        const formattedError = await formatErrorMessage(
                            `ビデオ生成エラー: ${downloadError?.message || ERROR_MESSAGES.VIDEO_GENERATION_FAILED}`
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
        // Pass the first message for auto-title generation
        const isNewConversation = !currentConversationIdRef.current;
        const activeConversationId =
            (await createOrGetConversation(isNewConversation ? prompt : undefined)) ||
            currentConversationIdRef.current;

        // Save user message
        await saveMessage('USER', userParts, activeConversationId);

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
                const response = await authedFetch('/api/gemini/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, aspectRatio }),
                });

                if (!response.ok) {
                    const errorData = (await parseJsonSafe(response)) as ApiErrorPayload | null;

                    // Handle rate limit exceeded (429)
                    if (response.status === 429 && errorData?.code === 'RATE_LIMIT_EXCEEDED') {
                        setUsageLimitInfo({
                            isLimitReached: true,
                            planName: errorData.planName || 'FREE',
                            usage: {
                                current: errorData.usage?.current || 0,
                                limit: errorData.usage?.limit || null,
                            },
                            resetDate: errorData.resetDate || null,
                        });
                    }

                    throw new ApiError(
                        response.status,
                        errorData || undefined,
                        ERROR_MESSAGES.IMAGE_GENERATION_FAILED
                    );
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
                const response = await authedFetch('/api/gemini/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt,
                        aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
                        media: uploadedMedia,
                    }),
                });

                if (!response.ok) {
                    const errorData = (await parseJsonSafe(response)) as ApiErrorPayload | null;

                    // Handle rate limit exceeded (429)
                    if (response.status === 429 && errorData?.code === 'RATE_LIMIT_EXCEEDED') {
                        setUsageLimitInfo({
                            isLimitReached: true,
                            planName: errorData.planName || 'FREE',
                            usage: {
                                current: errorData.usage?.current || 0,
                                limit: errorData.usage?.limit || null,
                            },
                            resetDate: errorData.resetDate || null,
                        });
                    }

                    throw new ApiError(
                        response.status,
                        errorData || undefined,
                        ERROR_MESSAGES.VIDEO_GENERATION_FAILED
                    );
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
                // Support both operation object and operationName (for backward compatibility)
                const operationName = data.operation?.name || data.operationName;
                if (!operationName) {
                    throw new Error('Operation name not found in video generation response');
                }
                const videoParts = await pollVideoStatus(operationName, loadingMessageId, data.operation);

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
                                if (p.media) {
                                    // Handle both image and video media types for history
                                    if (p.media.type === 'image') {
                                        return {
                                            media: {
                                                url: p.media.url,
                                                mimeType: p.media.mimeType,
                                                type: 'image',
                                            },
                                        };
                                    }
                                    if (p.media.type === 'video') {
                                        return {
                                            media: {
                                                url: p.media.url,
                                                mimeType: p.media.mimeType,
                                                type: 'video',
                                            },
                                        };
                                    }
                                }
                                return null;
                            })
                            .filter(
                                (part): part is { text: string } | { media: Media } => part !== null
                            ),
                    }))
                    .filter(m => m.parts.length > 0);

                const response = await authedFetch('/api/gemini/chat', {
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
                    const errorData = (await parseJsonSafe(response)) as ApiErrorPayload | null;

                    // Handle rate limit exceeded (429)
                    if (response.status === 429 && errorData?.code === 'RATE_LIMIT_EXCEEDED') {
                        setUsageLimitInfo({
                            isLimitReached: true,
                            planName: errorData.planName || 'FREE',
                            usage: {
                                current: errorData.usage?.current || 0,
                                limit: errorData.usage?.limit || null,
                            },
                            resetDate: errorData.resetDate || null,
                        });
                    }

                    throw new ApiError(
                        response.status,
                        errorData || undefined,
                        ERROR_MESSAGES.GENERIC_ERROR
                    );
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

            // Clear retry state on success
            setLastFailedPrompt(null);
            setLastFailedMedia(null);
        } catch (error: any) {
            // Store failed prompt and media for retry
            setLastFailedPrompt(prompt);
            setLastFailedMedia(uploadedMedia || null);

            const shouldUseDjShachoStyle = mode === 'image' || mode === 'video';
            await handleApiError(error, `mode: ${mode}`, shouldUseDjShachoStyle);
        } finally {
            setIsLoading(false);
        }
    };

    // Retry handler for failed messages
    const handleRetry = () => {
        if (lastFailedPrompt) {
            handleSendMessage(lastFailedPrompt, lastFailedMedia || undefined);
        }
    };

    // Clear retry state
    const handleClearRetry = () => {
        setLastFailedPrompt(null);
        setLastFailedMedia(null);
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
            const response = await authedFetch('/api/gemini/image', {
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
                className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } fixed md:relative md:translate-x-0 w-72 md:w-64 h-full bg-gray-800 border-r border-gray-700 transition-transform duration-300 z-50 flex flex-col safe-area-top`}
            >
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between mb-3 md:hidden">
                        <span className="font-semibold text-gray-200">会話履歴</span>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            aria-label="サイドバーを閉じる"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <button
                        onClick={startNewConversation}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg font-medium transition-colors min-h-[48px]"
                    >
                        + 新しい会話
                    </button>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto p-2 overscroll-contain">
                    {session?.user ? (
                        conversations.length > 0 ? (
                            conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    onClick={() => loadConversation(conv.id)}
                                    className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors min-h-[56px] active:scale-[0.98] ${conv.id === currentConversationId
                                        ? 'bg-gray-700'
                                        : 'hover:bg-gray-700/50 active:bg-gray-700'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate text-sm md:text-base">
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
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                                            aria-label="会話を削除"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-400 mt-8 px-4">
                                <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <p>会話がありません</p>
                                <p className="text-sm mt-1">新しい会話を始めましょう</p>
                            </div>
                        )
                    ) : (
                        <div className="text-center text-gray-400 mt-8 px-4">
                            <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <p>ログインして会話を保存</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Footer - Admin Link */}
                {isAdmin && (
                    <div className="p-4 border-t border-gray-700">
                        <a
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg font-medium transition-colors min-h-[48px]"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                            管理ダッシュボード
                        </a>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Hamburger Menu Button (Mobile) */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="md:hidden p-2 hover:bg-gray-700 rounded-lg flex-shrink-0"
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
                        <SparklesIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
                        <h1 className="text-base md:text-xl font-bold truncate">BulnaAI</h1>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                        {/* Login/Logout Button */}
                        {/* Note: At this point, user is authenticated (landing page check passed) */}
                        <div className="flex items-center gap-2 md:gap-3">
                            <a
                                href="/pricing"
                                className="hidden sm:block px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                            >
                                料金プラン
                            </a>
                            <button
                                onClick={() => signOut({ callbackUrl: window.location.href })}
                                className="px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                ログアウト
                            </button>
                        </div>
                        <div className="relative hidden sm:block">
                            <div className="w-24 md:w-32 h-2 bg-gray-700 rounded-full">
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

                {/* Usage Limit Banner - shown above chat input when limit reached */}
                {usageLimitInfo?.isLimitReached && (
                    <div className="px-4 pt-2">
                        <UsageLimitBanner
                            limitInfo={usageLimitInfo}
                            onDismiss={() => setUsageLimitInfo(null)}
                        />
                    </div>
                )}

                <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading || (usageLimitInfo?.isLimitReached ?? false)}
                    mode={mode}
                    setMode={setMode}
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    selectedInfluencer={selectedInfluencer}
                    setSelectedInfluencer={setSelectedInfluencer}
                    lastFailedPrompt={lastFailedPrompt}
                    lastFailedMedia={lastFailedMedia}
                    onRetry={handleRetry}
                    onClearRetry={handleClearRetry}
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
