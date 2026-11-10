import { describe, expect, it } from 'vitest';
import { sniffMime } from '../../src/shared/file-sniff.js';

describe('sniffMime', () => {
  it('recognises png, jpeg, webp and pdf by content', () => {
    expect(sniffMime(Buffer.from('89504e470d0a1a0a00', 'hex'))).toBe('image/png');
    expect(sniffMime(Buffer.from('ffd8ffe000', 'hex'))).toBe('image/jpeg');
    expect(sniffMime(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
    expect(sniffMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
  });
  it('rejects scripts, text, empty input and a RIFF file that is not webp', () => {
    expect(sniffMime(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
    expect(sniffMime(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WAVEfmt ')]))).toBeNull();
  });
});
