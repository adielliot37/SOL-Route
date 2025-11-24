import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import * as crypto from 'crypto';

// KMS client configuration
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  } : undefined // Will use IAM role if running on AWS
});

// Key version tracking for rotation
export interface KeyVersion {
  version: number;
  kmsKeyId: string;
  createdAt: Date;
  isActive: boolean;
}

// In-memory cache for key versions (in production, store in database)
const keyVersions: KeyVersion[] = [];

/**
 * Initialize KMS with default key or load from database
 */
export function initializeKms(defaultKeyId?: string) {
  const keyId = defaultKeyId || process.env.KMS_KEY_ID;
  if (!keyId) {
    console.warn('KMS_KEY_ID not set, will use fallback encryption');
    return;
  }
  
  if (keyVersions.length === 0) {
    keyVersions.push({
      version: 1,
      kmsKeyId: keyId,
      createdAt: new Date(),
      isActive: true
    });
  }
}

/**
 * Get the active KMS key
 */
export function getActiveKeyVersion(): KeyVersion | null {
  return keyVersions.find(kv => kv.isActive) || null;
}

/**
 * Rotate to a new KMS key
 */
export function rotateKmsKey(newKeyId: string): KeyVersion {
  // Deactivate current keys
  keyVersions.forEach(kv => kv.isActive = false);
  
  // Add new key version
  const newVersion: KeyVersion = {
    version: keyVersions.length + 1,
    kmsKeyId: newKeyId,
    createdAt: new Date(),
    isActive: true
  };
  
  keyVersions.push(newVersion);
  console.log(`Rotated to KMS key version ${newVersion.version}`);
  
  return newVersion;
}

/**
 * Get key version by version number
 */
export function getKeyVersion(version: number): KeyVersion | null {
  return keyVersions.find(kv => kv.version === version) || null;
}

/**
 * Wrap (encrypt) a data key using AWS KMS
 */
export async function wrapKeyWithKms(
  plainKey: Buffer,
  keyVersion?: number
): Promise<{ encKeyB64: string; ivB64: string; tagB64: string; keyVersion: number }> {
  const activeKey = keyVersion 
    ? getKeyVersion(keyVersion) 
    : getActiveKeyVersion();

  if (!activeKey) {
    // Fallback to local encryption if KMS not configured
    return wrapKeyWithLocalFallback(plainKey);
  }

  try {
    // Use AWS KMS to encrypt the data key
    const command = new EncryptCommand({
      KeyId: activeKey.kmsKeyId,
      Plaintext: plainKey
    });

    const response = await kmsClient.send(command);
    
    if (!response.CiphertextBlob) {
      throw new Error('KMS encryption failed: no ciphertext returned');
    }

    // Store the encrypted key with metadata
    return {
      encKeyB64: Buffer.from(response.CiphertextBlob).toString('base64'),
      ivB64: '', // KMS handles IV internally
      tagB64: '', // KMS handles authentication internally
      keyVersion: activeKey.version
    };
  } catch (error: any) {
    console.error('KMS encryption error:', error.message);
    // Fallback to local encryption
    return wrapKeyWithLocalFallback(plainKey);
  }
}

/**
 * Unwrap (decrypt) a data key using AWS KMS
 */
export async function unwrapKeyWithKms(
  wrapped: { encKeyB64: string; ivB64: string; tagB64: string; keyVersion?: number }
): Promise<Buffer> {
  // If no key version specified, it's an old format - use fallback
  if (!wrapped.keyVersion) {
    return unwrapKeyWithLocalFallback(wrapped);
  }

  const keyVersion = getKeyVersion(wrapped.keyVersion);
  if (!keyVersion) {
    throw new Error(`Key version ${wrapped.keyVersion} not found`);
  }

  try {
    // Use AWS KMS to decrypt the data key
    const ciphertext = Buffer.from(wrapped.encKeyB64, 'base64');
    
    const command = new DecryptCommand({
      KeyId: keyVersion.kmsKeyId,
      CiphertextBlob: ciphertext
    });

    const response = await kmsClient.send(command);
    
    if (!response.Plaintext) {
      throw new Error('KMS decryption failed: no plaintext returned');
    }

    return Buffer.from(response.Plaintext);
  } catch (error: any) {
    console.error('KMS decryption error:', error.message);
    // Try fallback decryption for backward compatibility
    return unwrapKeyWithLocalFallback(wrapped);
  }
}

/**
 * Fallback: Wrap key with local master key (for backward compatibility or when KMS unavailable)
 */
function wrapKeyWithLocalFallback(
  rawKey: Buffer
): { encKeyB64: string; ivB64: string; tagB64: string; keyVersion: number } {
  const serverKeyHex = process.env.SERVER_KEY_HEX;
  if (!serverKeyHex) {
    throw new Error('Neither KMS nor SERVER_KEY_HEX is configured');
  }

  const master = Buffer.from(serverKeyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', master, iv);
  const enc = Buffer.concat([cipher.update(rawKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    encKeyB64: enc.toString('base64'),
    ivB64: iv.toString('base64'),
    tagB64: tag.toString('base64'),
    keyVersion: 0 // 0 indicates local fallback
  };
}

/**
 * Fallback: Unwrap key with local master key
 */
function unwrapKeyWithLocalFallback(
  w: { encKeyB64: string; ivB64: string; tagB64: string }
): Buffer {
  const serverKeyHex = process.env.SERVER_KEY_HEX;
  if (!serverKeyHex) {
    throw new Error('Neither KMS nor SERVER_KEY_HEX is configured');
  }

  const master = Buffer.from(serverKeyHex, 'hex');
  const iv = Buffer.from(w.ivB64, 'base64');
  const tag = Buffer.from(w.tagB64, 'base64');
  const enc = Buffer.from(w.encKeyB64, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', master, iv);
  decipher.setAuthTag(tag);
  
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

// Initialize on module load
initializeKms();
