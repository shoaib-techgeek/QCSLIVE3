import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LocalFileStorage, MemoryFileStorage, type FileStorage } from '../../src/shared/file-storage.js';

const dirs: string[] = [];
afterAll(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); });

async function local(): Promise<FileStorage> {
  const dir = await mkdtemp(join(tmpdir(), 'qcs-storage-'));
  dirs.push(dir);
  return new LocalFileStorage(dir);
}

describe.each([
  ['memory', async () => new MemoryFileStorage() as FileStorage],
  ['local', local],
])('FileStorage (%s)', (_name, make) => {
  it('stores, reads and deletes a file', async () => {
    const s = await make();
    await s.put('kyc/1/cnic.jpg', Buffer.from('abc'));
    expect((await s.get('kyc/1/cnic.jpg'))?.toString()).toBe('abc');
    await s.delete('kyc/1/cnic.jpg');
    expect(await s.get('kyc/1/cnic.jpg')).toBeNull();
  });
  it('returns null for a missing key and tolerates deleting it', async () => {
    const s = await make();
    expect(await s.get('nope/x.png')).toBeNull();
    await expect(s.delete('nope/x.png')).resolves.toBeUndefined();
  });
  it.each(['../escape.txt', '/abs/path', 'a/../../b', 'a//b', '', 'a\\b'])('rejects unsafe key %j', async (key) => {
    const s = await make();
    await expect(s.put(key, Buffer.from('x'))).rejects.toThrow(/key/i);
  });
});
