import { authOptions } from '@/lib/auth';
import { createRequestId, jsonError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { safeErrorForLog } from '@/lib/utils';
import { updateConversationSchema } from '@/lib/validators';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const conversationIdSchema = z.string().cuid().max(64);

/**
 * GET /api/conversations/[id]
 * Retrieve a specific conversation with its messages
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only access their own conversations
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
 *     messages: Array<{
 *       id: string
 *       role: string
 *       content: any (JSON)
 *       createdAt: string
 *     }>
 *   }
 * }
 *
 * References:
 * - Next.js Dynamic Routes: https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
 * - Prisma Relations: https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId();
    let id: string | undefined;
    try {
        const resolvedParams = await params;
        id = resolvedParams.id;

        const validatedId = conversationIdSchema.safeParse(id);
        if (!validatedId.success) {
            return jsonError({
                message: 'Invalid conversation id',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }
        id = validatedId.data;

        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return jsonError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED', requestId });
        }

        // 2. Fetch conversation (without nested include to avoid cross-DB incompatibilities)
        // NOTE: We intentionally fetch messages in a separate query below.
        // In some Postgres environments, Prisma's nested include SQL can fail unexpectedly.
        const conversation = await prisma.conversation.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                mode: true,
                userId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        // 3. Check if conversation exists
        if (!conversation) {
            return jsonError({ message: 'Conversation not found', status: 404, code: 'NOT_FOUND', requestId });
        }

        // 4. Authorization: Check if user owns this conversation
        if (conversation.userId !== session.user.id) {
            return jsonError({
                message: 'Forbidden: You do not have access to this conversation',
                status: 403,
                code: 'FORBIDDEN',
                requestId,
            });
        }

        // 5. Fetch messages separately (ordered by createdAt ASC)
        //
        // NOTE: In some Postgres-compatible environments, Prisma's generated SQL for
        // `message.findMany()` can fail with `WITHIN GROUP is required for ordered-set aggregate mode`
        // (Postgres error 42809). Using a parameterized raw query avoids that query-generation path.
        //
        // NOTE: This raw query relies on the Prisma schema mapping `@@map("messages")` for the Message model.
        const messages = await prisma.$queryRaw<
            Array<{
                id: string;
                role: string;
                mode: string;
                content: Prisma.JsonValue;
                createdAt: Date;
            }>
        >`
            SELECT "id", "role", "mode", "content", "createdAt"
            FROM "messages"
            WHERE "conversationId" = ${id}
            ORDER BY "createdAt" ASC
        `;

        // 6. Return conversation with messages
        return NextResponse.json({
            conversation: {
                ...conversation,
                messages,
            },
        });
    } catch (error: any) {
        console.error(`[${requestId}] Error in GET /api/conversations/${id || 'unknown'}:`, safeErrorForLog(error));
        return jsonError({
            message: 'Failed to retrieve conversation',
            status: 500,
            code: 'INTERNAL_ERROR',
            requestId,
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        });
    }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation title
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only update their own conversations
 *
 * Request Body:
 * {
 *   title: string (max 200 chars)
 * }
 *
 * Response:
 * {
 *   conversation: {
 *     id: string
 *     title: string
 *     mode: string
 *     updatedAt: string
 *   }
 * }
 *
 * References:
 * - Prisma Update: https://www.prisma.io/docs/concepts/components/prisma-client/crud#update
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId();
    let id: string | undefined;
    try {
        const resolvedParams = await params;
        id = resolvedParams.id;

        const validatedId = conversationIdSchema.safeParse(id);
        if (!validatedId.success) {
            return jsonError({
                message: 'Invalid conversation id',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }
        id = validatedId.data;

        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return jsonError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED', requestId });
        }

        // 2. Check if conversation exists and user owns it
        const existingConversation = await prisma.conversation.findUnique({
            where: { id },
            select: { id: true, userId: true },
        });

        if (!existingConversation) {
            return jsonError({ message: 'Conversation not found', status: 404, code: 'NOT_FOUND', requestId });
        }

        // 3. Authorization: Check if user owns this conversation
        if (existingConversation.userId !== session.user.id) {
            return jsonError({
                message: 'Forbidden: You do not have access to this conversation',
                status: 403,
                code: 'FORBIDDEN',
                requestId,
            });
        }

        // 4. Parse and validate request body
        const body = await request.json();
        const validationResult = updateConversationSchema.safeParse(body);

        if (!validationResult.success) {
            return jsonError({
                message: 'Invalid request body',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
                details: validationResult.error.issues,
            });
        }

        const { title } = validationResult.data;

        // 5. Update conversation
        const updatedConversation = await prisma.conversation.update({
            where: { id },
            data: { title },
            select: {
                id: true,
                title: true,
                mode: true,
                updatedAt: true,
            },
        });

        // 6. Return updated conversation
        return NextResponse.json({
            conversation: {
                ...updatedConversation,
                updatedAt: updatedConversation.updatedAt.toISOString(),
            },
        });
    } catch (error: any) {
        console.error(`[${requestId}] Error in PATCH /api/conversations/${id || 'unknown'}:`, safeErrorForLog(error));
        return jsonError({
            message: 'Failed to update conversation',
            status: 500,
            code: 'INTERNAL_ERROR',
            requestId,
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        });
    }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation and all its messages
 *
 * Authentication: Required (NextAuth session)
 * Authorization: User can only delete their own conversations
 *
 * Response:
 * {
 *   success: true
 *   deletedId: string
 * }
 *
 * Note: Messages are automatically deleted due to onDelete: Cascade in Prisma schema
 *
 * References:
 * - Prisma Delete: https://www.prisma.io/docs/concepts/components/prisma-client/crud#delete
 * - Prisma Cascading Deletes: https://www.prisma.io/docs/concepts/components/prisma-schema/relations#cascading-deletes
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const requestId = createRequestId();
    let id: string | undefined;
    try {
        const resolvedParams = await params;
        id = resolvedParams.id;

        const validatedId = conversationIdSchema.safeParse(id);
        if (!validatedId.success) {
            return jsonError({
                message: 'Invalid conversation id',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }
        id = validatedId.data;

        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return jsonError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED', requestId });
        }

        // 2. Check if conversation exists and user owns it
        const conversation = await prisma.conversation.findUnique({
            where: { id },
            select: { id: true, userId: true },
        });

        if (!conversation) {
            return jsonError({ message: 'Conversation not found', status: 404, code: 'NOT_FOUND', requestId });
        }

        // 3. Authorization: Check if user owns this conversation
        if (conversation.userId !== session.user.id) {
            return jsonError({
                message: 'Forbidden: You do not have access to this conversation',
                status: 403,
                code: 'FORBIDDEN',
                requestId,
            });
        }

        // 4. Delete conversation (messages are automatically deleted via Cascade)
        await prisma.conversation.delete({
            where: { id },
        });

        // 5. Return success response
        return NextResponse.json({
            success: true,
            deletedId: id,
        });
    } catch (error: any) {
        console.error(`[${requestId}] Error in DELETE /api/conversations/${id || 'unknown'}:`, safeErrorForLog(error));
        return jsonError({
            message: 'Failed to delete conversation',
            status: 500,
            code: 'INTERNAL_ERROR',
            requestId,
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        });
    }
}
