/**
 * Media Reference Detection Tests
 *
 * Tests for natural language detection of image references
 * and auto-injection decision logic.
 */

import { describe, it, expect } from 'vitest';
import {
    detectMediaReference,
    shouldAutoInjectImage,
    type MediaReferenceResult,
    type AutoInjectResult,
} from '@/lib/mediaReference';
import type { Media } from '@/types/app';

// Mock image for testing
const mockImage: Media = {
    type: 'image',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
};

describe('detectMediaReference', () => {
    describe('Japanese image reference patterns', () => {
        it('should detect "この画像"', () => {
            const result = detectMediaReference('この画像を分析して');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "今の画像"', () => {
            const result = detectMediaReference('今の画像を見て');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "さっきの画像"', () => {
            const result = detectMediaReference('さっきの画像を動画にして');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "生成した画像"', () => {
            const result = detectMediaReference('生成した画像を説明して');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "上の画像"', () => {
            const result = detectMediaReference('上の画像について教えて');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "その画像"', () => {
            const result = detectMediaReference('その画像を使って');
            expect(result.hasImageReference).toBe(true);
        });
    });

    describe('English image reference patterns', () => {
        it('should detect "this image" (case insensitive)', () => {
            const result = detectMediaReference('Analyze this image');
            expect(result.hasImageReference).toBe(true);

            const result2 = detectMediaReference('THIS IMAGE looks nice');
            expect(result2.hasImageReference).toBe(true);
        });

        it('should detect "the image"', () => {
            const result = detectMediaReference('What is in the image?');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "that image"', () => {
            const result = detectMediaReference('Describe that image');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "generated image"', () => {
            const result = detectMediaReference('Use the generated image for video');
            expect(result.hasImageReference).toBe(true);
        });

        it('should detect "previous image"', () => {
            const result = detectMediaReference('Go back to the previous image');
            expect(result.hasImageReference).toBe(true);
        });
    });

    describe('Japanese video intent patterns', () => {
        it('should detect "動画を作って"', () => {
            const result = detectMediaReference('この画像で動画を作って');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "動画生成"', () => {
            const result = detectMediaReference('この画像から動画生成して');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "ビデオを作って"', () => {
            const result = detectMediaReference('この画像でビデオを作って');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "アニメーション"', () => {
            const result = detectMediaReference('この画像をアニメーション化して');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "動かして"', () => {
            const result = detectMediaReference('この画像を動かして');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "動画にして"', () => {
            const result = detectMediaReference('この画像を動画にして');
            expect(result.hasVideoIntent).toBe(true);
        });
    });

    describe('English video intent patterns', () => {
        it('should detect "make a video"', () => {
            const result = detectMediaReference('Make a video from this image');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "create video"', () => {
            const result = detectMediaReference('Create video using the image');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "generate video"', () => {
            const result = detectMediaReference('Generate a video');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "animate"', () => {
            const result = detectMediaReference('Animate this image');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "turn into video"', () => {
            const result = detectMediaReference('Turn this into a video');
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect "convert to video"', () => {
            const result = detectMediaReference('Convert to video');
            expect(result.hasVideoIntent).toBe(true);
        });
    });

    describe('Japanese analysis patterns', () => {
        it('should detect "分析して"', () => {
            const result = detectMediaReference('この画像を分析して');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "説明して"', () => {
            const result = detectMediaReference('この画像を説明して');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "何が写って"', () => {
            const result = detectMediaReference('この画像には何が写っていますか');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "教えて"', () => {
            const result = detectMediaReference('この画像について教えて');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "見て"', () => {
            const result = detectMediaReference('この画像を見て');
            expect(result.isAnalysisRequest).toBe(true);
        });
    });

    describe('English analysis patterns', () => {
        it('should detect "analyze"', () => {
            const result = detectMediaReference('Analyze the image');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "describe"', () => {
            const result = detectMediaReference('Describe what you see');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "what is in"', () => {
            const result = detectMediaReference("What is in the image?");
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "tell me about"', () => {
            const result = detectMediaReference('Tell me about this image');
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect "explain"', () => {
            const result = detectMediaReference('Explain what this shows');
            expect(result.isAnalysisRequest).toBe(true);
        });
    });

    describe('Negative cases (should NOT match)', () => {
        it('should not match "imaging" as image reference', () => {
            const result = detectMediaReference('I am imaging a solution');
            expect(result.hasImageReference).toBe(false);
        });

        it('should not match prompts without image reference', () => {
            const result = detectMediaReference('Tell me about cats');
            expect(result.hasImageReference).toBe(false);
        });

        it('should not match "image" as a substring', () => {
            const result = detectMediaReference('The imagery is beautiful');
            expect(result.hasImageReference).toBe(false);
        });

        it('should not detect video intent without relevant keywords', () => {
            const result = detectMediaReference('この画像を分析して');
            expect(result.hasVideoIntent).toBe(false);
        });

        it('should not detect analysis request without relevant keywords', () => {
            const result = detectMediaReference('Hello, how are you?');
            expect(result.isAnalysisRequest).toBe(false);
        });
    });

    describe('Combined detection', () => {
        it('should detect both image reference and video intent', () => {
            const result = detectMediaReference('この画像を動画にして');
            expect(result.hasImageReference).toBe(true);
            expect(result.hasVideoIntent).toBe(true);
        });

        it('should detect both image reference and analysis request', () => {
            const result = detectMediaReference('この画像を分析して説明して');
            expect(result.hasImageReference).toBe(true);
            expect(result.isAnalysisRequest).toBe(true);
        });

        it('should detect image reference, video intent, AND analysis (edge case)', () => {
            const result = detectMediaReference('この画像を分析して動画を作って');
            expect(result.hasImageReference).toBe(true);
            expect(result.hasVideoIntent).toBe(true);
            expect(result.isAnalysisRequest).toBe(true);
        });
    });
});

