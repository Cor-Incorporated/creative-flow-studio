// Gemini API Service (Gemini 3 version)
import { GoogleGenAI, Modality } from '@google/genai';
import type { AspectRatio, Media } from '../types/app';
import { ERROR_MESSAGES, GEMINI_MODELS, VALID_IMAGE_ASPECT_RATIOS } from './constants';

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

// Search mode: Uses Google Search for grounded responses
export const generateSearchGroundedResponse = async (
    history: any[],
    prompt: string,
    systemInstruction?: string,
    temperature?: number
) => {
    const ai = getAiClient();

    // Build contents with history for multi-turn context
    const contents =
        history.length > 0
            ? [...history, { role: 'user', parts: [{ text: prompt }] }]
            : [{ role: 'user', parts: [{ text: prompt }] }];

    const requestConfig: any = {
        model: GEMINI_MODELS.FLASH,
        contents,
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

// --- Image Generation (Gemini 3 Pro Image) ---
export const generateImage = async (
    prompt: string,
    aspectRatio: AspectRatio = '1:1',
    imageSize: '1K' | '2K' | '4K' = '2K'
) => {
    const ai = getAiClient();

    // Validate aspect ratio (Gemini 3 Pro Image supports extended ratios)
    const normalizedAspectRatio = VALID_IMAGE_ASPECT_RATIOS.includes(aspectRatio as any)
        ? aspectRatio
        : '1:1';

    // Gemini 3 Pro Image uses generateContent with responseModalities
    const result = await ai.models.generateContent({
        model: GEMINI_MODELS.PRO_IMAGE,
        contents: prompt,
        config: {
            responseModalities: [Modality.IMAGE],
            imageConfig: {
                aspectRatio: normalizedAspectRatio,
                imageSize, // "1K", "2K", or "4K"
            },
        },
    });

    // Extract image from response candidates
    const candidate = result?.candidates?.[0];
    if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
        throw new Error(ERROR_MESSAGES.IMAGE_NO_IMAGES);
    }

    // Find the image part in response
    const imagePart = candidate.content.parts.find((part: any) => part.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error(ERROR_MESSAGES.IMAGE_NO_DATA);
    }

    const { data, mimeType: responseMimeType } = imagePart.inlineData;
    if (!data) {
        throw new Error(ERROR_MESSAGES.IMAGE_UNEXPECTED_FORMAT);
    }

    // Return data URL format
    const mime = responseMimeType || 'image/png';
    return `data:${mime};base64,${data}`;
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

// --- Video Analysis ---
export const analyzeVideo = async (
    prompt: string,
    videoData: string,
    mimeType: string,
    systemInstruction?: string
) => {
    const ai = getAiClient();
    const base64Data = dataUrlToBase64(videoData);

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

// --- Image Editing (Gemini 3 Pro Image) ---
export const editImage = async (prompt: string, originalImage: Media) => {
    const ai = getAiClient();
    const base64Data = dataUrlToBase64(originalImage.url);

    // Gemini 3 Pro Image unified model for both generation and editing
    const result = await ai.models.generateContent({
        model: GEMINI_MODELS.PRO_IMAGE,
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
            responseModalities: [Modality.TEXT, Modality.IMAGE],
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
