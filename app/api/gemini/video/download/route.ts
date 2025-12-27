import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createRequestId, jsonError } from '@/lib/api-utils';
import { safeErrorForLog } from '@/lib/utils';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/gemini/video/download
 * Video Download Proxy API
 *
 * This endpoint proxies video downloads from Gemini API to avoid exposing
 * the API key on the client side. The client sends the video URI, and this
 * endpoint fetches the video using the server-side GEMINI_API_KEY.
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ENTERPRISE plan required (implicitly, since only ENTERPRISE can generate videos)
 *
 * @see https://ai.google.dev/gemini-api/docs/video-generation
 */
export async function GET(request: NextRequest) {
    const requestId = createRequestId();
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return jsonError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED', requestId });
        }

        const searchParams = request.nextUrl.searchParams;
        const videoUri = searchParams.get('uri');
        const fileName = searchParams.get('file');
        const hintedMimeType = searchParams.get('mimeType') || undefined;

        if (!videoUri && !fileName) {
            return jsonError({
                message: 'Video URI or file identifier is required',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // Get API key from server-side environment variable
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not configured', { requestId });
            return jsonError({
                message: 'Server configuration error',
                status: 500,
                code: 'GEMINI_API_KEY_NOT_FOUND',
                requestId,
            });
        }

        const normalizeFileParam = (value: string) => {
            const trimmed = value.trim().replace(/^\/+/, '');
            const filesIndex = trimmed.indexOf('files/');
            const base = filesIndex >= 0 ? trimmed.slice(filesIndex) : trimmed;
            if (base.startsWith('files/')) {
                return base;
            }
            if (/^[A-Za-z0-9_-]+$/.test(base)) {
                return `files/${base}`;
            }
            return trimmed;
        };

        const resolveVideoUrl = () => {
            if (videoUri) {
                const hasProtocol = videoUri.startsWith('http://') || videoUri.startsWith('https://');
                const baseUrl = hasProtocol
                    ? videoUri
                    : `https://generativelanguage.googleapis.com/v1beta/${videoUri.replace(/^\/+/, '')}`;
                const separator = baseUrl.includes('?') ? '&' : '?';
                if (baseUrl.includes('key=')) {
                    return baseUrl;
                }
                return `${baseUrl}${separator}key=${apiKey}`;
            }

            if (fileName) {
                const normalizedName = normalizeFileParam(fileName);
                return `https://generativelanguage.googleapis.com/v1beta/${normalizedName}:download?key=${apiKey}`;
            }

            return null;
        };

        const upstreamUrl = resolveVideoUrl();
        if (!upstreamUrl) {
            return jsonError({
                message: 'Unable to resolve download URL for video asset',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        const videoResponse = await fetch(upstreamUrl);

        if (!videoResponse.ok) {
            // Try to read error body for better debugging
            let errorBody = '';
            try {
                const text = await videoResponse.text();
                // Truncate long error bodies for logging (max 500 chars)
                errorBody = text.length > 500 ? text.slice(0, 500) + '...' : text;
            } catch {
                errorBody = '(unable to read response body)';
            }

            console.error('Failed to fetch video from Gemini', {
                requestId,
                status: videoResponse.status,
                statusText: videoResponse.statusText,
                errorBody,
                uri: videoUri ? '(uri provided)' : undefined,
                file: fileName ? '(file provided)' : undefined,
            });

            // Provide user-friendly messages based on status code
            let userMessage = 'Failed to download video from Gemini API';
            let userHint = '';

            if (videoResponse.status === 403) {
                userMessage = '動画のダウンロードに失敗しました（アクセス権限エラー）';
                userHint = '動画の有効期限が切れている可能性があります。動画を再生成してください。';
            } else if (videoResponse.status === 404) {
                userMessage = '動画が見つかりませんでした';
                userHint = '動画が削除されたか、URLが無効です。動画を再生成してください。';
            } else if (videoResponse.status === 429) {
                userMessage = 'リクエスト制限に達しました';
                userHint = 'しばらく待ってから再試行してください。';
            }

            return jsonError({
                message: userMessage,
                status: videoResponse.status,
                code: 'UPSTREAM_ERROR',
                requestId,
                details: videoResponse.statusText,
                extra: userHint ? { hint: userHint } : undefined,
            });
        }

        const videoBuffer = await videoResponse.arrayBuffer();

        // Return video as response with proper content type
        return new NextResponse(videoBuffer, {
            status: 200,
            headers: {
                'Content-Type':
                    videoResponse.headers.get('Content-Type') || hintedMimeType || 'video/mp4',
                'Content-Length': videoBuffer.byteLength.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error: any) {
        console.error('Error in video download proxy', { requestId, error: safeErrorForLog(error) });
        return jsonError({
            message: error.message || 'Failed to download video',
            status: 500,
            code: 'INTERNAL_ERROR',
            requestId,
        });
    }
}
