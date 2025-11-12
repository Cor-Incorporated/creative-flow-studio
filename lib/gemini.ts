// Gemini API Service (Server-side version migrated from alpha/services/geminiService.ts)
import { GoogleGenAI, Modality } from '@google/genai';
import { THINKING_BUDGET, GEMINI_MODELS, ERROR_MESSAGES } from './constants';
import type { Media, AspectRatio } from '../types/app';

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
    const result = await ai.models.generateImages({
        model: GEMINI_MODELS.IMAGEN,
        prompt,
        config: {
            numberOfImages: 1,
            aspectRatio,
        },
    });
    return result;
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
export const generateVideo = async (prompt: string, aspectRatio: AspectRatio = '16:9') => {
    const ai = getAiClient();
    const result = await ai.models.generateVideos({
        model: GEMINI_MODELS.VEO,
        prompt,
        config: {
            aspectRatio,
        },
    });
    return result;
};

// Poll video generation status
export const pollVideoOperation = async (operationName: string) => {
    const ai = getAiClient();
    const result = await ai.operations.get({ name: operationName } as any);
    return result;
};
