import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, GenerateContentResponse, ContentPart as GeminiContentPart } from '@google/genai';
import { Message, GenerationMode, AspectRatio, Media, ContentPart as AppContentPart } from './types';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import ApiKeyModal from './components/ApiKeyModal';
import { SparklesIcon } from './components/icons';
import * as geminiService from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { DJ_SHACHO_INITIAL_MESSAGE, DJ_SHACHO_SYSTEM_PROMPT } from './services/prompts/djShachoPrompt';

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
        { id: 'init', role: 'model', parts: [{ text: "クリエイティブフロースタジオへようこそ！今日はどのようなご用件でしょうか？" }] }
    ]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [mode, setMode] = useState<GenerationMode>('chat');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [isDjShachoMode, setIsDjShachoMode] = useState<boolean>(false);
    const [isApiKeySelected, setIsApiKeySelected] = useState<boolean>(true); // Assume true initially to avoid flicker
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const isDjShachoModeRef = useRef(isDjShachoMode);

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
    
    useEffect(() => {
        isDjShachoModeRef.current = isDjShachoMode;
    }, [isDjShachoMode]);

    // DJ社長モード変更時に初期メッセージを更新
    useEffect(() => {
        setMessages(prev => {
            if (prev.length === 1 && prev[0].id === 'init') {
                if (isDjShachoMode && prev[0].parts[0].text !== DJ_SHACHO_INITIAL_MESSAGE) {
                    return [{ id: 'init', role: 'model', parts: [{ text: DJ_SHACHO_INITIAL_MESSAGE }] }];
                } else if (!isDjShachoMode && prev[0].parts[0].text === DJ_SHACHO_INITIAL_MESSAGE) {
                    return [{ id: 'init', role: 'model', parts: [{ text: "クリエイティブフロースタジオへようこそ！今日はどのようなご用件でしょうか？" }] }];
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
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = updater(newMessages[newMessages.length - 1]);
            return newMessages;
        });
    };

    const handleApiError = async (error: any, context: string, isDjShachoModeForError?: boolean) => {
        console.error(`Error in ${context}:`, error);
        let errorMessage = `エラーが発生しました。もう一度お試しください。`;
        
        if (error.message && error.message.includes("Requested entity was not found")) {
            errorMessage = "APIキーが見つからないか、無効です。有効なキーを選択してください。";
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
                    parts: [{ isError: true, text: djShachoErrorMessage }]
                }));
            } catch (styleError) {
                // スタイル変換に失敗した場合は通常のエラーメッセージを使用
                updateLastMessage(msg => ({
                    ...msg,
                    parts: [{ isError: true, text: `エラー: ${errorMessage}` }]
                }));
            }
        } else {
            updateLastMessage(msg => ({
                ...msg,
                parts: [{ isError: true, text: `エラー: ${errorMessage}` }]
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
                0.9
            );
            
            // テキストレスポンスの取得（型の違いに対応）
            const responseText = (result as any).text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return responseText || errorMessage;
        } catch (error) {
            // 変換に失敗した場合は元のエラーメッセージを返す
            console.error('Failed to convert error message to DJ Shacho style:', error);
            return errorMessage;
        }
    };
    const ensureDjShachoTone = useCallback(async (text: string) => {
        if (!isDjShachoModeRef.current || !text?.trim()) {
            console.log('[ensureDjShachoTone] スキップ:', { isDjShachoMode: isDjShachoModeRef.current, hasText: !!text?.trim() });
            return text;
        }

        try {
            console.log('[ensureDjShachoTone] DJ社長スタイルを適用中...');
            const prompt = `以下の回答文をDJ社長（木元駿之介）のスタイルに変換してください。九州弁を使い、常にハイテンションで、ポジティブに、でも内容の正確さは維持してください。\n\n回答文: ${text}`;
            const result = await geminiService.generateChatResponse(
                [],
                prompt,
                DJ_SHACHO_SYSTEM_PROMPT,
                0.9
            );
            const styledText = (result as any).text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
            console.log('[ensureDjShachoTone] スタイル適用完了:', styledText.substring(0, 100) + '...');
            return styledText || text;
        } catch (error) {
            console.error('[ensureDjShachoTone] エラー:', error);
            return text;
        }
    }, []);

    const pollVideoStatus = async (operation: any, messageId: string) => {
        let currentOperation = operation;
        while (!currentOperation.done) {
            setMessages(prev => prev.map(m => m.id === messageId ? {
                ...m,
                parts: [{ isLoading: true, status: `ビデオを処理中...(${(currentOperation.metadata?.progressPercentage || 0).toFixed(0)}%)` }]
            } : m));
            
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
            try {
                 currentOperation = await geminiService.pollVideoOperation(currentOperation);
            } catch (error) {
                 await handleApiError(error, 'video polling', true);
                 return;
            }
        }
        
        // When operation is done, check for explicit errors from the API
        if (currentOperation.error) {
            console.error("Video generation failed with an API error:", currentOperation.error);
            const apiErrorMessage = currentOperation.error.message || "不明なエラーによりビデオの生成に失敗しました。";
            // DJ社長モードがONの場合、エラーメッセージをDJ社長スタイルに変換
            if (isDjShachoModeRef.current) {
                try {
                    const djShachoErrorMessage = await convertToDjShachoStyle(apiErrorMessage);
                    setMessages(prev => prev.map(m => m.id === messageId ? {
                        ...m,
                        parts: [{ isError: true, text: djShachoErrorMessage }]
                    } : m));
                } catch (styleError) {
                    setMessages(prev => prev.map(m => m.id === messageId ? {
                        ...m,
                        parts: [{ isError: true, text: `ビデオ生成エラー: ${apiErrorMessage}` }]
                    } : m));
                }
            } else {
                setMessages(prev => prev.map(m => m.id === messageId ? {
                    ...m,
                    parts: [{ isError: true, text: `ビデオ生成エラー: ${apiErrorMessage}` }]
                } : m));
            }
            return;
        }

        if (currentOperation.response?.generatedVideos?.[0]?.video?.uri) {
            const downloadLink = currentOperation.response.generatedVideos[0].video.uri;
            const videoUrl = `${downloadLink}&key=${process.env.API_KEY}`;
            const videoResponse = await fetch(videoUrl);
            const videoBlob = await videoResponse.blob();
            const videoDataUrl = URL.createObjectURL(videoBlob);
            
            setMessages(prev => prev.map(m => m.id === messageId ? {
                ...m,
                parts: [{ media: { type: 'video', url: videoDataUrl, mimeType: 'video/mp4' } }]
            } : m));
        } else {
            const errorMessage = "ビデオの生成は完了しましたが、ビデオデータが返されませんでした。プロンプトの内容に問題があるか、一時的なAPIの問題の可能性があります。";
            // DJ社長モードがONの場合、エラーメッセージをDJ社長スタイルに変換
            if (isDjShachoModeRef.current) {
                try {
                    const djShachoErrorMessage = await convertToDjShachoStyle(errorMessage);
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, parts: [{ isError: true, text: djShachoErrorMessage }] } : m));
                } catch (styleError) {
                    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, parts: [{ isError: true, text: errorMessage }] } : m));
                }
            } else {
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, parts: [{ isError: true, text: errorMessage }] } : m));
            }
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
        setMessages(prev => [...prev, { id: loadingMessageId, role: 'model', parts: [{ isLoading: true }] }]);

        try {
            // DJ社長モードの設定
            const systemInstruction = isDjShachoMode ? DJ_SHACHO_SYSTEM_PROMPT : undefined;
            const temperature = isDjShachoMode ? 0.9 : undefined;
            console.log('[handleSendMessage] DJ社長モード:', { isDjShachoMode, hasSystemInstruction: !!systemInstruction, temperature, mode });

            if (mode === 'image') {
                // 画像生成ではプロンプトはそのまま使用（DJ社長モードはエラーメッセージにのみ適用）
                const imageUrl = await geminiService.generateImage(prompt, aspectRatio);
                setMessages(prev => prev.map(m => m.id === loadingMessageId ? { ...m, parts: [{ media: { type: 'image', url: imageUrl, mimeType: 'image/png' } }] } : m));
            } else if (mode === 'video') {
                if (!isApiKeySelected) {
                    await checkApiKey();
                    if (!(await window.aistudio.hasSelectedApiKey())) {
                         await handleApiError({message: "ビデオ生成にはAPIキーが必要です。"}, "video generation", true);
                         setIsLoading(false);
                         return;
                    }
                }
                // 動画生成ではプロンプトはそのまま使用（DJ社長モードはエラーメッセージにのみ適用）
                const operation = await geminiService.generateVideo(prompt, aspectRatio === '16:9' ? '16:9' : '9:16', uploadedMedia);
                setMessages(prev => prev.map(m => m.id === loadingMessageId ? { ...m, parts: [{ isLoading: true, status: "ビデオ生成を開始しました..." }] } : m));
                await pollVideoStatus(operation, loadingMessageId);

            } else if (uploadedMedia && uploadedMedia.type === 'image') {
                 const result = await geminiService.analyzeImage(prompt, uploadedMedia, systemInstruction);
                 // analyzeImageの戻り値はGenerateContentResponse型
                 const responseText = (result as any).text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
                 const styledText = await ensureDjShachoTone(responseText);
                 setMessages(prev => prev.map(m => m.id === loadingMessageId ? { ...m, parts: [{ text: styledText }] } : m));
            } else {
                let result: GenerateContentResponse;
                if (mode === 'pro') {
                    result = await geminiService.generateProResponse(prompt, systemInstruction, temperature);
                } else if (mode === 'search') {
                    // リサーチモード: Google Searchを使用して検索を実行
                    // DJ社長モードがONの場合、systemInstructionにDJ_SHACHO_SYSTEM_PROMPTが設定され、
                    // 検索結果をDJ社長の口調（九州弁、ハイテンション、ポジティブ）で返す
                    result = await geminiService.generateSearchGroundedResponse(prompt, systemInstruction, temperature);
                } else { // chat
                    const history = messages
                        .filter(m => m.role === 'user' || m.role === 'model')
                        .flatMap(m => m.parts.map(p => ({ role: m.role, parts: [{ text: p.text || '' }] }))) as GeminiContentPart[];
                    // Fix: Directly await the response and assign to result, simplifying the logic.
                    result = await geminiService.generateChatResponse(history, prompt, systemInstruction, temperature);
                }
                
                const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
                const sources = groundingChunks?.map((c: any) => ({ uri: c.web.uri, title: c.web.title })) || [];
                
                // テキストレスポンスの取得（型の違いに対応）
                const responseText = (result as any).text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const styledText = await ensureDjShachoTone(responseText);
                setMessages(prev => prev.map(m => m.id === loadingMessageId ? { ...m, parts: [{ text: styledText, sources }] } : m));
            }
        } catch (error) {
            // 画像・動画生成のエラーではDJ社長モードを適用
            const shouldUseDjShachoStyle = (mode === 'image' || mode === 'video');
            await handleApiError(error, `mode: ${mode}`, shouldUseDjShachoStyle);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEditImage = async (prompt: string, image: Media) => {
        setIsLoading(true);
        addMessage({ role: 'user', parts: [{ text: `画像編集: 「${prompt}」` }] });

        const loadingMessageId = Date.now().toString() + '-editing';
        setMessages(prev => [...prev, { 
            id: loadingMessageId, 
            role: 'model', 
            parts: [{ isLoading: true, isEditing: true, originalMedia: image }] 
        }]);

        try {
            const editedImageUrl = await geminiService.editImage(prompt, image);
            setMessages(prev => prev.map(m => m.id === loadingMessageId ? { 
                ...m, 
                parts: [{ media: { type: 'image', url: editedImageUrl, mimeType: 'image/png' } }] 
            } : m));
        } catch (error) {
            handleApiError(error, 'image editing');
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
                    <h1 className="text-xl font-bold">クリエイティブフロースタジオ</h1>
                </div>
                 <div className="relative">
                    <div className="w-32 h-2 bg-gray-700 rounded-full">
                        <div className="h-2 bg-green-500 rounded-full" style={{ width: '80%' }}></div>
                    </div>
                    <span className="absolute -top-5 right-0 text-xs text-gray-400">クォータ: 80%</span>
                </div>
            </header>

            <main ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
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
