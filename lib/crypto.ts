import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get the encryption key from environment variable.
 * The key must be 32 bytes (256 bits) for AES-256.
 * Generate one with: openssl rand -hex 32
 */
const getEncryptionKey = (): Buffer => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error(
            'ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32',
        );
    }

    // Key should be 64 hex characters (32 bytes)
    if (key.length !== 64) {
        throw new Error(
            'ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32',
        );
    }

    return Buffer.from(key, 'hex');
};

/**
 * Encrypt a string value.
 * Returns a string in format: iv:authTag:encryptedData (all base64 encoded)
 */
export const encrypt = (plaintext: string): string => {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine iv, authTag, and encrypted data
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
};

/**
 * Decrypt a string that was encrypted with the encrypt function.
 * Expects format: iv:authTag:encryptedData (all base64 encoded)
 */
export const decrypt = (encryptedValue: string): string => {
    const key = getEncryptionKey();

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format');
    }

    const [ivBase64, authTagBase64, encryptedData] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

/**
 * Safely decrypt a value, returning null if decryption fails or value is null/undefined.
 * Useful for handling legacy unencrypted values during migration.
 */
export const safeDecrypt = (encryptedValue: string | null): string | null => {
    if (!encryptedValue) return null;

    try {
        return decrypt(encryptedValue);
    } catch {
        // If decryption fails, the value might be unencrypted (legacy)
        // or corrupted. Return null to be safe.
        console.warn(
            'Failed to decrypt value - it may be unencrypted or corrupted',
        );
        return null;
    }
};
