import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2
 * Format: salt:hash (both hex encoded)
 */
export async function hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const salt = randomBytes(SALT_LENGTH).toString('hex');

        // Use Node.js crypto.pbkdf2 for password hashing
        const crypto = require('crypto');
        crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err: Error | null, derivedKey: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const [salt, hash] = hashedPassword.split(':');

        if (!salt || !hash) {
            resolve(false);
            return;
        }

        const crypto = require('crypto');
        crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err: Error | null, derivedKey: Buffer) => {
            if (err) {
                reject(err);
                return;
            }

            const hashBuffer = Buffer.from(hash, 'hex');
            const derivedBuffer = derivedKey;

            // Use timing-safe comparison to prevent timing attacks
            if (hashBuffer.length !== derivedBuffer.length) {
                resolve(false);
                return;
            }

            resolve(timingSafeEqual(hashBuffer, derivedBuffer));
        });
    });
}
