/**
 * Media Reference Detection Utility
 *
 * Detects natural language references to images and videos in user prompts,
 * enabling automatic media injection for chat analysis and video generation.
 *
 * Supports Japanese and English patterns.
 */

import type { Media } from '@/types/app';

/**
 * Result of media reference detection
 */
export interface MediaReferenceResult {
    /** Whether the prompt contains a reference to an image */
    hasImageReference: boolean;
    /** Whether the prompt contains a reference to a video */
    hasVideoReference: boolean;
    /** Whether the prompt indicates video generation intent */
    hasVideoIntent: boolean;
    /** Whether the prompt is an analysis/description request */
    isAnalysisRequest: boolean;
}

/**
 * Result of auto-injection decision
 */
export interface AutoInjectResult {
    /** Whether to inject media */
    inject: boolean;
    /** Whether to switch to video mode and use image as startImage */
    forVideo: boolean;
    /** Whether to include media in chat analysis */
    forAnalysis: boolean;
}

// ============================================
// Pattern Definitions
// ============================================

/**
 * Japanese patterns for image references
 */
const IMAGE_REF_PATTERNS_JA: RegExp[] = [
    /この画像/,
    /今の画像/,
    /さっきの画像/,
    /生成した画像/,
    /作った画像/,
    /上の画像/,
    /先ほどの画像/,
    /その画像/,
];

/**
 * English patterns for image references
 * Uses word boundaries (\b) to avoid false positives like "imaging"
 */
const IMAGE_REF_PATTERNS_EN: RegExp[] = [
    /\bthis image\b/i,
    /\bthe image\b/i,
    /\bthat image\b/i,
    /\bgenerated image\b/i,
    /\babove image\b/i,
    /\bprevious image\b/i,
    /\blast image\b/i,
];

/**
 * Japanese patterns for video references
 */
const VIDEO_REF_PATTERNS_JA: RegExp[] = [
    /この動画/,
    /今の動画/,
    /さっきの動画/,
    /生成した動画/,
    /作った動画/,
    /上の動画/,
    /先ほどの動画/,
    /その動画/,
    /このビデオ/,
    /今のビデオ/,
    /さっきのビデオ/,
    /生成したビデオ/,
    /作ったビデオ/,
];

/**
 * English patterns for video references
 * Uses word boundaries (\b) to avoid false positives
 */
const VIDEO_REF_PATTERNS_EN: RegExp[] = [
    /\bthis video\b/i,
    /\bthe video\b/i,
    /\bthat video\b/i,
    /\bgenerated video\b/i,
    /\babove video\b/i,
    /\bprevious video\b/i,
    /\blast video\b/i,
];

/**
 * Japanese patterns indicating video generation intent
 */
const VIDEO_INTENT_PATTERNS_JA: RegExp[] = [
    /動画を?(作|生成|変換)/,
    /ビデオを?(作|生成)/,
    /アニメーション(を|に|化)/,
    /動かして/,
    /動画にして/,
    /ビデオにして/,
];

/**
 * English patterns indicating video generation intent
 */
const VIDEO_INTENT_PATTERNS_EN: RegExp[] = [
    /\b(make|create|generate)\s+(a\s+)?video\b/i,
    /\bconvert\s+(to\s+)?video\b/i,
    /\banimate\b/i,
    /\bturn\s+(this\s+)?into\s+(a\s+)?video\b/i,
    /\bvideo\s+from\b/i,
];

/**
 * Japanese patterns indicating analysis/description request
 */
const ANALYSIS_PATTERNS_JA: RegExp[] = [
    /分析して/,
    /説明して/,
    /何が(写って|見え|描かれ)/,
    /教えて/,
    /見て/,
    /確認して/,
    /どんな/,
    /何(です|だ|の)/,
];

/**
 * English patterns indicating analysis/description request
 */
