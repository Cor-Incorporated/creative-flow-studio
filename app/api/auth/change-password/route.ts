import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, comparePassword } from '@/lib/password';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/constants';
import { jsonError, createRequestId } from '@/lib/api-utils';

/**
 * POST /api/auth/change-password
 *
 * Change the current user's password.
 *
 * Request body:
 *   - currentPassword?: string - Required if user already has a password set (credentials user)
 *   - newPassword: string - The new password (MIN_PASSWORD_LENGTH to MAX_PASSWORD_LENGTH chars)
 *
 * Behavior:
 *   - If user has no password (OAuth-only user): Sets new password without requiring currentPassword
 *   - If user has a password: Requires valid currentPassword to change
 *
 * Security considerations:
 *   - Never log or return passwords
 *   - Use constant-time comparison for password verification
 *   - Record audit log for password changes
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = createRequestId();

    try {
        // 1. Require authentication
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return jsonError({
                message: '認証が必要です',
                status: 401,
                code: 'UNAUTHORIZED',
                requestId,
            });
        }

        const userId = session.user.id;

        // 2. Parse and validate request body
        let body: { currentPassword?: string; newPassword?: string };
        try {
            body = await request.json();
        } catch {
            return jsonError({
                message: 'リクエストの形式が正しくありません',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        const { currentPassword, newPassword } = body;

        // 3. Validate newPassword
        if (!newPassword || typeof newPassword !== 'string') {
            return jsonError({
                message: '新しいパスワードを入力してください',
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return jsonError({
                message: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`,
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        if (newPassword.length > MAX_PASSWORD_LENGTH) {
            return jsonError({
                message: `パスワードは${MAX_PASSWORD_LENGTH}文字以下で入力してください`,
                status: 400,
                code: 'VALIDATION_ERROR',
                requestId,
            });
        }

        // 4. Fetch user from database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, password: true },
        });

        if (!user) {
            // User was deleted between session creation and this request
            return jsonError({
                message: 'ユーザーが見つかりません',
                status: 404,
                code: 'NOT_FOUND',
                requestId,
            });
        }

        // 5. Determine if this is a "set" (first time) or "change" operation
        const hasExistingPassword = user.password !== null;
        let method: 'set' | 'change';

        if (hasExistingPassword) {
            // User already has a password - require currentPassword verification
            method = 'change';

            if (!currentPassword || typeof currentPassword !== 'string') {
                return jsonError({
                    message: '現在のパスワードを入力してください',
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    requestId,
                });
            }

            // Verify currentPassword
            const isValid = await comparePassword(currentPassword, user.password!);

            if (!isValid) {
                return jsonError({
                    message: '現在のパスワードが正しくありません',
                    status: 400,
                    code: 'VALIDATION_ERROR',
                    requestId,
                });
            }
        } else {
            // OAuth-only user setting password for first time
            method = 'set';
            // No currentPassword required
        }

        // 6. Hash and update password
        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        // 7. Record audit log
        try {
            await prisma.auditLog.create({
                data: {
                    userId,
                    action: 'auth.password_changed',
                    resource: 'user',
                    metadata: {
                        method,
                    },
                },
            });
        } catch (auditError) {
            // Log but don't fail the request if audit logging fails
            console.error('[change-password] Failed to create audit log', {
                userId,
                error: auditError instanceof Error ? auditError.message : 'Unknown error',
            });
        }

        console.info('[change-password] Password changed successfully', {
            userId,
            method,
        });

        return NextResponse.json(
            { ok: true },
            {
                status: 200,
                headers: { 'X-Request-Id': requestId },
            }
        );
    } catch (error) {
        console.error('[change-password] Unexpected error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId,
        });

        return jsonError({
            message: 'パスワードの変更に失敗しました',
            status: 500,
            code: 'INTERNAL_ERROR',
            requestId,
        });
    }
}
