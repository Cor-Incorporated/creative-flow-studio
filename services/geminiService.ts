
import { GoogleGenAI, Modality } from '@google/genai';
import { Media } from '../types';
// Fix: Use renamed utility function for clarity.
import { dataUrlToBase64 } from '../utils/fileUtils';

// This function creates a new GoogleGenAI instance for each call.
// This is crucial for Veo to ensure the latest API key from the selection dialog is used.
const getAiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Text Generation ---
export const generateChatResponse = async (history: any[], prompt: string, systemInstruction?: string, temperature?: number) => {
    const ai = getAiClient();
    const chatConfig: any = {
        model: 'gemini-2.5-flash',
        history,
        config: {}
    };
    // @google/genai requires systemInstruction to be in config as array
    if (systemInstruction) {
        chatConfig.config.systemInstruction = [systemInstruction];
    }
    if (temperature !== undefined) {
        chatConfig.config.temperature = temperature;
    }
    const chat = ai.chats.create(chatConfig);
    const result = await chat.sendMessage({ message: prompt });
    // Fix: According to the guidelines, the direct result from `sendMessage` should be returned. Accessing `.response` is incorrect.
    return result;
};

// プロモード: gemini-2.5-proを使用（思考過程を含む高度な応答）
// DJ社長モードがONの場合、systemInstructionで口調を制御
export const generateProResponse = async (prompt: string, systemInstruction?: string, temperature?: number) => {
    const ai = getAiClient();
    // contentsをparts形式に変更（systemInstructionと併用する場合に推奨）
    const requestConfig: any = {
        model: 'gemini-2.5-pro',
        contents: {
            parts: [{ text: prompt }]
        },
        config: {
            thinkingConfig: { thinkingBudget: 32768 }
        }
    };
    // systemInstructionを設定（DJ社長モードがONの場合）
    // @google/genai requires systemInstruction to be in config as array
    if (systemInstruction) {
        requestConfig.config.systemInstruction = [systemInstruction];
    }
    // temperatureを設定（DJ社長モードがONの場合は0.9に設定）
    if (temperature !== undefined) {
        requestConfig.config = { ...requestConfig.config, temperature };
    }

    // Debug: Check if systemInstruction is being applied
    if (import.meta.env.DEV) {
        console.log('[DEBUG] generateProResponse - systemInstruction length:', systemInstruction?.length || 0);
        console.log('[DEBUG] generateProResponse - temperature:', temperature);
        console.log('[DEBUG] generateProResponse - Full requestConfig:', JSON.stringify(requestConfig, null, 2));
    }

    const result = await ai.models.generateContent(requestConfig);

    if (import.meta.env.DEV) {
        console.log('[DEBUG] generateProResponse - Response received, candidates:', result.candidates?.length || 0);
    }

    return result;
};

// リサーチモード（Google Search使用）
// DJ社長モードがONの場合、検索結果をDJ社長の口調で返す
export const generateSearchGroundedResponse = async (prompt: string, systemInstruction?: string, temperature?: number) => {
    const ai = getAiClient();
    
    // まず、Google Searchツールを使用して検索を実行
    const searchRequestConfig: any = {
        model: 'gemini-2.5-flash',
        contents: {
            parts: [{ text: prompt }]
        },
        config: {
            tools: [{ googleSearch: {} }] // Google Searchツールを使用して検索を実行
        }
    };
    
    // 検索を実行（systemInstructionは検索実行時には使用しない）
    const searchResult = await ai.models.generateContent(searchRequestConfig);
    
    // 検索結果を取得
    const searchResponseText = (searchResult as any).text || searchResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const groundingChunks = searchResult.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // DJ社長モードがONの場合、検索結果をDJ社長の口調で再フォーマット
    if (systemInstruction && searchResponseText) {
        // 検索結果をDJ社長の口調で再フォーマットするためのプロンプト
        const reformatPrompt = `以下の検索結果を、DJ社長（木元駿之介）のスタイルで説明してください。九州弁を使い、ハイテンションで、ポジティブに、でも検索結果の内容は正確に伝えてください。

【検索結果】
${searchResponseText}

【元の質問】
${prompt}

上記の検索結果をもとに、DJ社長の口調で回答してください。`;

        const reformatRequestConfig: any = {
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{ text: reformatPrompt }]
            },
            config: {}
        };

        // DJ社長のシステムプロンプトを設定
        // @google/genai requires systemInstruction to be in config as array
        if (systemInstruction) {
            reformatRequestConfig.config.systemInstruction = [systemInstruction];
        }
        if (temperature !== undefined) {
            reformatRequestConfig.config.temperature = temperature;
        }
        
        // 検索結果をDJ社長の口調で再フォーマット
        const reformatResult = await ai.models.generateContent(reformatRequestConfig);
        
        // 再フォーマットされたテキストを取得
        const reformattedText = (reformatResult as any).text || reformatResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // 元の検索結果の構造を保持しながら、テキストを置き換え
        // groundingChunksは元の検索結果から保持
        return {
            ...searchResult,
            candidates: [{
                ...searchResult.candidates?.[0],
                content: {
                    ...searchResult.candidates?.[0]?.content,
                    parts: [{ text: reformattedText }]
                },
                groundingMetadata: searchResult.candidates?.[0]?.groundingMetadata
            }]
        } as any;
    }
    
    // DJ社長モードがOFFの場合は、そのまま検索結果を返す
    return searchResult;
};

