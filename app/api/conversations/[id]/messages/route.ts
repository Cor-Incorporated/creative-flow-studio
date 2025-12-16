import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createMessageSchema } from '@/lib/validators';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/conversations/[id]/messages
 * Add a new message to a conversation
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only add messages to their own conversations
 *
 * Request Body:
 * {
 *   role: 'USER' | 'MODEL' | 'SYSTEM'
 *   mode?: 'CHAT' | 'PRO' | 'SEARCH' | 'IMAGE' | 'VIDEO'  // Mode for this message (multi-mode support)
 *   content: Array<{
 *     text?: string
 *     media?: { type: 'image' | 'video', url: string, mimeType: string }
 *     sources?: Array<{ uri: string, title?: string }>
 *     isLoading?: boolean
 *     status?: string
 *     isError?: boolean
 *     isEditing?: boolean
 *     originalMedia?: { type: 'image' | 'video', url: string, mimeType: string }
 *   }>
 * }
 *
 * Response:
 * {
 *   message: {
 *     id: string
 *     conversationId: string
 *     role: string
 *     mode: string
 *     content: any (JSON)
 *     createdAt: string
 *   }
 * }
 *
 * References:
 * - Prisma JSON fields: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields#working-with-json-fields
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let id: string | undefined;
    try {
        const resolvedParams = await params;
        id = resolvedParams.id;

        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Check if conversation exists and user owns it
        const conversation = await prisma.conversation.findUnique({
            where: { id },
            select: { id: true, userId: true },
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // 3. Authorization: Check if user owns this conversation
        if (conversation.userId !== session.user.id) {
            return NextResponse.json(
                { error: 'Forbidden: You do not have access to this conversation' },
                { status: 403 }
            );
        }

        // 4. Parse and validate request body
        const body = await request.json();
        const validationResult = createMessageSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: 'Invalid request body',
                    details: validationResult.error.issues,
                },
                { status: 400 }
            );
        }

        const { role, mode, content } = validationResult.data;

        // 5. Create message in database and update conversation updatedAt
        const message = await prisma.message.create({
            data: {
                conversationId: id,
                role,
                mode: mode || 'CHAT', // Default to CHAT if not specified
                content: content as any, // Prisma accepts JSON as any
            },
        });

        // 6. Update conversation updatedAt timestamp
        await prisma.conversation.update({
            where: { id },
            data: { updatedAt: new Date() },
        });

        // 7. Return created message
        return NextResponse.json({ message }, { status: 201 });
    } catch (error: any) {
        console.error(`Error in POST /api/conversations/${id || 'unknown'}/messages:`, error);
        return NextResponse.json(
            {
                error: 'Failed to create message',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