const ANALYSIS_PATTERNS_EN: RegExp[] = [
    /\banalyze\b/i,
    /\bdescribe\b/i,
    /\bwhat('s| is| does)\b.*\b(in|show|contain)/i,
    /\btell me about\b/i,
    /\bexplain\b/i,
    /\blook at\b/i,
    /\bwhat do you see\b/i,
];

// ============================================
// Detection Functions
// ============================================

/**
 * Detects if a prompt contains references to images/videos and what action is intended
 *
 * @param prompt - The user's input prompt
 * @returns Detection result with flags for media reference, video intent, and analysis request
 *
 * @example
 * ```typescript
 * detectMediaReference('この画像を分析して')
 * // Returns: { hasImageReference: true, hasVideoReference: false, hasVideoIntent: false, isAnalysisRequest: true }
 *
 * detectMediaReference('この動画を分析して')
 * // Returns: { hasImageReference: false, hasVideoReference: true, hasVideoIntent: false, isAnalysisRequest: true }
 *
 * detectMediaReference('この画像で動画を作って')
 * // Returns: { hasImageReference: true, hasVideoReference: false, hasVideoIntent: true, isAnalysisRequest: false }
 * ```
 */
export function detectMediaReference(prompt: string): MediaReferenceResult {
    const allImagePatterns = [...IMAGE_REF_PATTERNS_JA, ...IMAGE_REF_PATTERNS_EN];
    const allVideoRefPatterns = [...VIDEO_REF_PATTERNS_JA, ...VIDEO_REF_PATTERNS_EN];
    const allVideoIntentPatterns = [...VIDEO_INTENT_PATTERNS_JA, ...VIDEO_INTENT_PATTERNS_EN];
    const allAnalysisPatterns = [...ANALYSIS_PATTERNS_JA, ...ANALYSIS_PATTERNS_EN];

    const hasImageReference = allImagePatterns.some(p => p.test(prompt));
    const hasVideoReference = allVideoRefPatterns.some(p => p.test(prompt));
    const hasVideoIntent = allVideoIntentPatterns.some(p => p.test(prompt));
    const isAnalysisRequest = allAnalysisPatterns.some(p => p.test(prompt));

    return {
        hasImageReference,
        hasVideoReference,
        hasVideoIntent,
        isAnalysisRequest,
    };
}

/**
 * Determines whether to auto-inject the last generated image based on prompt analysis
 *
 * @param prompt - The user's input prompt
 * @param lastGeneratedImage - The most recently generated image, or null if none exists
 * @returns Decision result with inject flag and target action (video or analysis)
 *
 * @example
 * ```typescript
 * const mockImage: Media = { type: 'image', url: 'data:image/png;base64,...', mimeType: 'image/png' };
 *
 * shouldAutoInjectImage('この画像を動画にして', mockImage)
 * // Returns: { inject: true, forVideo: true, forAnalysis: false }
 *
 * shouldAutoInjectImage('この画像を分析して', mockImage)
 * // Returns: { inject: true, forVideo: false, forAnalysis: true }
 *
 * shouldAutoInjectImage('この画像を分析して', null)
 * // Returns: { inject: false, forVideo: false, forAnalysis: false }
 * ```
 */
export function shouldAutoInjectImage(
    prompt: string,
    lastGeneratedImage: Media | null
): AutoInjectResult {
    // No image to inject
    if (!lastGeneratedImage) {
        return { inject: false, forVideo: false, forAnalysis: false };
    }

    const { hasImageReference, hasVideoIntent, isAnalysisRequest } = detectMediaReference(prompt);

    // No image reference detected
    if (!hasImageReference) {
        return { inject: false, forVideo: false, forAnalysis: false };
    }

    // Video intent takes priority over analysis
    if (hasVideoIntent) {
        return { inject: true, forVideo: true, forAnalysis: false };
    }

    // Analysis/description request
    if (isAnalysisRequest) {
        return { inject: true, forVideo: false, forAnalysis: true };
    }

    // Image reference without clear action - default to analysis
    return { inject: true, forVideo: false, forAnalysis: true };
}

/**
 * Determines whether to auto-inject the last generated video based on prompt analysis
 *
 * @param prompt - The user's input prompt
 * @param lastGeneratedVideo - The most recently generated video, or null if none exists
 * @returns Decision result with inject flag (forVideo is always false, forAnalysis indicates video analysis)
 *
 * @example
 * ```typescript
 * const mockVideo: Media = { type: 'video', url: 'blob:...', mimeType: 'video/mp4' };
 *
 * shouldAutoInjectVideo('この動画を分析して', mockVideo)
 * // Returns: { inject: true, forVideo: false, forAnalysis: true }
 *
 * shouldAutoInjectVideo('この動画を分析して', null)
 * // Returns: { inject: false, forVideo: false, forAnalysis: false }
 * ```
 */
export function shouldAutoInjectVideo(
    prompt: string,
    lastGeneratedVideo: Media | null
): AutoInjectResult {
    // No video to inject
    if (!lastGeneratedVideo) {
        return { inject: false, forVideo: false, forAnalysis: false };
    }

    const { hasVideoReference, isAnalysisRequest } = detectMediaReference(prompt);

    // No video reference detected
    if (!hasVideoReference) {
        return { inject: false, forVideo: false, forAnalysis: false };
    }

    // Analysis/description request for video
    if (isAnalysisRequest) {
        return { inject: true, forVideo: false, forAnalysis: true };
    }

    // Video reference without clear action - default to analysis
    return { inject: true, forVideo: false, forAnalysis: true };
}
