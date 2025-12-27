// Gemini API Service (Gemini 3 version)
import { GoogleGenAI, Modality, RawReferenceImage } from '@google/genai';
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

// Get Vertex AI client (for Imagen edit/customization APIs that are Vertex-only)
const getVertexAiClient = () => {
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    if (!project || !location) {
        throw new Error(
            'Vertex AI configuration missing. Set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.'
        );
    }
    return new GoogleGenAI({
        vertexai: true,
        project,
        location,
    });
};

// Convert data URL to base64
export const dataUrlToBase64 = (dataUrl: string): string => {
    const base64Index = dataUrl.indexOf('base64,');
    if (base64Index === -1) {
        return dataUrl;
    }
    return dataUrl.substring(base64Index + 7);
};

const containsReferenceToken = (text: string): boolean => /\[\d+\]/.test(text);

const withReferenceHint = (prompt: string, referenceCount: number, hasOriginal: boolean): string => {
    // If user already references images like [1], do not mutate prompt semantics.
    if (containsReferenceToken(prompt)) return prompt;

    const ids = Array.from({ length: referenceCount }, (_, i) => i + 1);
    const refs = ids.map((id) => `[${id}]`).join(', ');
    const originalNote = hasOriginal
        ? '※ [1] は編集元（ベース）画像として扱います。'
        : '※ 参照画像はキャラクター/スタイル/構図の一貫性のガイドとして扱います。';

    return `${prompt}\n\n参照画像: ${refs}\n${originalNote}`;
};

const toRawReferenceImages = (images: Media[], startId = 1): RawReferenceImage[] => {
    return images.map((img, idx) => {
        const ref = new RawReferenceImage();
        ref.referenceId = startId + idx;
        ref.referenceImage = {
            imageBytes: dataUrlToBase64(img.url),
            mimeType: img.mimeType,
        } as any;
        ref.referenceType = 'RAW';
        return ref;
    });
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

// --- Multiple Images Analysis ---
/**
 * Analyze multiple images together in a single request
 * @param prompt - Text prompt for analysis
 * @param images - Array of images with url (data URL) and mimeType
 * @param systemInstruction - Optional system instruction
 */
export const analyzeMultipleImages = async (
    prompt: string,
    images: Array<{ url: string; mimeType: string }>,
    systemInstruction?: string
) => {
    const ai = getAiClient();

    // Build parts array: text prompt first, then all images
    const parts: any[] = [{ text: prompt }];

    for (const image of images) {
        const base64Data = dataUrlToBase64(image.url);
        parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: base64Data,
            },
        });
    }

    const requestConfig: any = {
        model: GEMINI_MODELS.FLASH,
        contents: {
            parts,
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

// --- Image Generation/Editing with Reference Images (Vertex AI only) ---
/**
 * Generate/edit an image using reference images (subject/style customization).
 * NOTE: This requires Vertex AI backend (not Gemini Developer API).
 */
export const generateOrEditImageWithReferences = async (input: {
    prompt: string;
    referenceImages: Media[];
    originalImage?: Media;
    outputMimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}) => {
    const ai = getVertexAiClient();
    const outputMimeType = input.outputMimeType || 'image/png';

    // Build reference images:
    // - If originalImage exists, use it as [1]
    // - referenceImages start at [2]
    const refs: RawReferenceImage[] = [];
    if (input.originalImage) {
        refs.push(...toRawReferenceImages([input.originalImage], 1));
        refs.push(...toRawReferenceImages(input.referenceImages, 2));
    } else {
        refs.push(...toRawReferenceImages(input.referenceImages, 1));
    }

    const prompt = withReferenceHint(input.prompt, refs.length, !!input.originalImage);

    const response = await ai.models.editImage({
        model: 'imagen-3.0-capability-001',
        prompt,
        referenceImages: refs as any,
        config: {
            numberOfImages: 1,
            outputMimeType,
        },
    } as any);

    const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
        throw new Error(ERROR_MESSAGES.IMAGE_NO_IMAGES);
    }
    return `data:${outputMimeType};base64,${imageBytes}`;
};

// --- Video Generation ---
/**
 * Generate video using Veo API
 * @param prompt - Text prompt for video generation
 * @param aspectRatio - Aspect ratio (16:9 or 9:16)
 * @param referenceImages - Optional array of reference images (max 3)
 *                          Can also accept a single Media for backward compatibility
 */
export const generateVideo = async (
    prompt: string,
    aspectRatio: AspectRatio = '16:9',
    referenceImages?: Media | Media[]
) => {
    const ai = getAiClient();

    // Normalize referenceImages to array (backward compatible with single image)
    const images = referenceImages
        ? Array.isArray(referenceImages)
            ? referenceImages
            : [referenceImages]
        : [];

    // Build config
    const config: any = {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio as '16:9' | '9:16',
    };

    // Add reference images when provided (max 3)
    if (images.length > 0) {
        config.referenceImages = images.slice(0, 3).map((img) => ({
            image: {
                imageBytes: dataUrlToBase64(img.url),
                mimeType: img.mimeType,
            },
            referenceType: 'ASSET',
        }));
    }

    const request: any = {
        model: GEMINI_MODELS.VEO,
        prompt,
        config,
    };

    const result = await ai.models.generateVideos(request);

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
