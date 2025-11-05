
import { GoogleGenAI, GenerateContentResponse, Modality, ContentPart as GeminiContentPart } from '@google/genai';
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
export const generateChatResponse = async (history: GeminiContentPart[], prompt: string) => {
    const ai = getAiClient();
    const chat = ai.chats.create({ model: 'gemini-2.5-flash', history });
    const result = await chat.sendMessage({ message: prompt });
    // Fix: According to the guidelines, the direct result from `sendMessage` should be returned. Accessing `.response` is incorrect.
    return result;
};

export const generateProResponse = async (prompt: string) => {
    const ai = getAiClient();
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
    return result;
};

export const generateSearchGroundedResponse = async (prompt: string) => {
    const ai = getAiClient();
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }]
        }
    });
    return result;
};

// --- Image Generation & Understanding ---
export const generateImage = async (prompt: string, aspectRatio: string) => {
    const ai = getAiClient();
    const result = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio,
        },
    });
    const base64ImageBytes = result.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

export const analyzeImage = async (prompt: string, image: Media) => {
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
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });
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
export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', startImage?: Media) => {
    const ai = getAiClient();
    const imagePayload = startImage ? {
        // Fix: Use renamed utility function for clarity.
        imageBytes: dataUrlToBase64(startImage.url),
        mimeType: startImage.mimeType,
    } : undefined;

    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
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
