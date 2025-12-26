// Application types for BlunaAI (migrated from alpha/types.ts)

export type Role = 'user' | 'model';
export type GenerationMode = 'chat' | 'search' | 'image' | 'video';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2' | '4:5' | '5:4' | '21:9';

// Re-export InfluencerId from constants for convenience
export type { InfluencerId } from '@/lib/constants';

export interface Media {
    type: 'image' | 'video';
    url: string;
    mimeType: string;
    /** Indicates legacy Blob URLs that are no longer valid after page reload */
    unavailable?: boolean;
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface ContentPart {
    text?: string;
    media?: Media;
    sources?: GroundingSource[];
    isLoading?: boolean;
    status?: string;
    isError?: boolean;
    isEditing?: boolean;
    originalMedia?: Media; // For image editing context
}

export interface Message {
    id: string;
    role: Role;
    parts: ContentPart[];
}

// API Request/Response types
export interface ChatRequest {
    prompt: string;
    history?: Message[];
    mode: GenerationMode;
    systemInstruction?: string;
    temperature?: number;
    aspectRatio?: AspectRatio;
    media?: Media;
}

export interface ChatResponse {
    message: Message;
    error?: string;
}

export interface ImageGenerationRequest {
    prompt: string;
    aspectRatio?: AspectRatio;
}

export interface ImageEditRequest {
    prompt: string;
    originalImage: Media;
}

export interface VideoGenerationRequest {
    prompt: string;
    aspectRatio?: AspectRatio;
    /** Reference images for video generation (max 8 images) */
    referenceImages?: Media[];
}

export interface VideoStatusRequest {
    operationName: string;
}
