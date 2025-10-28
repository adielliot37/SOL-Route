// src/lib/crypto.ts
'use client'
import sodium from 'libsodium-wrappers'

const PUB_KEY = 'x25519_pub_b64'
const SEC_KEY = 'x25519_sec_b64'

export async function getOrCreateX25519() {
  await sodium.ready
  const pub = localStorage.getItem(PUB_KEY)
  const sec = localStorage.getItem(SEC_KEY)
  if (pub && sec) {
    return {
      pub: Uint8Array.from(atob(pub), c=>c.charCodeAt(0)),
      sec: Uint8Array.from(atob(sec), c=>c.charCodeAt(0)),
      pubB64: pub
    }
  }
  const kp = sodium.crypto_box_keypair()
  const pubB64 = btoa(String.fromCharCode(...kp.publicKey))
  const secB64 = btoa(String.fromCharCode(...kp.privateKey))
  localStorage.setItem(PUB_KEY, pubB64)
  localStorage.setItem(SEC_KEY, secB64)
  return { pub: kp.publicKey, sec: kp.privateKey, pubB64 }
}

export async function openSealedKeyB64(sealedKeyB64: string) {
  await sodium.ready
  const pubB64 = localStorage.getItem(PUB_KEY)!
  const secB64 = localStorage.getItem(SEC_KEY)!
  const pub = Uint8Array.from(atob(pubB64), c=>c.charCodeAt(0))
  const sec = Uint8Array.from(atob(secB64), c=>c.charCodeAt(0))
  const sealed = Uint8Array.from(atob(sealedKeyB64), c=>c.charCodeAt(0))
  return sodium.crypto_box_seal_open(sealed, pub, sec) // Uint8Array(32)
}