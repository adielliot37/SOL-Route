'use client'
import sodium from 'libsodium-wrappers'

const PUB_KEY = 'x25519_pub_b64'
const ENC_SEC_KEY = 'x25519_enc_sec_b64'
const KEY_SALT = 'x25519_salt_b64'
const KEY_EXPIRY = 'x25519_expiry'
const SESSION_DURATION = 3600000 // 1 hour in milliseconds

interface KeyPair {
  pub: Uint8Array
  sec: Uint8Array
  pubB64: string
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 310000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptWithKey(data: Uint8Array, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

async function decryptWithKey(encryptedB64: string, key: CryptoKey): Promise<Uint8Array> {
  const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  
  return new Uint8Array(decrypted)
}

function areKeysExpired(): boolean {
  const expiryStr = localStorage.getItem(KEY_EXPIRY)
  if (!expiryStr) return true
  
  const expiry = parseInt(expiryStr, 10)
  return Date.now() > expiry
}

function setKeyExpiry() {
  const expiry = Date.now() + SESSION_DURATION
  localStorage.setItem(KEY_EXPIRY, expiry.toString())
}

export function clearKeys() {
  localStorage.removeItem(PUB_KEY)
  localStorage.removeItem(ENC_SEC_KEY)
  localStorage.removeItem(KEY_SALT)
  localStorage.removeItem(KEY_EXPIRY)
}

export async function getOrCreateX25519(password: string): Promise<KeyPair> {
  await sodium.ready
  if (areKeysExpired()) {
    clearKeys()
  }
  
  const pub = localStorage.getItem(PUB_KEY)
  const encSec = localStorage.getItem(ENC_SEC_KEY)
  const saltB64 = localStorage.getItem(KEY_SALT)
  
  if (pub && encSec && saltB64) {
    try {
      const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
      const derivedKey = await deriveKeyFromPassword(password, salt)
      const sec = await decryptWithKey(encSec, derivedKey)
      setKeyExpiry()
      
      return {
        pub: Uint8Array.from(atob(pub), c => c.charCodeAt(0)),
        sec,
        pubB64: pub
      }
    } catch (error) {
      throw new Error('Invalid password or corrupted key data')
    }
  }
  const kp = sodium.crypto_box_keypair()
  const pubB64 = btoa(String.fromCharCode(...kp.publicKey))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derivedKey = await deriveKeyFromPassword(password, salt)
  const encryptedSec = await encryptWithKey(kp.privateKey, derivedKey)
  localStorage.setItem(PUB_KEY, pubB64)
  localStorage.setItem(ENC_SEC_KEY, encryptedSec)
  localStorage.setItem(KEY_SALT, btoa(String.fromCharCode(...salt)))
  setKeyExpiry()
  
  return {
    pub: kp.publicKey,
    sec: kp.privateKey,
    pubB64
  }
}

export function hasStoredKeys(): boolean {
  return !!(localStorage.getItem(PUB_KEY) && localStorage.getItem(ENC_SEC_KEY))
}

export async function openSealedKeyB64(
  sealedKeyB64: string,
  ephemeralPubB64: string,
  password: string
): Promise<Uint8Array> {
  await sodium.ready
  const { pub, sec } = await getOrCreateX25519(password)
  const combined = Uint8Array.from(atob(sealedKeyB64), c => c.charCodeAt(0))
  const nonce = combined.slice(0, sodium.crypto_box_NONCEBYTES)
  const ciphertext = combined.slice(sodium.crypto_box_NONCEBYTES)
  const ephemeralPub = Uint8Array.from(atob(ephemeralPubB64), c => c.charCodeAt(0))
  const decrypted = sodium.crypto_box_open_easy(
    ciphertext,
    nonce,
    ephemeralPub,
    sec
  )
  
  return decrypted
}

export function getTimeUntilExpiry(): number {
  const expiryStr = localStorage.getItem(KEY_EXPIRY)
  if (!expiryStr) return 0
  
  const expiry = parseInt(expiryStr, 10)
  return Math.max(0, expiry - Date.now())
}

export function refreshKeyExpiry() {
  if (!areKeysExpired()) {
    setKeyExpiry()
  }
}
