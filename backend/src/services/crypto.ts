import * as crypto from 'crypto';
import _sodium from 'libsodium-wrappers';

let sodium: typeof _sodium;

export type AesGcmBlob = { iv: Buffer; tag: Buffer; ciphertext: Buffer };

// Encrypt a buffer with random AES-256-GCM key
export function aesEncryptFile(plaintext: Buffer): { key: Buffer; blob: AesGcmBlob } {
  const key = crypto.randomBytes(32);     // AES-256
  const iv = crypto.randomBytes(12);      // 96-bit
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { key, blob: { iv, tag, ciphertext } };
}

// Wrap a key with server master key (AES-256-GCM)
export function wrapKeyWithServerKms(rawKey: Buffer, serverKeyHex: string) {
  const master = Buffer.from(serverKeyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', master, iv);
  const enc = Buffer.concat([cipher.update(rawKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encKeyB64: enc.toString('base64'),
    ivB64: iv.toString('base64'),
    tagB64: tag.toString('base64')
  };
}

// Unwrap a key
export function unwrapKeyWithServerKms(w: {encKeyB64:string, ivB64:string, tagB64:string}, serverKeyHex: string): Buffer {
  const master = Buffer.from(serverKeyHex, 'hex');
  const iv = Buffer.from(w.ivB64, 'base64');
  const tag = Buffer.from(w.tagB64, 'base64');
  const enc = Buffer.from(w.encKeyB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', master, iv);
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(enc), decipher.final()]);
  return raw; // returns original AES content key
}

// Ephemeral key exchange: encrypt AES key to buyer with forward secrecy
export async function sealKeyToBuyer(
  aesKey: Buffer, 
  buyerX25519PubB64: string
): Promise<{ sealedKeyB64: string; ephemeralPubB64: string }> {
  if (!sodium) {
    sodium = _sodium;
    await sodium.ready;
  }
  const buyerPub = Buffer.from(buyerX25519PubB64, 'base64');
  
  // Generate ephemeral keypair for this encryption
  const ephemeralKeypair = sodium.crypto_box_keypair();
  
  // Generate nonce for authenticated encryption
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  
  // Authenticated encryption with ephemeral key
  const sealed = sodium.crypto_box_easy(
    aesKey,
    nonce,
    buyerPub,
    ephemeralKeypair.privateKey
  );
  
  // Combine nonce + ciphertext for transmission
  const combined = new Uint8Array(nonce.length + sealed.length);
  combined.set(nonce);
  combined.set(sealed, nonce.length);
  
  return {
    sealedKeyB64: Buffer.from(combined).toString('base64'),
    ephemeralPubB64: Buffer.from(ephemeralKeypair.publicKey).toString('base64')
  };
}
