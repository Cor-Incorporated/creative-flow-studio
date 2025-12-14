import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDefaultFreeSubscriptionWithClient } from '@/lib/subscription';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

vi.mock('@/lib/subscription', () => ({
  createDefaultFreeSubscriptionWithClient: vi.fn(),
}));

// Mock safeErrorForLog
vi.mock('@/lib/utils', () => ({
  ...vi.importActual('@/lib/utils'),
  safeErrorForLog: (err: any) => err,
}));

describe('authOptions.events.createUser', () => {
  const createUserHandler = authOptions.events?.createUser;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  if (!createUserHandler) {
    throw new Error('createUser event handler is not defined');
  }

  it('should create subscription for new user if none exists', async () => {
    // Setup: No existing subscription
    (prisma.subscription.findUnique as any).mockResolvedValue(null);

    await createUserHandler({ user: mockUser });

    // Verify idempotency check
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: mockUser.id },
      select: { id: true },
    });

    // Verify transaction and creation
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(createDefaultFreeSubscriptionWithClient).toHaveBeenCalledWith(
      mockUser.id,
      prisma
    );
  });

  it('should NOT create subscription if one already exists (Idempotency)', async () => {
    // Setup: Subscription already exists
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: 'sub-existing' });

    await createUserHandler({ user: mockUser });

    // Verify check
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: mockUser.id },
      select: { id: true },
    });

    // Verify NO creation
    expect(createDefaultFreeSubscriptionWithClient).not.toHaveBeenCalled();
  });

  it('should log error but NOT throw if creation fails', async () => {
    // Setup: No subscription, but creation throws
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const mockError = new Error('DB Error');
    (createDefaultFreeSubscriptionWithClient as any).mockRejectedValue(mockError);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    // Should not throw
    await expect(createUserHandler({ user: mockUser })).resolves.not.toThrow();

    // Verify error logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create default subscription'),
      expect.objectContaining({
        userId: mockUser.id,
        error: expect.objectContaining({
          message: mockError.message
        }),
      })
    );

    consoleSpy.mockRestore();
  });

  it('should handle missing user ID gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

    await createUserHandler({ user: { ...mockUser, id: '' } });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('createUser called without user.id')
    );
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
