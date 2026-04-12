const ENVELOPE_KEY = '_secure_payload';
const ENCRYPTION_ALGORITHM = 'RSA-OAEP-256+A256GCM';

type PublicKeyResponse = {
  key_id: string;
  algorithm: string;
  public_key: string;
};

type EncryptionEnvelope = {
  v: number;
  alg: string;
  key_id: string;
  encrypted_key: string;
  iv: string;
  ciphertext: string;
};

const textEncoder = new TextEncoder();

const pemToArrayBuffer = (pem: string): ArrayBuffer => {
  const clean = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export class PayloadSecurity {
  private keyId: string | null = null;
  private publicKey: CryptoKey | null = null;
  private encryptionUnavailable = false;

  constructor(private readonly apiBaseUrlProvider: () => string) {}

  private async loadPublicKey(): Promise<CryptoKey> {
    if (this.encryptionUnavailable) {
      throw new Error('Payload encryption is unavailable on current server');
    }

    if (this.publicKey && this.keyId) {
      return this.publicKey;
    }

    const response = await fetch(`${this.apiBaseUrlProvider()}/auth/public-key`);
    if (!response.ok) {
      this.encryptionUnavailable = true;
      throw new Error('Unable to fetch encryption public key');
    }

    const payload = (await response.json()) as PublicKeyResponse;
    if (!payload?.public_key || payload.algorithm !== ENCRYPTION_ALGORITHM) {
      this.encryptionUnavailable = true;
      throw new Error('Server encryption configuration is invalid');
    }

    const key = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(payload.public_key),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );

    this.publicKey = key;
    this.keyId = payload.key_id;
    return key;
  }

  async encryptObject(data: Record<string, any>): Promise<Record<string, EncryptionEnvelope>> {
    const publicKey = await this.loadPublicKey();

    const aesKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = textEncoder.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      aesKey,
      plaintext
    );

    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const encryptedKey = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      rawAesKey
    );

    return {
      [ENVELOPE_KEY]: {
        v: 1,
        alg: ENCRYPTION_ALGORITHM,
        key_id: this.keyId || '',
        encrypted_key: toBase64(encryptedKey),
        iv: toBase64(iv.buffer),
        ciphertext: toBase64(ciphertext),
      },
    };
  }
}
