import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, needsRehash } from '@/lib/password';
import { pbkdf2 } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

describe('password', () => {
    it('hashPassword then comparePassword succeeds', async () => {
        const hashed = await hashPassword('correct horse battery staple');
        const ok = await comparePassword('correct horse battery staple', hashed);
        expect(ok).toBe(true);
        expect(needsRehash(hashed)).toBe(false);
    });

    it('comparePassword fails for wrong password', async () => {
        const hashed = await hashPassword('password-1');
        const ok = await comparePassword('password-2', hashed);
        expect(ok).toBe(false);
    });

    it('comparePassword supports legacy salt:hash format (100k iterations)', async () => {
        const password = 'legacy-password';
        const saltHex = '0123456789abcdef0123456789abcdef';
        const derivedKey = (await pbkdf2Async(password, saltHex, 100000, 64, 'sha512')) as Buffer;
        const legacy = `${saltHex}:${derivedKey.toString('hex')}`;

        const ok = await comparePassword(password, legacy);
        expect(ok).toBe(true);
        expect(needsRehash(legacy)).toBe(true);
    });

    it('comparePassword fails for malformed hash', async () => {
        const ok = await comparePassword('x', 'not-a-valid-hash');
        expect(ok).toBe(false);
        expect(needsRehash('not-a-valid-hash')).toBe(true);
    });
});


