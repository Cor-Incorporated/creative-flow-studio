import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const videoUri = searchParams.get('uri');
        const fileName = searchParams.get('file');
        const hintedMimeType = searchParams.get('mimeType') || undefined;

        if (!videoUri && !fileName) {
            return NextResponse.json(
                { error: 'Video URI or file identifier is required' },
                { status: 400 }
            );
        }

        // Get API key from server-side environment variable
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
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
            return NextResponse.json(
                { error: 'Unable to resolve download URL for video asset' },
                { status: 400 }
            );
        }

        const videoResponse = await fetch(upstreamUrl);

        if (!videoResponse.ok) {
            console.error('Failed to fetch video from Gemini:', videoResponse.statusText);
            return NextResponse.json(
                { error: 'Failed to download video from Gemini API' },
                { status: videoResponse.status }
            );
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
        console.error('Error in video download proxy:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to download video' },
            { status: 500 }
        );
    }
}
