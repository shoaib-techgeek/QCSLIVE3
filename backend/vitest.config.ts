import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    // Integration tests share one MySQL test database, so files run serially.
    fileParallelism: false,
  },
});
