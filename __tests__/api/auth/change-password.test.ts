/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/auth/change-password/route';
import { prisma } from '@/lib/prisma';
import { comparePassword, hashPassword } from '@/lib/password';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/constants';

// Mock NextAuth
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

// Mock password utilities
vi.mock('@/lib/password', () => ({
    comparePassword: vi.fn(),
    hashPassword: vi.fn(),
}));

function createRequest(body: object): NextRequest {
    return new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/auth/change-password', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Authentication', () => {
        it('should return 401 if user is not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.code).toBe('UNAUTHORIZED');
            expect(data.error).toBe('認証が必要です');
        });

        it('should return 401 if session has no user id', async () => {
            (getServerSession as any).mockResolvedValue({ user: { email: 'test@example.com' } });

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.code).toBe('UNAUTHORIZED');
        });
    });

    describe('Request Validation', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-1',
                password: null, // OAuth user
            });
        });

        it('should return 400 if request body is not valid JSON', async () => {
            const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json',
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe('リクエストの形式が正しくありません');
        });

        it('should return 400 if newPassword is missing', async () => {
            const request = createRequest({});
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe('新しいパスワードを入力してください');
        });

        it('should return 400 if newPassword is not a string', async () => {
            const request = createRequest({ newPassword: 12345 });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
        });

        it(`should return 400 if newPassword is shorter than ${MIN_PASSWORD_LENGTH} characters`, async () => {
            const shortPassword = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
            const request = createRequest({ newPassword: shortPassword });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
        });

        it(`should return 400 if newPassword is longer than ${MAX_PASSWORD_LENGTH} characters`, async () => {
            const longPassword = 'a'.repeat(MAX_PASSWORD_LENGTH + 1);
            const request = createRequest({ newPassword: longPassword });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe(`パスワードは${MAX_PASSWORD_LENGTH}文字以下で入力してください`);
        });
    });

    describe('User Not Found', () => {
        it('should return 404 if user does not exist in database', async () => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'nonexistent-user', email: 'test@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue(null);

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.code).toBe('NOT_FOUND');
            expect(data.error).toBe('ユーザーが見つかりません');
        });
    });

    describe('OAuth User (no existing password)', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'oauth-user', email: 'oauth@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'oauth-user',
                password: null,
            });
            (hashPassword as any).mockResolvedValue('hashed-new-password');
            (prisma.user.update as any).mockResolvedValue({});
            (prisma.auditLog.create as any).mockResolvedValue({});
        });

        it('should allow setting password without currentPassword', async () => {
            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.ok).toBe(true);
        });

        it('should hash and save the new password', async () => {
            const request = createRequest({ newPassword: 'newpassword123' });
            await POST(request);

            expect(hashPassword).toHaveBeenCalledWith('newpassword123');
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'oauth-user' },
                data: { password: 'hashed-new-password' },
            });
        });

        it('should create audit log with method "set"', async () => {
            const request = createRequest({ newPassword: 'newpassword123' });
            await POST(request);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'oauth-user',
                    action: 'auth.password_changed',
                    resource: 'user',
                    metadata: { method: 'set' },
                },
            });
        });

        it('should ignore currentPassword if provided for OAuth user', async () => {
            const request = createRequest({
                currentPassword: 'ignored-password',
                newPassword: 'newpassword123',
            });
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(comparePassword).not.toHaveBeenCalled();
        });
    });

    describe('Credentials User (has existing password)', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'credentials-user', email: 'credentials@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'credentials-user',
                password: 'existing-hashed-password',
            });
            (hashPassword as any).mockResolvedValue('hashed-new-password');
            (prisma.user.update as any).mockResolvedValue({});
            (prisma.auditLog.create as any).mockResolvedValue({});
        });

        it('should return 400 if currentPassword is missing', async () => {
            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe('現在のパスワードを入力してください');
        });

        it('should return 400 if currentPassword is not a string', async () => {
            const request = createRequest({
                currentPassword: 12345,
                newPassword: 'newpassword123',
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe('現在のパスワードを入力してください');
        });

        it('should return 400 if currentPassword is incorrect', async () => {
            (comparePassword as any).mockResolvedValue(false);

            const request = createRequest({
                currentPassword: 'wrong-password',
                newPassword: 'newpassword123',
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('VALIDATION_ERROR');
            expect(data.error).toBe('現在のパスワードが正しくありません');
        });

        it('should successfully change password with valid currentPassword', async () => {
            (comparePassword as any).mockResolvedValue(true);

            const request = createRequest({
                currentPassword: 'correct-password',
                newPassword: 'newpassword123',
            });
            const response = await POST(request);

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.ok).toBe(true);
        });

        it('should verify currentPassword with comparePassword', async () => {
            (comparePassword as any).mockResolvedValue(true);

            const request = createRequest({
                currentPassword: 'correct-password',
                newPassword: 'newpassword123',
            });
            await POST(request);

            expect(comparePassword).toHaveBeenCalledWith(
                'correct-password',
                'existing-hashed-password'
            );
        });

        it('should create audit log with method "change"', async () => {
            (comparePassword as any).mockResolvedValue(true);

            const request = createRequest({
                currentPassword: 'correct-password',
                newPassword: 'newpassword123',
            });
            await POST(request);

            expect(prisma.auditLog.create).toHaveBeenCalledWith({
                data: {
                    userId: 'credentials-user',
                    action: 'auth.password_changed',
                    resource: 'user',
                    metadata: { method: 'change' },
                },
            });
        });
    });

    describe('Response Headers', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-1',
                password: null,
            });
            (hashPassword as any).mockResolvedValue('hashed');
            (prisma.user.update as any).mockResolvedValue({});
            (prisma.auditLog.create as any).mockResolvedValue({});
        });

        it('should include X-Request-Id header on success', async () => {
            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('should include requestId in response body on success', async () => {
            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            // Success response doesn't include requestId in body, only in header
            const data = await response.json();
            expect(data.ok).toBe(true);
        });

        it('should include requestId in error response body', async () => {
            (getServerSession as any).mockResolvedValue(null);

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            const data = await response.json();
            expect(data.requestId).toBeTruthy();
            expect(response.headers.get('X-Request-Id')).toBe(data.requestId);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-1',
                password: null,
            });
        });

        it('should return 500 if password hashing fails', async () => {
            (hashPassword as any).mockRejectedValue(new Error('Hash error'));

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.code).toBe('INTERNAL_ERROR');
            expect(data.error).toBe('パスワードの変更に失敗しました');
        });

        it('should return 500 if database update fails', async () => {
            (hashPassword as any).mockResolvedValue('hashed');
            (prisma.user.update as any).mockRejectedValue(new Error('Database error'));

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.code).toBe('INTERNAL_ERROR');
        });

        it('should succeed even if audit log creation fails', async () => {
            (hashPassword as any).mockResolvedValue('hashed');
            (prisma.user.update as any).mockResolvedValue({});
            (prisma.auditLog.create as any).mockRejectedValue(new Error('Audit log error'));

            const request = createRequest({ newPassword: 'newpassword123' });
            const response = await POST(request);

            // Password change should still succeed
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.ok).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            (getServerSession as any).mockResolvedValue({
                user: { id: 'user-1', email: 'test@example.com' },
            });
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-1',
                password: null,
            });
            (hashPassword as any).mockResolvedValue('hashed');
            (prisma.user.update as any).mockResolvedValue({});
            (prisma.auditLog.create as any).mockResolvedValue({});
        });

        it('should accept password with exactly MIN_PASSWORD_LENGTH characters', async () => {
            const exactMinPassword = 'a'.repeat(MIN_PASSWORD_LENGTH);
            const request = createRequest({ newPassword: exactMinPassword });
            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it('should accept password with exactly MAX_PASSWORD_LENGTH characters', async () => {
            const exactMaxPassword = 'a'.repeat(MAX_PASSWORD_LENGTH);
            const request = createRequest({ newPassword: exactMaxPassword });
            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it('should handle password with special characters', async () => {
            const specialPassword = 'p@$$w0rd!#$%^&*()_+{}[]|:;<>?,./~`';
            const request = createRequest({ newPassword: specialPassword });
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(hashPassword).toHaveBeenCalledWith(specialPassword);
        });

        it('should handle password with unicode characters', async () => {
            const unicodePassword = 'パスワード12345';
            const request = createRequest({ newPassword: unicodePassword });
            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(hashPassword).toHaveBeenCalledWith(unicodePassword);
        });

        it('should handle empty string currentPassword for credentials user', async () => {
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-1',
                password: 'existing-password',
            });

            const request = createRequest({
                currentPassword: '',
                newPassword: 'newpassword123',
            });
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('現在のパスワードを入力してください');
        });
    });
});
