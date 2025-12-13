/**
 * Gemini API Safety Detection Utility
 *
 * Checks Gemini API responses for safety/content policy blocks and provides
 * structured information for user-facing error messages.
 */

/**
 * Possible reasons for content being blocked
 */
export type BlockReason = 'SAFETY' | 'RECITATION' | 'POLICY' | 'OTHER';

/**
 * Result of checking response safety
 */
export interface SafetyCheckResult {
    isBlocked: boolean;
    reason?: BlockReason;
    message?: string;
    finishReason?: string;
}

/**
 * Gemini API finish reasons that indicate content was blocked
 * @see https://ai.google.dev/gemini-api/docs/safety-settings
 */
const BLOCKED_FINISH_REASONS = ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'];

/**
 * Check if a Gemini chat/text response was blocked for safety/policy reasons
 *
 * @param response - The raw response from Gemini API
 * @returns SafetyCheckResult with block status and reason
 */
export function checkResponseSafety(response: any): SafetyCheckResult {
    // No response at all
    if (!response) {
        return { isBlocked: true, reason: 'OTHER', message: 'No response received' };
    }

    // Check for candidates
    const candidate = response?.candidates?.[0];
    if (!candidate) {
        // Check for prompt feedback (blocked before generation)
        const blockReason = response?.promptFeedback?.blockReason;
        if (blockReason) {
            return {
                isBlocked: true,
                reason: mapBlockReason(blockReason),
                message: `Prompt blocked: ${blockReason}`,
                finishReason: blockReason,
            };
        }
        return { isBlocked: true, reason: 'OTHER', message: 'No candidate in response' };
    }

    // Check finish reason
    const finishReason = candidate.finishReason;
    if (finishReason && BLOCKED_FINISH_REASONS.includes(finishReason)) {
        return {
            isBlocked: true,
            reason: mapBlockReason(finishReason),
            message: getBlockMessage(finishReason),
            finishReason,
        };
    }

    // Check safety ratings for HIGH probability blocks
    const safetyRatings = candidate.safetyRatings || [];
    for (const rating of safetyRatings) {
        if (rating.blocked === true || rating.probability === 'HIGH') {
            return {
                isBlocked: true,
                reason: 'SAFETY',
                message: `Content blocked due to ${rating.category || 'safety'} concerns`,
                finishReason: `SAFETY_${rating.category}`,
            };
        }
    }

    return { isBlocked: false };
}

/**
 * Check if an Imagen (image generation) response was blocked
 *
 * @param result - The raw result from Imagen API
 * @returns SafetyCheckResult with block status and reason
 */
export function checkImageSafety(result: any): SafetyCheckResult {
    // Check if we have generated images
    if (!result?.generatedImages?.length && !result?.images?.length) {
        // Check for explicit error messages
        const errorMessage = result?.error?.message || result?.sdkHttpResponse?.body?.error?.message;
        if (errorMessage) {
            const lowerMessage = errorMessage.toLowerCase();
            if (lowerMessage.includes('safety') || lowerMessage.includes('policy')) {
                return {
                    isBlocked: true,
                    reason: 'SAFETY',
                    message: errorMessage,
                };
            }
            if (lowerMessage.includes('copyright') || lowerMessage.includes('recitation')) {
                return {
                    isBlocked: true,
                    reason: 'RECITATION',
                    message: errorMessage,
                };
            }
            return {
                isBlocked: true,
                reason: 'POLICY',
                message: errorMessage,
            };
        }

        // No images and no error - might be blocked
        return {
            isBlocked: true,
            reason: 'OTHER',
            message: 'No images generated',
        };
    }

    return { isBlocked: false };
}

/**
 * Check if a Veo (video generation) response was blocked
 *
 * @param result - The raw result from Veo API
 * @returns SafetyCheckResult with block status and reason
 */
export function checkVideoSafety(result: any): SafetyCheckResult {
    // Check for error in operation result
    const error = result?.error;
    if (error) {
        const errorMessage = error.message || error.details?.[0]?.message || 'Video generation failed';
        const lowerMessage = errorMessage.toLowerCase();

        if (lowerMessage.includes('safety') || lowerMessage.includes('policy')) {
            return {
                isBlocked: true,
                reason: 'SAFETY',
                message: errorMessage,
            };
        }
        if (lowerMessage.includes('copyright') || lowerMessage.includes('recitation')) {
            return {
                isBlocked: true,
                reason: 'RECITATION',
                message: errorMessage,
            };
        }

        return {
            isBlocked: true,
            reason: 'POLICY',
            message: errorMessage,
        };
    }

    return { isBlocked: false };
}

/**
 * Map Gemini API finish/block reasons to our BlockReason type
 */
function mapBlockReason(reason: string): BlockReason {
    switch (reason) {
        case 'SAFETY':
        case 'BLOCKLIST':
        case 'SPII':
            return 'SAFETY';
        case 'RECITATION':
            return 'RECITATION';
        case 'PROHIBITED_CONTENT':
            return 'POLICY';
        default:
            return 'OTHER';
    }
}

/**
 * Get a user-friendly message for a block reason
 */
function getBlockMessage(finishReason: string): string {
    switch (finishReason) {
        case 'SAFETY':
            return 'Content was blocked due to safety concerns';
        case 'RECITATION':
            return 'Content was blocked due to potential copyright concerns';
        case 'PROHIBITED_CONTENT':
            return 'Content was blocked due to policy violation';
        case 'BLOCKLIST':
            return 'Content was blocked due to prohibited terms';
        case 'SPII':
            return 'Content was blocked due to sensitive personal information';
        default:
            return `Content was blocked: ${finishReason}`;
    }
}

/**
 * Map BlockReason to API error code
 */
export function blockReasonToErrorCode(reason: BlockReason): string {
    switch (reason) {
        case 'SAFETY':
            return 'SAFETY_BLOCKED';
        case 'RECITATION':
            return 'RECITATION_BLOCKED';
        case 'POLICY':
        default:
            return 'CONTENT_POLICY_VIOLATION';
    }
}
