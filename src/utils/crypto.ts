import { E2EEMessagePayload } from '../types';

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user passkey/passphrase and salt.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Converts Uint8Array to base64 string
 */
function uint8ToBase64(u8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < u8.byteLength; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to Uint8Array
 */
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 */
export async function encryptE2EE(
  plaintext: string,
  passphrase: string
): Promise<E2EEMessagePayload> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const encodedPlaintext = enc.encode(plaintext);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encodedPlaintext
  );

  return {
    cipherText: uint8ToBase64(new Uint8Array(cipherBuffer)),
    iv: uint8ToBase64(iv),
    salt: uint8ToBase64(salt),
  };
}

/**
 * Decrypts an E2EE payload using AES-256-GCM.
 */
export async function decryptE2EE(
  payload: E2EEMessagePayload,
  passphrase: string
): Promise<string> {
  try {
    const salt = base64ToUint8(payload.salt);
    const iv = base64ToUint8(payload.iv);
    const cipherBytes = base64ToUint8(payload.cipherText);

    const key = await deriveKey(passphrase, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      cipherBytes as unknown as BufferSource
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed with passphrase:', err);
    throw new Error('No se pudo descifrar el mensaje con la clave proporcionada.');
  }
}

/**
 * Computes a human-readable SHA-256 safety fingerprint for the E2EE key (similar to Signal).
 */
export async function computeSafetyFingerprint(passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(passphrase));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Format into 12 digits chunked: 1234 5678 9012 ...
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.match(/.{1,4}/g)?.slice(0, 6).join(' ') || hex.slice(0, 24);
}
