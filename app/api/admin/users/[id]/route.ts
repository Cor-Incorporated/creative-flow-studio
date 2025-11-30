import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateUserRoleSchema } from '@/lib/validators';

/**
 * PATCH /api/admin/users/[id]
 * Update user role (e.g., promote to ADMIN)
 *
 * Authentication: Required (NextAuth session)
 * Authorization: ADMIN role required (Defense in Depth)
 *
 * Request Body:
 * {
 *   role: Role // USER | PRO | ENTERPRISE | ADMIN
 * }
 *
 * Response:
 * {
 *   user: {
 *     id: string
 *     email: string
 *     role: Role
 *     updatedAt: string
 *   }
 * }
 *
 * References:
 * - docs/admin-api-design.md (Phase 6 Step 2)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // 1. Authentication: Check if user is logged in
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Authorization: Verify ADMIN role (Defense in Depth)
        const adminUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (adminUser?.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Forbidden: Admin access required' },
                { status: 403 }
            );
        }

        // 3. Validate request body
        const body = await request.json();
        const { role } = updateUserRoleSchema.parse(body);

        // 4. Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                email: true,
                role: true,
            },
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 5. Update user role
        const updatedUser = await prisma.user.update({
            where: { id: params.id },
            data: { role },
            select: {
                id: true,
                email: true,
                role: true,
                updatedAt: true,
            },
        });

        // 6. Log to AuditLog
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'admin.users.update_role',
                resource: `User:${params.id}`,
                metadata: {
                    targetUserId: params.id,
                    targetUserEmail: targetUser.email,
                    previousRole: targetUser.role,
                    newRole: role,
                },
                ipAddress: request.headers.get('x-forwarded-for'),
                userAgent: request.headers.get('user-agent'),
            },
        });

        // 7. Return response
        return NextResponse.json({
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                role: updatedUser.role,
                updatedAt: updatedUser.updatedAt.toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Error in PATCH /api/admin/users/[id]:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
            return NextResponse.json(
                {
                    error: 'Invalid request body',
                    details: error.errors,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to update user role',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
