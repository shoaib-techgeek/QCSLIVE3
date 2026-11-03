import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Private blob storage. Production uses an S3-compatible adapter (not built yet); local disk is development only. */
export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.split('/').some((p) => p === '..' || p === '.')) throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
}

export class MemoryFileStorage implements FileStorage {
  private readonly files = new Map<string, Buffer>();
  async put(key: string, data: Buffer): Promise<void> {
    assertSafeKey(key);
    this.files.set(key, data);
  }
  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    return this.files.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    this.files.delete(key);
  }
}

export class LocalFileStorage implements FileStorage {
  constructor(private readonly root: string) {}

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }
  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }
  private pathOf(key: string): string {
    assertSafeKey(key);
    return join(this.root, key);
  }
}
