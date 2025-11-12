import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * Video Download Proxy API
 *
 * This endpoint proxies video downloads from Gemini API to avoid exposing
 * the API key on the client side. The client sends the video URI, and this
 * endpoint fetches the video using the server-side GEMINI_API_KEY.
 *
 * @see https://ai.google.dev/gemini-api/docs/video-generation
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const videoUri = searchParams.get('uri');

        if (!videoUri) {
            return NextResponse.json({ error: 'Video URI is required' }, { status: 400 });
        }

        // Get API key from server-side environment variable
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Fetch video from Gemini API with API key
        const videoUrl = `${videoUri}&key=${apiKey}`;
        const videoResponse = await fetch(videoUrl);

        if (!videoResponse.ok) {
            console.error('Failed to fetch video from Gemini:', videoResponse.statusText);
            return NextResponse.json(
                { error: 'Failed to download video from Gemini API' },
                { status: videoResponse.status }
            );
        }

        // Get video data as blob
        const videoBlob = await videoResponse.blob();

        // Return video as response with proper content type
        return new NextResponse(videoBlob, {
            status: 200,
            headers: {
                'Content-Type': videoResponse.headers.get('Content-Type') || 'video/mp4',
                'Content-Length': videoBlob.size.toString(),
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