describe('shouldAutoInjectImage', () => {
    describe('When no image is stored', () => {
        it('should return inject:false when lastGeneratedImage is null', () => {
            const result = shouldAutoInjectImage('この画像を分析して', null);
            expect(result.inject).toBe(false);
            expect(result.forVideo).toBe(false);
            expect(result.forAnalysis).toBe(false);
        });

        it('should not inject even with valid prompt when no image', () => {
            const result = shouldAutoInjectImage('この画像で動画を作って', null);
            expect(result.inject).toBe(false);
        });
    });

    describe('When no image reference in prompt', () => {
        it('should return inject:false for prompts without image reference', () => {
            const result = shouldAutoInjectImage('今日の天気を教えて', mockImage);
            expect(result.inject).toBe(false);
        });

        it('should return inject:false for unrelated prompts', () => {
            const result = shouldAutoInjectImage('Hello, how are you?', mockImage);
            expect(result.inject).toBe(false);
        });
    });

    describe('Video generation scenarios', () => {
        it('should return forVideo:true for video intent with image reference', () => {
            const result = shouldAutoInjectImage('この画像を動画にして', mockImage);
            expect(result.inject).toBe(true);
            expect(result.forVideo).toBe(true);
            expect(result.forAnalysis).toBe(false);
        });

        it('should return forVideo:true for "make a video from this image"', () => {
            const result = shouldAutoInjectImage('Make a video from this image', mockImage);
            expect(result.inject).toBe(true);
            expect(result.forVideo).toBe(true);
        });

        it('should prioritize video over analysis when both detected', () => {
            // This prompt has both video intent and analysis keywords
            const result = shouldAutoInjectImage(
                'この画像を分析して動画を作って',
                mockImage
            );
            expect(result.inject).toBe(true);
            expect(result.forVideo).toBe(true);
            expect(result.forAnalysis).toBe(false);
        });
    });

    describe('Analysis scenarios', () => {
        it('should return forAnalysis:true for analysis request with image reference', () => {
            const result = shouldAutoInjectImage('この画像を分析して', mockImage);
            expect(result.inject).toBe(true);
            expect(result.forVideo).toBe(false);
            expect(result.forAnalysis).toBe(true);
        });

        it('should return forAnalysis:true for "describe the image"', () => {
            const result = shouldAutoInjectImage('Describe the image', mockImage);
            expect(result.inject).toBe(true);
            expect(result.forAnalysis).toBe(true);
        });

        it('should return forAnalysis:true for "この画像について教えて"', () => {
            const result = shouldAutoInjectImage('この画像について教えて', mockImage);
            expect(result.inject).toBe(true);
            expect(result.forAnalysis).toBe(true);
        });
    });

    describe('Default behavior', () => {
        it('should default to analysis when image reference exists but no clear action', () => {
            // This has image reference but no clear video/analysis keywords
            const result = shouldAutoInjectImage('この画像を使って', mockImage);
            expect(result.inject).toBe(true);
            expect(result.forVideo).toBe(false);
            expect(result.forAnalysis).toBe(true);
        });
    });
});