// --- Image Generation & Understanding ---
// 注意: 画像生成ではDJ社長モードをONにしてもプロンプトは変更しない
// （Imagen 4.0のポリシーで実在人物名を含むプロンプトがブロックされるため）
export const generateImage = async (prompt: string, aspectRatio: string) => {
    const ai = getAiClient();
    
    // Imagen 4.0のaspectRatio形式を確認（文字列形式の可能性）
    // aspectRatioの値が正しい形式か確認
    const validAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    const normalizedAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : '1:1';
    
    const result = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt, // ユーザーのプロンプトをそのまま使用
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: normalizedAspectRatio,
        },
    });
    
    // エラーハンドリング: generatedImagesが存在し、要素があることを確認
    if (!result || !result.generatedImages || result.generatedImages.length === 0) {
        const httpResponse = result?.sdkHttpResponse as any;
        const errorMessage = httpResponse?.body 
            ? `画像生成に失敗しました: ${JSON.stringify(httpResponse.body)}`
            : '画像生成に失敗しました。生成された画像がありません。プロンプトの内容を確認してください。';
        throw new Error(errorMessage);
    }
    
    const firstImage = result.generatedImages[0];
    if (!firstImage) {
        throw new Error('画像生成に失敗しました。画像データが取得できませんでした。');
    }
    
    // 画像データの取得方法を確認（APIレスポンス構造に応じて）
    let base64ImageBytes: string;
    const imageData = firstImage as any; // 型エラーを回避するため一時的にany型を使用
    
    if (imageData.image && imageData.image.imageBytes) {
        base64ImageBytes = imageData.image.imageBytes;
    } else if (imageData.imageBytes) {
        base64ImageBytes = imageData.imageBytes;
    } else if (imageData.data) {
        base64ImageBytes = imageData.data;
    } else {
        throw new Error('画像生成に失敗しました。画像データの構造が予期されない形式です。');
    }
    
    return `data:image/png;base64,${base64ImageBytes}`;
};

export const analyzeImage = async (prompt: string, image: Media, systemInstruction?: string) => {
    const ai = getAiClient();
    const imagePart = {
        inlineData: {
            mimeType: image.mimeType,
            // Fix: Use renamed utility function for clarity.
            data: dataUrlToBase64(image.url),
        },
    };
    const textPart = { text: prompt };
    const requestConfig: any = {
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {}
    };
    // @google/genai requires systemInstruction to be in config as array
    if (systemInstruction) {
        requestConfig.config.systemInstruction = [systemInstruction];
    }
    const result = await ai.models.generateContent(requestConfig);
    return result;
};

export const editImage = async (prompt: string, image: Media) => {
    const ai = getAiClient();
    const imagePart = {
        inlineData: {
            mimeType: image.mimeType,
            // Fix: Use renamed utility function for clarity.
            data: dataUrlToBase64(image.url),
        },
    };
    const textPart = { text: prompt };

    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    
    for (const part of result.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
    }
    throw new Error("No image found in edit response");
};

// --- Video Generation ---
// 注意: 動画生成ではDJ社長モードをONにしてもプロンプトは変更しない
// （Veo 3.1のポリシーで実在人物名を含むプロンプトがブロックされるため）
export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', startImage?: Media) => {
    const ai = getAiClient();
    const imagePayload = startImage ? {
        // Fix: Use renamed utility function for clarity.
        imageBytes: dataUrlToBase64(startImage.url),
        mimeType: startImage.mimeType,
    } : undefined;

    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt, // ユーザーのプロンプトをそのまま使用
        image: imagePayload,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });

    return operation;
};

export const pollVideoOperation = async (operation: any) => {
    const ai = getAiClient();
    return await ai.operations.getVideosOperation({ operation: operation });
};
