import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createConversationSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * List user's conversations with pagination and filtering
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only see their own conversations
 *
 * Query Parameters:
 * - limit (optional, default: 20): Number of conversations to return
 * - offset (optional, default: 0): Number of conversations to skip
 * - mode (optional): Filter by GenerationMode (CHAT | PRO | SEARCH | IMAGE | VIDEO)
 *
 * Response:
 * {
 *   conversations: Array<{
 *     id: string
 *     title: string | null
 *     mode: string
 *     createdAt: string
 *     updatedAt: string
 *     messageCount: number
 *   }>
 *   total: number
 * }
 *
 * References:
 * - Prisma Pagination: https://www.prisma.io/docs/concepts/components/prisma-client/pagination
 * - Prisma Filtering: https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse query parameters
        const { searchParams } = request.nextUrl;
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100
        const offset = parseInt(searchParams.get('offset') || '0');
        const mode = searchParams.get('mode') as
            | 'CHAT'
            | 'PRO'
            | 'SEARCH'
            | 'IMAGE'
            | 'VIDEO'
            | null;

        // 3. Build where clause
        const where: any = { userId: session.user.id };
        if (mode) {
            where.mode = mode;
        }

        // 4. Fetch conversations with message count
        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    mode: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: { messages: true },
                    },
                },
                orderBy: {
                    updatedAt: 'desc', // Most recently updated first
                },
                take: limit,
                skip: offset,
            }),
            prisma.conversation.count({ where }),
        ]);

        // 5. Format response
        const formattedConversations = conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            mode: conv.mode,
            createdAt: conv.createdAt.toISOString(),
            updatedAt: conv.updatedAt.toISOString(),
            messageCount: conv._count.messages,
        }));

        return NextResponse.json({
            conversations: formattedConversations,
            total,
        });
    } catch (error: any) {
        console.error('Error in GET /api/conversations:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch conversations',
                details: error.message,
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/conversations
 * Create a new conversation
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only create conversations for themselves
 *
 * Request Body:
 * {
 *   title?: string (max 200 chars)
 *   mode?: 'CHAT' | 'PRO' | 'SEARCH' | 'IMAGE' | 'VIDEO'
 * }
 *
 * Response:
 * {
 *   conversation: {
 *     id: string
 *     title: string | null
 *     mode: string
 *     userId: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 * }
 *
 * References:
 * - Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
 * - NextAuth getServerSession: https://next-auth.js.org/configuration/nextauth-api#getserversession
 * - Prisma Client: https://www.prisma.io/docs/concepts/components/prisma-client
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse and validate request body
        const body = await request.json();
        const validationResult = createConversationSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: 'Invalid request body',
                    details: validationResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { title, mode } = validationResult.data;

        // 3. Create conversation in database
        const conversation = await prisma.conversation.create({
            data: {
                title: title || null,
                mode: mode || 'CHAT',
                userId: session.user.id,
            },
        });

        // 4. Return created conversation
        return NextResponse.json({ conversation }, { status: 201 });
    } catch (error: any) {
        console.error('Error in POST /api/conversations:', error);
        return NextResponse.json(
            {
                error: 'Failed to create conversation',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
