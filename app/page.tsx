'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, GenerationMode, AspectRatio, Media, ContentPart } from '@/types/app';
import ChatInput from '@/components/ChatInput';
import ChatMessage from '@/components/ChatMessage';
import { SparklesIcon } from '@/components/icons';
import {
    DJ_SHACHO_INITIAL_MESSAGE,
    DJ_SHACHO_SYSTEM_PROMPT,
    DJ_SHACHO_TEMPERATURE,
    VIDEO_POLL_INTERVAL_MS,
    MAX_VIDEO_POLL_ATTEMPTS,
    ERROR_MESSAGES,
} from '@/lib/constants';

export default function Home() {
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
    const [isDjShachoMode, setIsDjShachoMode] = useState<boolean>(false);
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const isDjShachoModeRef = useRef(isDjShachoMode);

    // Update ref immediately during render to avoid race conditions
    isDjShachoModeRef.current = isDjShachoMode;

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

    // DJ社長モード変更時に初期メッセージを更新
    useEffect(() => {
        setMessages(prev => {
            // Only update if we're still showing the initial message (no conversation yet)
            if (prev.length === 1 && prev[0]?.id === 'init' && prev[0]?.parts?.[0]?.text) {
                const currentText = prev[0].parts[0].text;
                if (isDjShachoMode && currentText !== DJ_SHACHO_INITIAL_MESSAGE) {
                    return [
                        { id: 'init', role: 'model', parts: [{ text: DJ_SHACHO_INITIAL_MESSAGE }] },
                    ];
                } else if (!isDjShachoMode && currentText === DJ_SHACHO_INITIAL_MESSAGE) {
                    return [
                        {
                            id: 'init',
                            role: 'model',
                            parts: [
                                {
                                    text: 'クリエイティブフロースタジオへようこそ！今日はどのようなご用件でしょうか？',
                                },
                            ],
                        },
                    ];
                }
            }
            return prev;
        });
    }, [isDjShachoMode]);

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

    // エラーメッセージをDJ社長スタイルに変換
    const convertToDjShachoStyle = async (errorMessage: string): Promise<string> => {
        try {
            const prompt = `以下のエラーメッセージをDJ社長（木元駿之介）のスタイルで説明してください。九州弁を使い、ハイテンションで、ポジティブに、でもエラーの内容は正確に伝えてください。\n\nエラーメッセージ: ${errorMessage}`;

            const response = await fetch('/api/gemini/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mode: 'chat',
                    systemInstruction: DJ_SHACHO_SYSTEM_PROMPT,
                    temperature: DJ_SHACHO_TEMPERATURE,
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
        isDjShachoModeForError?: boolean
    ) => {
        console.error(`Error in ${context}:`, error);
        let errorMessage = ERROR_MESSAGES.GENERIC_ERROR;

        if (error.message) {
            errorMessage = error.message;
        }

        // 画像・動画生成のエラーでDJ社長モードがONの場合、エラーメッセージをDJ社長スタイルに変換
        if (isDjShachoModeForError && isDjShachoModeRef.current) {
            try {
                const djShachoErrorMessage = await convertToDjShachoStyle(errorMessage);
                updateLastMessage(msg => ({
                    ...msg,
                    parts: [{ isError: true, text: djShachoErrorMessage }],
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
        if (isDjShachoModeRef.current) {
            try {
                return await convertToDjShachoStyle(errorMessage);
            } catch {
                return errorMessage;
            }
        }
        return errorMessage;
    };

    const pollVideoStatus = async (operationName: string, messageId: string) => {
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
                return;
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
                        return;
                    }

                    // Video is ready
                    if (operation.response?.generatedVideos?.[0]?.video?.uri) {
                        const downloadLink = operation.response.generatedVideos[0].video.uri;
                        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
                        const videoUrl = `${downloadLink}&key=${apiKey}`;

                        const videoResponse = await fetch(videoUrl);
                        const videoBlob = await videoResponse.blob();
                        const videoDataUrl = URL.createObjectURL(videoBlob);

                        // Track blob URL for cleanup
                        blobUrlsRef.current.add(videoDataUrl);

                        setMessages(prev =>
                            prev.map(m =>
                                m.id === messageId
                                    ? {
                                          ...m,
                                          parts: [
                                              {
                                                  media: {
                                                      type: 'video',
                                                      url: videoDataUrl,
                                                      mimeType: 'video/mp4',
                                                  },
                                              },
                                          ],
                                      }
                                    : m
                            )
                        );
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
                    }
                }
            } catch (error: any) {
                await handleApiError(error, 'video polling', true);
                return;
            }
        }
    };

    const handleSendMessage = async (prompt: string, uploadedMedia?: Media) => {
        if (isLoading) return;
        setIsLoading(true);

        const userParts: ContentPart[] = [];
        if (prompt) userParts.push({ text: prompt });
        if (uploadedMedia) userParts.push({ media: uploadedMedia });
        addMessage({ role: 'user', parts: userParts });

        const loadingMessageId = Date.now().toString() + '-loading';
        setMessages(prev => [
            ...prev,
            { id: loadingMessageId, role: 'model', parts: [{ isLoading: true }] },
        ]);

        try {
            const systemInstruction = isDjShachoMode ? DJ_SHACHO_SYSTEM_PROMPT : undefined;
            const temperature = isDjShachoMode ? DJ_SHACHO_TEMPERATURE : undefined;

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
                await pollVideoStatus(data.operationName, loadingMessageId);
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

                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? { ...m, parts: [{ text: responseText, sources }] }
                            : m
                    )
                );
            }
        } catch (error: any) {
            const shouldUseDjShachoStyle = mode === 'image' || mode === 'video';
            await handleApiError(error, `mode: ${mode}`, shouldUseDjShachoStyle);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditImage = async (prompt: string, image: Media) => {
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

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">クリエイティブフロースタジオ</h1>
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
            </header>

            <main ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                    <ChatMessage
                        key={msg.id}
                        message={msg}
                        onEditImage={handleEditImage}
                        isDjShachoMode={isDjShachoMode}
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
                isDjShachoMode={isDjShachoMode}
                setIsDjShachoMode={setIsDjShachoMode}
            />
        </div>
    );
}
