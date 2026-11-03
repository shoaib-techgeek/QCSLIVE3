import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Aes256GcmEncryptor, parseEncryptionKey } from '../../src/shared/encryptor.js';

const key = () => randomBytes(32).toString('base64');

describe('Aes256GcmEncryptor', () => {
  it('round-trips text including unicode', () => {
    const enc = new Aes256GcmEncryptor(parseEncryptionKey(key()));
    expect(enc.decrypt(enc.encrypt('42101-1234567-1'))).toBe('42101-1234567-1');
    expect(enc.decrypt(enc.encrypt('گلشن اقبال، کراچی'))).toBe('گلشن اقبال، کراچی');
  });
  it('produces different ciphertext each time and never contains the plaintext', () => {
    const enc = new Aes256GcmEncryptor(parseEncryptionKey(key()));
    const a = enc.encrypt('secret-value');
    expect(a).not.toBe(enc.encrypt('secret-value'));
    expect(a).not.toContain('secret-value');
  });
  it('detects tampering', () => {
    const enc = new Aes256GcmEncryptor(parseEncryptionKey(key()));
    const parts = enc.encrypt('hello').split(':');
    parts[3] = Buffer.from('xxxxx').toString('base64');
    expect(() => enc.decrypt(parts.join(':'))).toThrow();
  });
  it('cannot be decrypted with another key', () => {
    const a = new Aes256GcmEncryptor(parseEncryptionKey(key()));
    const b = new Aes256GcmEncryptor(parseEncryptionKey(key()));
    expect(() => b.decrypt(a.encrypt('hello'))).toThrow();
  });
  it('rejects malformed input and keys that are not 32 bytes', () => {
    const enc = new Aes256GcmEncryptor(parseEncryptionKey(key()));
    expect(() => enc.decrypt('garbage')).toThrow();
    expect(() => parseEncryptionKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
