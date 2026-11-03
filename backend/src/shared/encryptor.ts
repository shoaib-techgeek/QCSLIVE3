import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Field-level encryption for PII (CNIC, NTN, address). A KMS-backed implementation can replace this later. */
export interface Encryptor {
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
}

export function parseEncryptionKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (base64 encoded)');
  return key;
}

const VERSION = 'v1';

/** Output format: v1:<iv>:<tag>:<ciphertext>, each base64. */
export class Aes256GcmEncryptor implements Encryptor {
  constructor(private readonly key: Buffer) {}

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }

  decrypt(cipherText: string): string {
    const [version, iv, tag, data] = cipherText.split(':');
    if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Unsupported ciphertext format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }
}
