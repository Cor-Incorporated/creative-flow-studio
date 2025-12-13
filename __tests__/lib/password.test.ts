import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '@/lib/password';

describe('password', () => {
    it('hashPassword then comparePassword succeeds', async () => {
        const hashed = await hashPassword('correct horse battery staple');
        const ok = await comparePassword('correct horse battery staple', hashed);
        expect(ok).toBe(true);
    });

    it('comparePassword fails for wrong password', async () => {
        const hashed = await hashPassword('password-1');
        const ok = await comparePassword('password-2', hashed);
        expect(ok).toBe(false);
    });

    it('comparePassword fails for malformed hash', async () => {
        const ok = await comparePassword('x', 'not-a-valid-hash');
        expect(ok).toBe(false);
    });
});


