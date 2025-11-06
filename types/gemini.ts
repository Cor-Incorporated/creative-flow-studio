// Type definitions for Gemini API responses
// These types extend @google/genai's types to include undocumented shortcuts

export interface GeminiTextPart {
    text: string;
}

export interface GeminiInlineDataPart {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

export interface GeminiContent {
    role?: string;
    parts: GeminiPart[];
}

export interface GeminiCandidate {
    content: GeminiContent;
    groundingMetadata?: {
        groundingChunks?: Array<{
            web?: {
                uri: string;
                title?: string;
            };
        }>;
    };
}

export interface GeminiResponse {
    // Shorthand property (undocumented but exists in practice)
    text?: string;
    // Standard structure
    candidates?: GeminiCandidate[];
}

export interface GeminiChatConfig {
    model: string;
    history: Array<{
        role: string;
        parts: GeminiPart[];
    }>;
    config: {
        systemInstruction?: string[];
        temperature?: number;
        thinkingConfig?: {
            thinkingBudget: number;
        };
        tools?: Array<{
            googleSearch?: Record<string, never>;
        }>;
    };
}

export interface GeminiGenerateContentConfig {
    model: string;
    contents: {
        parts: GeminiPart[];
    };
    config: {
        systemInstruction?: string[];
        temperature?: number;
        thinkingConfig?: {
            thinkingBudget: number;
        };
        tools?: Array<{
            googleSearch?: Record<string, never>;
        }>;
        responseModalities?: string[];
    };
}

/**
 * Helper function to safely extract text from Gemini response
 * Handles both the shorthand `.text` property and full candidate structure
 */
export function extractTextFromResponse(result: GeminiResponse): string {
    return result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Type guard to check if a part is a text part
 */
export function isTextPart(part: GeminiPart): part is GeminiTextPart {
    return 'text' in part;
}

/**
 * Type guard to check if a part is an inline data part
 */
export function isInlineDataPart(part: GeminiPart): part is GeminiInlineDataPart {
    return 'inlineData' in part;
}
