import { describe, it, expect } from 'vitest';
import {
    checkResponseSafety,
    checkImageSafety,
    checkVideoSafety,
    blockReasonToErrorCode,
    SafetyCheckResult,
    BlockReason,
} from '@/lib/gemini-safety';

describe('Gemini Safety Utilities', () => {
    describe('checkResponseSafety', () => {
        describe('null/undefined/empty responses', () => {
            it('should return blocked for null response', () => {
                const result = checkResponseSafety(null);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('OTHER');
                expect(result.message).toBe('No response received');
            });

            it('should return blocked for undefined response', () => {
                const result = checkResponseSafety(undefined);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('OTHER');
                expect(result.message).toBe('No response received');
            });

            it('should return blocked for empty object response', () => {
                const result = checkResponseSafety({});

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('OTHER');
                expect(result.message).toBe('No candidate in response');
            });

            it('should return blocked for response with empty candidates array', () => {
                const result = checkResponseSafety({ candidates: [] });

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('OTHER');
                expect(result.message).toBe('No candidate in response');
            });
        });

        describe('promptFeedback blockReason detection', () => {
            it('should detect SAFETY block reason from promptFeedback', () => {
                const response = {
                    promptFeedback: {
                        blockReason: 'SAFETY',
                    },
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Prompt blocked: SAFETY');
                expect(result.finishReason).toBe('SAFETY');
            });

            it('should detect BLOCKLIST block reason from promptFeedback', () => {
                const response = {
                    promptFeedback: {
                        blockReason: 'BLOCKLIST',
                    },
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Prompt blocked: BLOCKLIST');
            });

            it('should detect PROHIBITED_CONTENT block reason from promptFeedback', () => {
                const response = {
                    promptFeedback: {
                        blockReason: 'PROHIBITED_CONTENT',
                    },
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('POLICY');
                expect(result.message).toBe('Prompt blocked: PROHIBITED_CONTENT');
            });
        });

        describe('finishReason detection', () => {
            it('should detect SAFETY finishReason as blocked', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'SAFETY',
                            content: { parts: [] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Content was blocked due to safety concerns');
                expect(result.finishReason).toBe('SAFETY');
            });

            it('should detect RECITATION finishReason as blocked', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'RECITATION',
                            content: { parts: [] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('RECITATION');
                expect(result.message).toBe('Content was blocked due to potential copyright concerns');
                expect(result.finishReason).toBe('RECITATION');
            });

            it('should detect PROHIBITED_CONTENT finishReason as blocked', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'PROHIBITED_CONTENT',
                            content: { parts: [] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('POLICY');
                expect(result.message).toBe('Content was blocked due to policy violation');
                expect(result.finishReason).toBe('PROHIBITED_CONTENT');
            });

            it('should detect BLOCKLIST finishReason as blocked', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'BLOCKLIST',
                            content: { parts: [] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Content was blocked due to prohibited terms');
                expect(result.finishReason).toBe('BLOCKLIST');
            });

            it('should detect SPII finishReason as blocked', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'SPII',
                            content: { parts: [] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Content was blocked due to sensitive personal information');
                expect(result.finishReason).toBe('SPII');
            });

            it('should NOT block STOP finishReason', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'Hello!' }] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
                expect(result.reason).toBeUndefined();
                expect(result.message).toBeUndefined();
            });

            it('should NOT block MAX_TOKENS finishReason', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'MAX_TOKENS',
                            content: { parts: [{ text: 'Long response...' }] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });

            it('should handle unknown finishReason with default message', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'UNKNOWN_REASON',
                            content: { parts: [] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                // Unknown reasons are not in BLOCKED_FINISH_REASONS, so not blocked
                expect(result.isBlocked).toBe(false);
            });
        });

        describe('safetyRatings detection', () => {
            it('should detect blocked=true in safetyRatings', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_HARASSMENT',
                                    probability: 'MEDIUM',
                                    blocked: true,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Content blocked due to HARM_CATEGORY_HARASSMENT concerns');
                expect(result.finishReason).toBe('SAFETY_HARM_CATEGORY_HARASSMENT');
            });

            it('should detect HIGH probability in safetyRatings', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                                    probability: 'HIGH',
                                    blocked: false,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Content blocked due to HARM_CATEGORY_SEXUALLY_EXPLICIT concerns');
            });

            it('should NOT block for LOW probability ratings', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_HARASSMENT',
                                    probability: 'LOW',
                                    blocked: false,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });

            it('should NOT block for MEDIUM probability ratings', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                                    probability: 'MEDIUM',
                                    blocked: false,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });

            it('should NOT block for NEGLIGIBLE probability ratings', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_HATE_SPEECH',
                                    probability: 'NEGLIGIBLE',
                                    blocked: false,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });

            it('should handle safetyRating without category', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    probability: 'HIGH',
                                    blocked: true,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.reason).toBe('SAFETY');
                expect(result.message).toBe('Content blocked due to safety concerns');
            });

            it('should check multiple safetyRatings and block if any is HIGH', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_HARASSMENT',
                                    probability: 'LOW',
                                    blocked: false,
                                },
                                {
                                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                                    probability: 'HIGH',
                                    blocked: false,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(true);
                expect(result.message).toBe('Content blocked due to HARM_CATEGORY_DANGEROUS_CONTENT concerns');
            });

            it('should handle empty safetyRatings array', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                            safetyRatings: [],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });

            it('should handle missing safetyRatings', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: { parts: [{ text: 'test' }] },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });
        });

        describe('successful responses', () => {
            it('should return isBlocked=false for successful response', () => {
                const response = {
                    candidates: [
                        {
                            finishReason: 'STOP',
                            content: {
                                parts: [{ text: 'Hello! How can I help you today?' }],
                            },
                            safetyRatings: [
                                {
                                    category: 'HARM_CATEGORY_HARASSMENT',
                                    probability: 'NEGLIGIBLE',
                                    blocked: false,
                                },
                                {
                                    category: 'HARM_CATEGORY_HATE_SPEECH',
                                    probability: 'NEGLIGIBLE',
                                    blocked: false,
                                },
                            ],
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
                expect(result.reason).toBeUndefined();
                expect(result.message).toBeUndefined();
                expect(result.finishReason).toBeUndefined();
            });

            it('should return isBlocked=false for response with no finishReason', () => {
                const response = {
                    candidates: [
                        {
                            content: {
                                parts: [{ text: 'Hello!' }],
                            },
                        },
                    ],
                };

                const result = checkResponseSafety(response);

                expect(result.isBlocked).toBe(false);
            });
        });
    });

    describe('checkImageSafety', () => {
        describe('successful responses', () => {
            it('should return isBlocked=false when generatedImages exists', () => {
                const result = {
                    generatedImages: [
                        {
                            image: { imageBytes: 'base64data' },
                        },
                    ],
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(false);
            });

            it('should return isBlocked=false when images array exists', () => {
                const result = {
                    images: [{ data: 'base64data' }],
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(false);
            });
        });

        describe('blocked responses with error messages', () => {
            it('should detect safety keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Image was blocked due to safety concerns',
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
                expect(safetyResult.message).toBe('Image was blocked due to safety concerns');
            });

            it('should detect policy keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Request violates content policy',
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
                expect(safetyResult.message).toBe('Request violates content policy');
            });

            it('should detect copyright keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Potential copyright infringement detected',
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('RECITATION');
                expect(safetyResult.message).toBe('Potential copyright infringement detected');
            });

            it('should detect recitation keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Content flagged for recitation concerns',
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('RECITATION');
                expect(safetyResult.message).toBe('Content flagged for recitation concerns');
            });

            it('should detect error in sdkHttpResponse body', () => {
                const result = {
                    sdkHttpResponse: {
                        body: {
                            error: {
                                message: 'Image generation blocked by safety filter',
                            },
                        },
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
                expect(safetyResult.message).toBe('Image generation blocked by safety filter');
            });

            it('should return POLICY reason for unknown error messages', () => {
                const result = {
                    error: {
                        message: 'Unknown error occurred during generation',
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('POLICY');
                expect(safetyResult.message).toBe('Unknown error occurred during generation');
            });

            it('should be case-insensitive for keyword detection', () => {
                const result = {
                    error: {
                        message: 'SAFETY filter triggered for this request',
                    },
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
            });
        });

        describe('empty/null responses', () => {
            it('should return blocked with OTHER reason for null result', () => {
                const safetyResult = checkImageSafety(null);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('OTHER');
                expect(safetyResult.message).toBe('No images generated');
            });

            it('should return blocked for empty object', () => {
                const safetyResult = checkImageSafety({});

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('OTHER');
                expect(safetyResult.message).toBe('No images generated');
            });

            it('should return blocked for empty generatedImages array', () => {
                const result = {
                    generatedImages: [],
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('OTHER');
                expect(safetyResult.message).toBe('No images generated');
            });

            it('should return blocked for empty images array', () => {
                const result = {
                    images: [],
                };

                const safetyResult = checkImageSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('OTHER');
                expect(safetyResult.message).toBe('No images generated');
            });

            it('should return blocked for undefined result', () => {
                const safetyResult = checkImageSafety(undefined);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('OTHER');
                expect(safetyResult.message).toBe('No images generated');
            });
        });
    });

    describe('checkVideoSafety', () => {
        describe('successful responses', () => {
            it('should return isBlocked=false when no error present', () => {
                const result = {
                    video: {
                        uri: 'gs://bucket/video.mp4',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(false);
            });

            it('should return isBlocked=false for empty object', () => {
                const safetyResult = checkVideoSafety({});

                expect(safetyResult.isBlocked).toBe(false);
            });

            it('should return isBlocked=false for null result', () => {
                const safetyResult = checkVideoSafety(null);

                expect(safetyResult.isBlocked).toBe(false);
            });

            it('should return isBlocked=false for undefined result', () => {
                const safetyResult = checkVideoSafety(undefined);

                expect(safetyResult.isBlocked).toBe(false);
            });
        });

        describe('blocked responses with error messages', () => {
            it('should detect safety keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Video generation blocked due to safety concerns',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
                expect(safetyResult.message).toBe('Video generation blocked due to safety concerns');
            });

            it('should detect policy keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Content violates usage policy',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
                expect(safetyResult.message).toBe('Content violates usage policy');
            });

            it('should detect copyright keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Potential copyright violation',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('RECITATION');
                expect(safetyResult.message).toBe('Potential copyright violation');
            });

            it('should detect recitation keyword in error message', () => {
                const result = {
                    error: {
                        message: 'Content flagged for recitation',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('RECITATION');
                expect(safetyResult.message).toBe('Content flagged for recitation');
            });

            it('should return POLICY reason for unknown error messages', () => {
                const result = {
                    error: {
                        message: 'Video generation failed due to internal error',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('POLICY');
                expect(safetyResult.message).toBe('Video generation failed due to internal error');
            });

            it('should use error message from details if main message is missing', () => {
                const result = {
                    error: {
                        details: [
                            {
                                message: 'Video blocked for safety reasons',
                            },
                        ],
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
                expect(safetyResult.message).toBe('Video blocked for safety reasons');
            });

            it('should use default message when error has no message', () => {
                const result = {
                    error: {},
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('POLICY');
                expect(safetyResult.message).toBe('Video generation failed');
            });

            it('should be case-insensitive for keyword detection', () => {
                const result = {
                    error: {
                        message: 'POLICY violation detected in video content',
                    },
                };

                const safetyResult = checkVideoSafety(result);

                expect(safetyResult.isBlocked).toBe(true);
                expect(safetyResult.reason).toBe('SAFETY');
            });
        });
    });

    describe('blockReasonToErrorCode', () => {
        it('should map SAFETY to SAFETY_BLOCKED', () => {
            const result = blockReasonToErrorCode('SAFETY');
            expect(result).toBe('SAFETY_BLOCKED');
        });

        it('should map RECITATION to RECITATION_BLOCKED', () => {
            const result = blockReasonToErrorCode('RECITATION');
            expect(result).toBe('RECITATION_BLOCKED');
        });

        it('should map POLICY to CONTENT_POLICY_VIOLATION', () => {
            const result = blockReasonToErrorCode('POLICY');
            expect(result).toBe('CONTENT_POLICY_VIOLATION');
        });

        it('should map OTHER to CONTENT_POLICY_VIOLATION (default)', () => {
            const result = blockReasonToErrorCode('OTHER');
            expect(result).toBe('CONTENT_POLICY_VIOLATION');
        });

        it('should handle all BlockReason types', () => {
            const reasons: BlockReason[] = ['SAFETY', 'RECITATION', 'POLICY', 'OTHER'];
            const expectedCodes = [
                'SAFETY_BLOCKED',
                'RECITATION_BLOCKED',
                'CONTENT_POLICY_VIOLATION',
                'CONTENT_POLICY_VIOLATION',
            ];

            reasons.forEach((reason, index) => {
                expect(blockReasonToErrorCode(reason)).toBe(expectedCodes[index]);
            });
        });
    });

    describe('SafetyCheckResult type validation', () => {
        it('should have correct shape for blocked result', () => {
            const result: SafetyCheckResult = {
                isBlocked: true,
                reason: 'SAFETY',
                message: 'Content blocked',
                finishReason: 'SAFETY',
            };

            expect(result.isBlocked).toBe(true);
            expect(result.reason).toBe('SAFETY');
            expect(result.message).toBe('Content blocked');
            expect(result.finishReason).toBe('SAFETY');
        });

        it('should have correct shape for non-blocked result', () => {
            const result: SafetyCheckResult = {
                isBlocked: false,
            };

            expect(result.isBlocked).toBe(false);
            expect(result.reason).toBeUndefined();
            expect(result.message).toBeUndefined();
            expect(result.finishReason).toBeUndefined();
        });
    });

    describe('Integration scenarios', () => {
        it('should prioritize promptFeedback over missing candidates', () => {
            const response = {
                promptFeedback: {
                    blockReason: 'SAFETY',
                    safetyRatings: [
                        {
                            category: 'HARM_CATEGORY_HARASSMENT',
                            probability: 'HIGH',
                        },
                    ],
                },
            };

            const result = checkResponseSafety(response);

            expect(result.isBlocked).toBe(true);
            expect(result.reason).toBe('SAFETY');
            expect(result.message).toBe('Prompt blocked: SAFETY');
        });

        it('should prioritize finishReason over safetyRatings', () => {
            const response = {
                candidates: [
                    {
                        finishReason: 'RECITATION',
                        content: { parts: [] },
                        safetyRatings: [
                            {
                                category: 'HARM_CATEGORY_HARASSMENT',
                                probability: 'HIGH',
                                blocked: true,
                            },
                        ],
                    },
                ],
            };

            const result = checkResponseSafety(response);

            // finishReason should be checked first
            expect(result.isBlocked).toBe(true);
            expect(result.reason).toBe('RECITATION');
            expect(result.message).toBe('Content was blocked due to potential copyright concerns');
        });

        it('should handle real-world Gemini API response structure', () => {
            const response = {
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: 'Hello! I am a helpful AI assistant.',
                                },
                            ],
                            role: 'model',
                        },
                        finishReason: 'STOP',
                        index: 0,
                        safetyRatings: [
                            {
                                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                                probability: 'NEGLIGIBLE',
                            },
                            {
                                category: 'HARM_CATEGORY_HATE_SPEECH',
                                probability: 'NEGLIGIBLE',
                            },
                            {
                                category: 'HARM_CATEGORY_HARASSMENT',
                                probability: 'NEGLIGIBLE',
                            },
                            {
                                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                                probability: 'NEGLIGIBLE',
                            },
                        ],
                    },
                ],
                usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30,
                },
            };

            const result = checkResponseSafety(response);

            expect(result.isBlocked).toBe(false);
        });

        it('should handle real-world Imagen API response structure', () => {
            const result = {
                generatedImages: [
                    {
                        image: {
                            imageBytes: 'base64encodedimagedata...',
                        },
                        raiFilteredReason: null,
                    },
                ],
            };

            const safetyResult = checkImageSafety(result);

            expect(safetyResult.isBlocked).toBe(false);
        });

        it('should handle real-world Veo API error response', () => {
            const result = {
                error: {
                    code: 400,
                    message: 'The video generation request was blocked by safety filters.',
                    status: 'INVALID_ARGUMENT',
                    details: [
                        {
                            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                            reason: 'SAFETY_BLOCK',
                            message: 'Content flagged by safety system',
                        },
                    ],
                },
            };

            const safetyResult = checkVideoSafety(result);

            expect(safetyResult.isBlocked).toBe(true);
            expect(safetyResult.reason).toBe('SAFETY');
            expect(safetyResult.message).toBe('The video generation request was blocked by safety filters.');
        });
    });
});
