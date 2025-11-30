// Gemini API Service (Server-side version migrated from alpha/services/geminiService.ts)
import { GoogleGenAI, Modality } from '@google/genai';
import type { AspectRatio, Media } from '../types/app';
import { ERROR_MESSAGES, GEMINI_MODELS, THINKING_BUDGET } from './constants';

// Get AI client with API key from environment
const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(ERROR_MESSAGES.API_KEY_NOT_FOUND);
    }
    return new GoogleGenAI({ apiKey });
};

// Convert data URL to base64
export const dataUrlToBase64 = (dataUrl: string): string => {
    const base64Index = dataUrl.indexOf('base64,');
    if (base64Index === -1) {
        return dataUrl;
    }
    return dataUrl.substring(base64Index + 7);
};

// --- Text Generation ---
export const generateChatResponse = async (
    history: any[],
    prompt: string,
    systemInstruction?: string,
    temperature?: number
) => {
    const ai = getAiClient();
    const chatConfig: any = {
        model: GEMINI_MODELS.FLASH,
        history,
        config: {},
    };

    if (systemInstruction) {
        chatConfig.config.systemInstruction = [systemInstruction];
    }
    if (temperature !== undefined) {
        chatConfig.config.temperature = temperature;
    }

    const chat = ai.chats.create(chatConfig);
    const result = await chat.sendMessage({ message: prompt });
    return result;
};

// Pro mode: Uses gemini-2.5-pro with thinking process
export const generateProResponse = async (
    prompt: string,
    systemInstruction?: string,
    temperature?: number
) => {
    const ai = getAiClient();
    const requestConfig: any = {
        model: GEMINI_MODELS.PRO,
        contents: {
            parts: [{ text: prompt }],
        },
        config: {
            thinkingConfig: { thinkingBudget: THINKING_BUDGET },
        },
    };

    if (systemInstruction) {
        requestConfig.config.systemInstruction = [systemInstruction];
    }
    if (temperature !== undefined) {
        requestConfig.config = { ...requestConfig.config, temperature };
    }

    const result = await ai.models.generateContent(requestConfig);
    return result;
};

// Search mode: Uses Google Search for grounded responses
export const generateSearchGroundedResponse = async (
    prompt: string,
    systemInstruction?: string,
    temperature?: number
) => {
    const ai = getAiClient();
    const requestConfig: any = {
        model: GEMINI_MODELS.FLASH,
        contents: {
            parts: [{ text: prompt }],
        },
        config: {
            tools: [{ googleSearch: {} }],
        },
    };

    if (systemInstruction) {
        requestConfig.config.systemInstruction = [systemInstruction];
    }
    if (temperature !== undefined) {
        requestConfig.config = { ...requestConfig.config, temperature };
    }

    const result = await ai.models.generateContent(requestConfig);
    return result;
};

// --- Image Generation ---
export const generateImage = async (prompt: string, aspectRatio: AspectRatio = '1:1') => {
    const ai = getAiClient();
    
    // Validate aspect ratio (same as alpha implementation)
    const VALID_IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;
    const normalizedAspectRatio = VALID_IMAGE_ASPECT_RATIOS.includes(aspectRatio as any)
        ? aspectRatio
        : '1:1';

    const result = await ai.models.generateImages({
        model: GEMINI_MODELS.IMAGEN,
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png', // Fixed: Add outputMimeType from alpha
            aspectRatio: normalizedAspectRatio,
        },
    });

    // Error handling: Check if generatedImages exists and has elements (same as alpha)
    if (!result || !result.generatedImages || result.generatedImages.length === 0) {
        const httpResponse = result?.sdkHttpResponse as any;
        const errorMessage = httpResponse?.body
            ? `${ERROR_MESSAGES.IMAGE_GENERATION_FAILED}: ${JSON.stringify(httpResponse.body)}`
            : ERROR_MESSAGES.IMAGE_NO_IMAGES;
        throw new Error(errorMessage);
    }

    const firstImage = result.generatedImages[0];
    if (!firstImage) {
        throw new Error(ERROR_MESSAGES.IMAGE_NO_DATA);
    }

    // Extract image data (same logic as alpha)
    let base64ImageBytes: string;
    const imageData = firstImage as any;

    if (imageData.image && imageData.image.imageBytes) {
        base64ImageBytes = imageData.image.imageBytes;
    } else if (imageData.imageBytes) {
        base64ImageBytes = imageData.imageBytes;
    } else if (imageData.data) {
        base64ImageBytes = imageData.data;
    } else {
        throw new Error(ERROR_MESSAGES.IMAGE_UNEXPECTED_FORMAT);
    }

    // Return data URL format (same as alpha)
    return `data:image/png;base64,${base64ImageBytes}`;
};

// --- Image Analysis ---
export const analyzeImage = async (
    prompt: string,
    imageData: string,
    mimeType: string,
    systemInstruction?: string
) => {
    const ai = getAiClient();
    const base64Data = dataUrlToBase64(imageData);

    const requestConfig: any = {
        model: GEMINI_MODELS.FLASH,
        contents: {
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType,
                        data: base64Data,
                    },
                },
            ],
        },
        config: {},
    };

    if (systemInstruction) {
        requestConfig.config.systemInstruction = [systemInstruction];
    }

    const result = await ai.models.generateContent(requestConfig);
    return result;
};

// --- Image Editing ---
export const editImage = async (prompt: string, originalImage: Media) => {
    const ai = getAiClient();
    const base64Data = dataUrlToBase64(originalImage.url);

    const result = await ai.models.generateContent({
        model: GEMINI_MODELS.FLASH_IMAGE,
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: originalImage.mimeType,
                        data: base64Data,
                    },
                },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    return result;
};

// --- Video Generation ---
export const generateVideo = async (
    prompt: string,
    aspectRatio: AspectRatio = '16:9',
    startImage?: Media
) => {
    const ai = getAiClient();
    
    // Prepare image payload if startImage is provided (same as alpha)
    const imagePayload = startImage
        ? {
              imageBytes: dataUrlToBase64(startImage.url),
              mimeType: startImage.mimeType,
          }
        : undefined;

    const result = await ai.models.generateVideos({
        model: GEMINI_MODELS.VEO,
        prompt,
        image: imagePayload, // Fixed: Add image support from alpha
        config: {
            numberOfVideos: 1, // Fixed: Add from alpha
            resolution: '720p', // Fixed: Add from alpha
            aspectRatio: aspectRatio as '16:9' | '9:16', // Fixed: Type assertion from alpha
        },
    });

    const operationName =
        typeof result === 'string'
            ? result
            : result?.name || (result as any)?.operation?.name;

    if (!operationName) {
        throw new Error('Video generation operation name missing');
    }

    return { name: operationName };
};

// Poll video generation status
export const pollVideoOperation = async (operation: any) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(ERROR_MESSAGES.API_KEY_NOT_FOUND);
    }

    const operationName =
        typeof operation === 'string'
            ? operation
            : operation?.name || operation?.operation?.name;

    if (!operationName) {
        throw new Error('Operation name not found for polling');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
        throw new Error(`Failed to poll video operation: ${response.statusText}`);
    }

    return await response.json();
};
