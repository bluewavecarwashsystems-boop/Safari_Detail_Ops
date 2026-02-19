/**
 * Password hashing and verification utilities
 * Uses Node.js crypto module (scrypt) for secure password hashing
 * Note: This module uses Node.js APIs and should only be used in API routes
 */

import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Scrypt parameters
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/**
 * Hash a password using scrypt
 * @param password - Plain text password
 * @returns Hashed password in format: salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hashedPassword - Hashed password in format: salt:hash
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const [salt, hash] = hashedPassword.split(':');
    if (!salt || !hash) {
      return false;
    }

    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    const hashBuffer = Buffer.from(hash, 'hex');

    // Use timingSafeEqual to prevent timing attacks
    return timingSafeEqual(derivedKey, hashBuffer);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}
