import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

const SALT_LENGTH = 16;
// NOTE: Keep legacy compatibility for existing hashes produced before iteration bumps.
const LEGACY_ITERATIONS = 100000;
// OWASP has increased PBKDF2 recommendations over time; we store params in the hash to allow future bumps.
const DEFAULT_ITERATIONS = 600000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2
 * Format (v1): pbkdf2$sha512$<iterations>$<saltHex>$<hashHex>
 * Legacy format: salt:hash (both hex encoded) uses LEGACY_ITERATIONS
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const derivedKey = (await pbkdf2Async(
        password,
        salt,
        DEFAULT_ITERATIONS,
        KEY_LENGTH,
        DIGEST
    )) as Buffer;
    return `pbkdf2$${DIGEST}$${DEFAULT_ITERATIONS}$${salt}$${derivedKey.toString('hex')}`;
}

type ParsedHash =
    | { kind: 'v1'; algo: 'pbkdf2'; digest: string; iterations: number; saltHex: string; hashHex: string }
    | { kind: 'legacy'; algo: 'pbkdf2'; digest: string; iterations: number; saltHex: string; hashHex: string }
    | { kind: 'invalid' };

function parseHashedPassword(hashedPassword: string): ParsedHash {
    if (!hashedPassword || typeof hashedPassword !== 'string') return { kind: 'invalid' };

    // v1: pbkdf2$sha512$<iter>$<salt>$<hash>
    if (hashedPassword.startsWith('pbkdf2$')) {
        const parts = hashedPassword.split('$');
        if (parts.length !== 5) return { kind: 'invalid' };
        const [, digest, iterRaw, saltHex, hashHex] = parts;
        const iterations = Number(iterRaw);
        if (!digest || !Number.isFinite(iterations) || iterations <= 0 || !saltHex || !hashHex) {
            return { kind: 'invalid' };
        }
        return {
            kind: 'v1',
            algo: 'pbkdf2',
            digest,
            iterations,
            saltHex,
            hashHex,
        };
    }

    // legacy: salt:hash
    const [saltHex, hashHex] = hashedPassword.split(':');
    if (!saltHex || !hashHex) return { kind: 'invalid' };
    return {
        kind: 'legacy',
        algo: 'pbkdf2',
        digest: DIGEST,
        iterations: LEGACY_ITERATIONS,
        saltHex,
        hashHex,
    };
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    const parsed = parseHashedPassword(hashedPassword);

    if (parsed.kind === 'invalid') {
        return false;
    }

    const derivedKey = (await pbkdf2Async(
        password,
        parsed.saltHex,
        parsed.iterations,
        KEY_LENGTH,
        parsed.digest
    )) as Buffer;
    const hashBuffer = Buffer.from(parsed.hashHex, 'hex');

    if (hashBuffer.length !== derivedKey.length) {
        return false;
    }

    return timingSafeEqual(hashBuffer, derivedKey);
}

/**
 * Determine whether a stored hash should be upgraded (rehash) on next successful login.
 */
export function needsRehash(hashedPassword: string): boolean {
    const parsed = parseHashedPassword(hashedPassword);
    if (parsed.kind === 'invalid') return true;
    // Upgrade legacy format and any v1 with weaker parameters.
    return parsed.kind === 'legacy' || parsed.iterations < DEFAULT_ITERATIONS || parsed.digest !== DIGEST;
}
