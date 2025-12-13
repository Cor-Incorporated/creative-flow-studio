import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2
 * Format: salt:hash (both hex encoded)
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH).toString('hex');
    const derivedKey = (await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    const [salt, hash] = hashedPassword.split(':');

    if (!salt || !hash) {
        return false;
    }

    const derivedKey = (await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
    const hashBuffer = Buffer.from(hash, 'hex');

    if (hashBuffer.length !== derivedKey.length) {
        return false;
    }

    return timingSafeEqual(hashBuffer, derivedKey);
}
