import {
    GenerateContentResponse
} from '@google/genai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ApiKeyModal from './components/ApiKeyModal';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import { SparklesIcon } from './components/icons';
import {
    DJ_SHACHO_TEMPERATURE,
    ERROR_MESSAGES,
    MAX_VIDEO_POLL_ATTEMPTS,
    VIDEO_POLL_INTERVAL_MS,
} from './constants';
import * as geminiService from './services/geminiService';
import {
    DJ_SHACHO_INITIAL_MESSAGE,
    DJ_SHACHO_SYSTEM_PROMPT,
} from './services/prompts/djShachoPrompt';
import {
    ContentPart as AppContentPart,
    AspectRatio,
    GenerationMode,
    Media,
    Message,
} from './types';
import type { GeminiResponse } from './types/gemini';
import { extractTextFromResponse } from './types/gemini';
import { dataUrlToBase64 } from './utils/fileUtils';

// Fix: Use a named interface 'AIStudio' to resolve declaration conflicts.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio: AIStudio;
    }
}

const App: React.FC = () => {
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
    const [isApiKeySelected, setIsApiKeySelected] = useState<boolean>(true); // Assume true initially to avoid flicker
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

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsApiKeySelected(hasKey);
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

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

    const handleApiKeySelect = async () => {
        await window.aistudio.openSelectKey();
        // Assume success and optimistically update UI to avoid race condition
        setIsApiKeySelected(true);
    };

    const addMessage = (message: Omit<Message, 'id'>) => {
        setMessages(prev => [...prev, { ...message, id: Date.now().toString() }]);
    };

    const updateLastMessage = (updater: (lastMessage: Message) => Message) => {
        setMessages(prev => {
            if (prev.length === 0) return prev; // Guard against empty messages
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = updater(newMessages[newMessages.length - 1]);
            return newMessages;
        });
    };

    const handleApiError = async (
        error: any,
        context: string,
        isDjShachoModeForError?: boolean
    ) => {
        if (import.meta.env.DEV) {
            console.error(`Error in ${context}:`, error);
        }
        let errorMessage = ERROR_MESSAGES.GENERIC_ERROR;

        if (error.message && error.message.includes('Requested entity was not found')) {
            errorMessage = ERROR_MESSAGES.API_KEY_NOT_FOUND;
            setIsApiKeySelected(false); // Force user to re-select key
        } else if (error.message) {
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
            } catch (styleError) {
                // スタイル変換に失敗した場合は通常のエラーメッセージを使用
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

    // エラーメッセージをDJ社長スタイルに変換
    const convertToDjShachoStyle = async (errorMessage: string): Promise<string> => {
        try {
            const prompt = `以下のエラーメッセージをDJ社長（木元駿之介）のスタイルで説明してください。九州弁を使い、ハイテンションで、ポジティブに、でもエラーの内容は正確に伝えてください。\n\nエラーメッセージ: ${errorMessage}`;

            const result = await geminiService.generateChatResponse(
                [],
                prompt,
                DJ_SHACHO_SYSTEM_PROMPT,
                DJ_SHACHO_TEMPERATURE
            );

            // テキストレスポンスの取得（型の違いに対応）
            const responseText = extractTextFromResponse(result as GeminiResponse);
            return responseText || errorMessage;
        } catch (error) {
            // 変換に失敗した場合は元のエラーメッセージを返す
            return errorMessage;
        }
    };

    // エラーメッセージをフォーマット（DJ社長モードが有効な場合はスタイル変換）
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

    const pollVideoStatus = async (operation: any, messageId: string) => {
        let currentOperation = operation;
        let pollAttempts = 0;

        while (!currentOperation.done) {
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

            // Validate and display progress
            const progress = currentOperation.metadata?.progressPercentage || 0;
            const validatedProgress = Math.max(0, Math.min(100, progress)); // Clamp to 0-100
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

            await new Promise(resolve => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

            // Increment counter before API call to ensure timeout protection works even if calls fail
            pollAttempts++;

            try {
                currentOperation = await geminiService.pollVideoOperation(currentOperation);
            } catch (error) {
                await handleApiError(error, 'video polling', true);
                return;
            }
        }

        // When operation is done, check for explicit errors from the API
        if (currentOperation.error) {
            const apiErrorMessage =
                currentOperation.error.message || ERROR_MESSAGES.VIDEO_GENERATION_FAILED;
            const formattedError = await formatErrorMessage(`ビデオ生成エラー: ${apiErrorMessage}`);
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

        if (currentOperation.response?.generatedVideos?.[0]?.video?.uri) {
            const downloadLink = currentOperation.response.generatedVideos[0].video.uri;
            const videoUrl = `${downloadLink}&key=${process.env.API_KEY}`;
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
            const formattedError = await formatErrorMessage(ERROR_MESSAGES.VIDEO_GENERATION_FAILED);
            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, parts: [{ isError: true, text: formattedError }] }
                        : m
                )
            );
        }
    };

    const handleSendMessage = async (prompt: string, uploadedMedia?: Media) => {
        if (isLoading) return;
        setIsLoading(true);

        const userParts: AppContentPart[] = [];
        if (prompt) userParts.push({ text: prompt });
        if (uploadedMedia) userParts.push({ media: uploadedMedia });
        addMessage({ role: 'user', parts: userParts });

        const loadingMessageId = Date.now().toString() + '-loading';
        setMessages(prev => [
            ...prev,
            { id: loadingMessageId, role: 'model', parts: [{ isLoading: true }] },
        ]);

        try {
            // DJ社長モードの設定
            const systemInstruction = isDjShachoMode ? DJ_SHACHO_SYSTEM_PROMPT : undefined;
            const temperature = isDjShachoMode ? DJ_SHACHO_TEMPERATURE : undefined;

            if (mode === 'image') {
                // 画像生成ではプロンプトはそのまま使用（DJ社長モードはエラーメッセージにのみ適用）
                const imageUrl = await geminiService.generateImage(prompt, aspectRatio);
                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? {
                                  ...m,
                                  parts: [
                                      {
                                          media: {
                                              type: 'image',
                                              url: imageUrl,
                                              mimeType: 'image/png',
                                          },
                                      },
                                  ],
                              }
                            : m
                    )
                );
            } else if (mode === 'video') {
                if (!isApiKeySelected) {
                    await checkApiKey();
                    if (!(await window.aistudio.hasSelectedApiKey())) {
                        await handleApiError(
                            { message: ERROR_MESSAGES.VIDEO_API_KEY_REQUIRED },
                            'video generation',
                            true
                        );
                        setIsLoading(false);
                        return;
                    }
                }
                // 動画生成ではプロンプトはそのまま使用（DJ社長モードはエラーメッセージにのみ適用）
                const operation = await geminiService.generateVideo(
                    prompt,
                    aspectRatio === '16:9' ? '16:9' : '9:16',
                    uploadedMedia
                );
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
                await pollVideoStatus(operation, loadingMessageId);
            } else if (uploadedMedia && uploadedMedia.type === 'image') {
                const result = await geminiService.analyzeImage(
                    prompt,
                    uploadedMedia,
                    systemInstruction
                );
                // analyzeImageの戻り値はGenerateContentResponse型
                const responseText = extractTextFromResponse(result as GeminiResponse);
                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId ? { ...m, parts: [{ text: responseText }] } : m
                    )
                );
            } else {
                let result: GenerateContentResponse;
                if (mode === 'pro') {
                    result = await geminiService.generateProResponse(
                        prompt,
                        systemInstruction,
                        temperature
                    );
                } else if (mode === 'search') {
                    // リサーチモード: Google Searchを使用して検索を実行
                    // DJ社長モードがONの場合、systemInstructionにDJ_SHACHO_SYSTEM_PROMPTが設定され、
                    // 検索結果をDJ社長の口調（九州弁、ハイテンション、ポジティブ）で返す
                    result = await geminiService.generateSearchGroundedResponse(
                        prompt,
                        systemInstruction,
                        temperature
                    );
                } else {
                    // chat
                    // Build conversation history preserving multimodal content
                    const history = messages
                        .filter(m => m.role === 'user' || m.role === 'model')
                        .map(m => ({
                            role: m.role,
                            parts: m.parts
                                .filter(p => p.text || p.media) // Only include content parts
                                .map(p => {
                                    if (p.text) return { text: p.text };
                                    if (p.media && p.media.type === 'image') {
                                        return {
                                            inlineData: {
                                                mimeType: p.media.mimeType,
                                                data: dataUrlToBase64(p.media.url),
                                            },
                                        };
                                    }
                                    return null;
                                })
                                .filter(
                                    (
                                        part
                                    ): part is
                                        | { text: string }
                                        | { inlineData: { mimeType: string; data: string } } =>
                                        part !== null
                                ),
                        }))
                        .filter(m => m.parts.length > 0); // Exclude messages with no valid parts

                    result = await geminiService.generateChatResponse(
                        history,
                        prompt,
                        systemInstruction,
                        temperature
                    );
                }

                const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
                const sources =
                    groundingChunks?.map((c: any) => ({ uri: c.web.uri, title: c.web.title })) ||
                    [];

                // テキストレスポンスの取得（型の違いに対応）
                const responseText = extractTextFromResponse(result as GeminiResponse);
                setMessages(prev =>
                    prev.map(m =>
                        m.id === loadingMessageId
                            ? { ...m, parts: [{ text: responseText, sources }] }
                            : m
                    )
                );
            }
        } catch (error) {
            // 画像・動画生成のエラーではDJ社長モードを適用
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
            const editedImageUrl = await geminiService.editImage(prompt, image);
            setMessages(prev =>
                prev.map(m =>
                    m.id === loadingMessageId
                        ? {
                              ...m,
                              parts: [
                                  {
                                      media: {
                                          type: 'image',
                                          url: editedImageUrl,
                                          mimeType: 'image/png',
                                      },
                                  },
                              ],
                          }
                        : m
                )
            );
        } catch (error) {
            await handleApiError(error, 'image editing');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            {!isApiKeySelected && <ApiKeyModal onSelectKey={handleApiKeySelect} />}
            <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">BulnaAI</h1>
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
};

export default App;
